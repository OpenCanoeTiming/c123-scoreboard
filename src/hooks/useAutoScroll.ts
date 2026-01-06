import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { useHighlight } from './useHighlight'
import { useLayout } from './useLayout'
import { useScoreboard } from '@/context/ScoreboardContext'

/**
 * Auto-scroll phases (matching original v1)
 */
type ScrollPhase =
  | 'IDLE'
  | 'WAITING'
  | 'SCROLLING'
  | 'PAUSED_AT_BOTTOM'
  | 'RETURNING_TO_TOP'
  | 'HIGHLIGHT_VIEW'
  | 'SCROLLING_TO_TOP_FOR_COMPETITOR' // New: scroll to top before showing OnCourse

/**
 * Auto-scroll configuration per layout (matching original v1)
 *
 * Original v1 values from ScrollManager.js:
 * - horizontal: pageInterval=8000, bottomPauseTime=2000
 * - vertical: pageInterval=12000, bottomPauseTime=8000
 * - ledwall: pageInterval=3000, bottomPauseTime=1500
 */
// Constants for scroll detection
const BOTTOM_THRESHOLD_PX = 20

const SCROLL_CONFIG = {
  vertical: {
    initialDelay: 3000,      // 3s wait before first scroll
    pageInterval: 12000,     // 12s between page scrolls
    bottomPauseTime: 8000,   // 8s pause at bottom
    returnDelay: 1000,       // 1s delay after returning to top
    highlightViewTime: 5000, // 5s to show highlighted row
  },
  ledwall: {
    initialDelay: 3000,      // 3s wait before first scroll
    pageInterval: 3000,      // 3s between page scrolls (fastest)
    bottomPauseTime: 1500,   // 1.5s pause at bottom
    returnDelay: 1000,       // 1s delay after returning to top
    highlightViewTime: 5000, // 5s to show highlighted row
  },
} as const

/**
 * Auto-scroll configuration
 */
interface AutoScrollConfig {
  /** Whether auto-scroll is enabled (default: true) */
  enabled?: boolean
}

/**
 * Return value from useAutoScroll hook
 */
interface UseAutoScrollReturn {
  /** Current scroll phase */
  phase: ScrollPhase
  /** Ref to attach to scrollable container */
  containerRef: React.RefObject<HTMLDivElement>
  /** Manually pause auto-scroll */
  pause: () => void
  /** Resume auto-scroll */
  resume: () => void
  /** Reset to beginning */
  reset: () => void
}

/**
 * Auto-scroll hook for ResultsList - matches original v1 behavior
 *
 * Original v1 uses PAGE-BASED scrolling with browser smooth scroll.
 * Key differences from continuous pixel scrolling:
 * - Scrolls by "pages" (visible rows), not pixels per second
 * - Uses CSS scroll-behavior: smooth for the "snap" effect
 * - Discrete intervals between scrolls (pageInterval)
 *
 * State machine phases:
 * - IDLE: Not running
 * - WAITING: Initial delay before first scroll
 * - SCROLLING: Active auto-scroll cycle
 * - PAUSED_AT_BOTTOM: Paused at end of list
 * - RETURNING_TO_TOP: Scrolling back to start
 * - HIGHLIGHT_VIEW: Showing highlighted competitor
 *
 * @example
 * ```tsx
 * const { containerRef, phase } = useAutoScroll({ enabled: true })
 *
 * return (
 *   <div ref={containerRef} style={{ overflow: 'auto', scrollBehavior: 'smooth' }}>
 *     {results.map(...)}
 *   </div>
 * )
 * ```
 */
export function useAutoScroll(config: AutoScrollConfig = {}): UseAutoScrollReturn {
  const { enabled = true } = config

  const containerRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<ScrollPhase>('IDLE')
  const [manuallyPaused, setManuallyPaused] = useState(false)
  // Counter to trigger re-render after each scroll step (since phase stays SCROLLING)
  const [scrollTick, setScrollTick] = useState(0)

  // Current row index for page-based scrolling
  const currentRowIndexRef = useRef(0)

  // Track previous hasActivelyRunningCompetitor state for transition detection
  const prevHasActivelyRunningRef = useRef(false)

  // Get highlight state - auto-scroll stops during highlight
  const { isActive: isHighlightActive, highlightBib } = useHighlight()

  // Get layout for config
  const { layoutMode, rowHeight, scrollToFinished } = useLayout()

  // Get OnCourse state - on ledwall, auto-scroll stops when competitor is actively running
  // A competitor is "actively running" if they have dtStart set (actually started)
  // This prevents stopping scroll for competitors who are just waiting at start
  const { onCourse } = useScoreboard()

  // Check if any competitor is actively running (has dtStart but no dtFinish)
  const hasActivelyRunningCompetitor = layoutMode === 'ledwall' && onCourse.some(
    c => c.dtStart && !c.dtFinish
  )

  // Track if we've already scrolled to the highlighted row
  const hasScrolledToHighlight = useRef(false)

  // Get layout-specific scroll config
  const scrollConfig = SCROLL_CONFIG[layoutMode]

  // Respect prefers-reduced-motion (also used by Playwright for stable screenshots)
  const prefersReducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

  // Control functions - memoized since they're returned to consumers
  const pause = useCallback(() => {
    setManuallyPaused(true)
    setPhase('IDLE')
  }, [])

  const resume = useCallback(() => {
    setManuallyPaused(false)
  }, [])

  const reset = useCallback(() => {
    setManuallyPaused(false)
    setPhase('IDLE')
    setScrollTick(0)
    currentRowIndexRef.current = 0
    if (containerRef.current) {
      containerRef.current.scrollTop = 0
    }
  }, [])

  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }, [])

  /**
   * Determine if scrolling should be active
   * Original v1: on ledwall, scroll pauses when competitor is actively running
   * (not just waiting at start - must have dtStart set)
   */
  const shouldScroll = enabled && !manuallyPaused && !isHighlightActive && !prefersReducedMotion && !hasActivelyRunningCompetitor

  // Reset scroll tracking when highlight bib changes
  useEffect(() => {
    hasScrolledToHighlight.current = false
  }, [highlightBib])

  // Note: Competitor-started-running logic is handled in main state machine effect
  // to avoid React batching race conditions between multiple effects calling setPhase

  /**
   * Handle highlight - scroll to highlighted row
   *
   * Highlight is triggered by dtFinish transition in oncourse data.
   * This is protocol-agnostic and works with CLI, C123, and Replay providers.
   * The competitor should already be in results at this point (either from
   * current run or from previous run in multi-run events).
   *
   * When scrollToFinished=false, only sets the highlight phase but doesn't scroll.
   */
  useEffect(() => {
    if (!isHighlightActive || !highlightBib || !containerRef.current) return
    if (hasScrolledToHighlight.current) return

    // Use queueMicrotask to avoid synchronous setState in effect (ESLint react-hooks/set-state-in-effect)
    queueMicrotask(() => {
      setPhase('HIGHLIGHT_VIEW')
    })

    // Skip scrolling if scrollToFinished is disabled
    if (!scrollToFinished) {
      hasScrolledToHighlight.current = true
      return
    }

    // Find the highlighted row in DOM
    const container = containerRef.current
    const rows = Array.from(container.children) as HTMLElement[]
    const highlightedRow = rows.find(
      (row) => row.dataset.bib === String(highlightBib)
    )

    if (highlightedRow) {
      hasScrolledToHighlight.current = true
      // Use scrollIntoView with 'center' block to position the row in the middle
      highlightedRow.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [isHighlightActive, highlightBib, scrollToFinished])

  /**
   * Return to normal after highlight ends
   */
  useEffect(() => {
    if (!isHighlightActive && phase === 'HIGHLIGHT_VIEW') {
      const timeoutId = setTimeout(() => {
        scrollToTop()
        currentRowIndexRef.current = 0
        // Set to IDLE, let main state machine restart scroll when shouldScroll becomes true
        // (e.g., after competitor leaves onCourse on ledwall)
        setPhase('IDLE')
      }, 500) // Small delay for highlight to fade

      return () => clearTimeout(timeoutId)
    }
  }, [isHighlightActive, phase, scrollToTop])

  /**
   * Main auto-scroll state machine
   */
  useEffect(() => {
    // Track competitor state transition (must be in this effect to avoid React batching issues)
    const wasActivelyRunning = prevHasActivelyRunningRef.current
    prevHasActivelyRunningRef.current = hasActivelyRunningCompetitor

    // Handle SCROLLING_TO_TOP_FOR_COMPETITOR phase
    // This phase runs even when hasActiveCompetitor is true (shouldScroll is false)
    if (phase === 'SCROLLING_TO_TOP_FOR_COMPETITOR') {
      scrollToTop()
      currentRowIndexRef.current = 0
      // After scrolling to top, transition to IDLE
      const timeoutId = setTimeout(() => {
        setPhase('IDLE')
      }, 500) // Wait for scroll animation
      return () => clearTimeout(timeoutId)
    }

    // Competitor just started running - scroll to top first if we're mid-scroll
    // This must be checked BEFORE the shouldScroll check to trigger scroll-to-top
    if (hasActivelyRunningCompetitor && !wasActivelyRunning) {
      // Only scroll to top if we were in an active scrolling phase and not already at top
      if (phase === 'SCROLLING' || phase === 'PAUSED_AT_BOTTOM' || phase === 'WAITING') {
        if (containerRef.current && containerRef.current.scrollTop > 0) {
          // Use queueMicrotask to avoid synchronous setState in effect (ESLint react-hooks/set-state-in-effect)
          queueMicrotask(() => {
            setPhase('SCROLLING_TO_TOP_FOR_COMPETITOR')
          })
          return // Don't proceed - next render will handle the scroll-to-top phase
        }
      }
      // Already at top or not scrolling, just go to IDLE
      queueMicrotask(() => {
        setPhase('IDLE')
      })
      return
    }

    // Don't run if disabled or highlight active
    if (!shouldScroll) {
      if (phase !== 'HIGHLIGHT_VIEW' && phase !== 'IDLE') {
        // Use queueMicrotask to avoid synchronous setState in effect (ESLint react-hooks/set-state-in-effect)
        queueMicrotask(() => {
          setPhase('IDLE')
        })
      }
      return
    }

    const container = containerRef.current
    if (!container) return

    // Check if scrolling is even needed
    const canScroll = container.scrollHeight > container.clientHeight
    if (!canScroll) {
      return
    }

    // Helper functions - defined inside effect to read current values from refs/container
    const isAtBottom = () => {
      return container.scrollHeight - container.scrollTop - container.clientHeight <= BOTTOM_THRESHOLD_PX
    }

    /**
     * Calculate rows per page based on actual container height.
     * Measures the real visible height and actual row spacing (including margins).
     * On vertical layout, subtracts 1 for overlap between pages.
     * On ledwall, no overlap (fewer rows, faster scrolling).
     */
    const getRowsPerPage = () => {
      // Calculate actual row height including margins by measuring gap between rows
      // This is more accurate than offsetHeight which doesn't include margins
      const rows = Array.from(container.children) as HTMLElement[]
      if (rows.length < 2) {
        // Fallback to simple calculation
        const fullRows = Math.floor(container.clientHeight / rowHeight)
        // Only subtract overlap on vertical (more rows, slower scrolling)
        const overlap = layoutMode === 'vertical' ? 1 : 0
        return Math.max(1, fullRows - overlap)
      }

      // Measure actual spacing between row tops (includes margin)
      const row0Top = rows[0].offsetTop
      const row1Top = rows[1].offsetTop
      const actualRowSpacing = row1Top - row0Top

      // If spacing is unreasonable, fall back to rowHeight
      const effectiveRowHeight = actualRowSpacing > 0 && actualRowSpacing < rowHeight * 2
        ? actualRowSpacing
        : rowHeight

      // Calculate full rows that fit in the visible area
      const fullRows = Math.floor(container.clientHeight / effectiveRowHeight)

      // Only subtract overlap on vertical (more rows, slower scrolling needs context)
      // Ledwall has fewer rows and faster scrolling, no overlap needed
      const overlap = layoutMode === 'vertical' ? 1 : 0
      return Math.max(1, fullRows - overlap)
    }

    const getTotalRows = () => {
      return container.children.length
    }

    const scrollToRow = (rowIndex: number) => {
      const targetRow = container.children[rowIndex] as HTMLElement | undefined
      if (!targetRow) return

      container.scrollTo({
        top: targetRow.offsetTop,
        behavior: 'smooth',
      })
    }

    let timeoutId: ReturnType<typeof setTimeout>

    switch (phase) {
      case 'IDLE':
        // Start with initial delay (WAITING phase)
        // Use queueMicrotask to avoid synchronous setState in effect (ESLint react-hooks/set-state-in-effect)
        queueMicrotask(() => {
          setPhase('WAITING')
        })
        break

      case 'WAITING':
        // Wait initialDelay, then start scrolling
        timeoutId = setTimeout(() => {
          setPhase('SCROLLING')
        }, scrollConfig.initialDelay)
        break

      case 'SCROLLING':
        // Scroll to next page after pageInterval
        timeoutId = setTimeout(() => {
          const rowsPerPage = getRowsPerPage()
          const totalRows = getTotalRows()
          const nextRowIndex = currentRowIndexRef.current + rowsPerPage

          if (nextRowIndex >= totalRows - 1 || isAtBottom()) {
            // Reached bottom
            setPhase('PAUSED_AT_BOTTOM')
          } else {
            // Scroll to next page
            currentRowIndexRef.current = nextRowIndex
            scrollToRow(nextRowIndex)
            // Trigger next scroll cycle by incrementing tick
            setScrollTick((t) => t + 1)
          }
        }, scrollConfig.pageInterval)
        break

      case 'PAUSED_AT_BOTTOM':
        // Pause at bottom, then return to top
        timeoutId = setTimeout(() => {
          scrollToTop()
          setPhase('RETURNING_TO_TOP')
        }, scrollConfig.bottomPauseTime)
        break

      case 'RETURNING_TO_TOP':
        // Wait for scroll animation + delay, then restart cycle
        timeoutId = setTimeout(() => {
          currentRowIndexRef.current = 0
          setPhase('WAITING')
        }, scrollConfig.returnDelay)
        break

      case 'HIGHLIGHT_VIEW':
        // Handled separately
        break

      // Note: SCROLLING_TO_TOP_FOR_COMPETITOR is handled above (before shouldScroll check)
      // and TypeScript correctly narrows it out at this point
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [shouldScroll, phase, scrollConfig, rowHeight, scrollTick, scrollToTop, hasActivelyRunningCompetitor, layoutMode])

  return {
    phase,
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    pause,
    resume,
    reset,
  }
}

export default useAutoScroll
