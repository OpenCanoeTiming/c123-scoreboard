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

  // Get highlight state - auto-scroll stops during highlight
  const { isActive: isHighlightActive, highlightBib } = useHighlight()

  // Get layout for config
  const { layoutMode, rowHeight } = useLayout()

  // Get OnCourse state and results - on ledwall, auto-scroll stops when competitor is on course
  const { currentCompetitor, onCourse, results } = useScoreboard()
  const hasActiveCompetitor = layoutMode === 'ledwall' && (currentCompetitor !== null || onCourse.length > 0)

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
   * Original v1: on ledwall, scroll pauses when competitor is on course
   */
  const shouldScroll = enabled && !manuallyPaused && !isHighlightActive && !prefersReducedMotion && !hasActiveCompetitor

  // Reset scroll tracking when highlight bib changes
  useEffect(() => {
    hasScrolledToHighlight.current = false
  }, [highlightBib])

  /**
   * Handle highlight - scroll to highlighted row
   * Only scroll when the highlighted result actually exists in results array.
   * This ensures we wait for the result to arrive before scrolling.
   */
  useEffect(() => {
    if (!isHighlightActive || !highlightBib || !containerRef.current) return
    if (hasScrolledToHighlight.current) return

    // Check if result for highlighted bib exists in results
    const resultExists = results.some(r => r.bib === highlightBib)
    if (!resultExists) {
      // Result not yet in list - wait for next render when it arrives
      return
    }

    setPhase('HIGHLIGHT_VIEW')

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
  }, [isHighlightActive, highlightBib, results])

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
    // Don't run if disabled or highlight active
    if (!shouldScroll) {
      if (phase !== 'HIGHLIGHT_VIEW' && phase !== 'IDLE') {
        setPhase('IDLE')
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
     * Measures the real visible height and divides by actual row height.
     * Subtracts 1 to create overlap between pages (prevents skipping rows).
     */
    const getRowsPerPage = () => {
      // Measure actual row height from first row element
      const firstRow = container.children[0] as HTMLElement | undefined
      const actualRowHeight = firstRow?.offsetHeight ?? rowHeight

      // Calculate full rows that fit in the visible area
      const fullRows = Math.floor(container.clientHeight / actualRowHeight)

      // Subtract 1 for overlap between pages (at least 1 row visible from previous page)
      return Math.max(1, fullRows - 1)
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
        setPhase('WAITING')
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
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [shouldScroll, phase, scrollConfig, rowHeight, scrollTick])

  return {
    phase,
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    pause,
    resume,
    reset,
  }
}

export default useAutoScroll
