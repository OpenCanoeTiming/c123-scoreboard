import { useRef, useEffect, useCallback, useState } from 'react'
import { useHighlight } from './useHighlight'
import { useLayout } from './useLayout'

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

  // Current row index for page-based scrolling
  const currentRowIndexRef = useRef(0)

  // Get highlight state - auto-scroll stops during highlight
  const { isActive: isHighlightActive, highlightBib } = useHighlight()

  // Get layout for config
  const { layoutMode, rowHeight } = useLayout()

  // Get layout-specific scroll config
  const scrollConfig = SCROLL_CONFIG[layoutMode]

  // Respect prefers-reduced-motion (also used by Playwright for stable screenshots)
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /**
   * Pause auto-scroll manually
   */
  const pause = useCallback(() => {
    setManuallyPaused(true)
    setPhase('IDLE')
  }, [])

  /**
   * Resume auto-scroll
   */
  const resume = useCallback(() => {
    setManuallyPaused(false)
  }, [])

  /**
   * Reset to beginning
   */
  const reset = useCallback(() => {
    setManuallyPaused(false)
    setPhase('IDLE')
    currentRowIndexRef.current = 0
    if (containerRef.current) {
      containerRef.current.scrollTop = 0
    }
  }, [])

  /**
   * Check if we've reached the bottom of the scroll container
   */
  const isAtBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return false
    // 20px threshold matching original v1
    return container.scrollHeight - container.scrollTop - container.clientHeight <= 20
  }, [])

  /**
   * Get rows per page (how many rows fit in the visible container)
   * Original v1 uses 90% of container height
   */
  const getRowsPerPage = useCallback(() => {
    const container = containerRef.current
    if (!container) return 1

    const containerHeight = container.clientHeight
    const rowsPerPage = Math.max(1, Math.floor((containerHeight * 0.9) / rowHeight))
    return rowsPerPage
  }, [rowHeight])

  /**
   * Get total number of rows
   */
  const getTotalRows = useCallback(() => {
    const container = containerRef.current
    if (!container) return 0
    return container.children.length
  }, [])

  /**
   * Scroll to a specific row index
   * Uses browser smooth scroll for the "snap" effect
   */
  const scrollToRow = useCallback((rowIndex: number) => {
    const container = containerRef.current
    if (!container) return

    const rows = container.children
    if (rowIndex >= rows.length) return

    const targetRow = rows[rowIndex] as HTMLElement
    if (!targetRow) return

    container.scrollTo({
      top: targetRow.offsetTop,
      behavior: 'smooth',
    })
  }, [])

  /**
   * Scroll to top
   */
  const scrollToTop = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    container.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }, [])

  /**
   * Determine if scrolling should be active
   */
  const shouldScroll = enabled && !manuallyPaused && !isHighlightActive && !prefersReducedMotion

  /**
   * Handle highlight - scroll to highlighted row
   */
  useEffect(() => {
    if (!isHighlightActive || !highlightBib || !containerRef.current) return

    setPhase('HIGHLIGHT_VIEW')

    // Find the highlighted row
    const container = containerRef.current
    const rows = Array.from(container.children) as HTMLElement[]
    const highlightedRow = rows.find(
      (row) => row.dataset.bib === String(highlightBib)
    )

    if (highlightedRow) {
      container.scrollTo({
        top: Math.max(0, highlightedRow.offsetTop - container.clientHeight / 2 + highlightedRow.clientHeight / 2),
        behavior: 'smooth',
      })
    }
  }, [isHighlightActive, highlightBib])

  /**
   * Return to normal after highlight ends
   */
  useEffect(() => {
    if (!isHighlightActive && phase === 'HIGHLIGHT_VIEW') {
      const timeoutId = setTimeout(() => {
        scrollToTop()
        currentRowIndexRef.current = 0
        setPhase('WAITING')
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
  }, [
    shouldScroll,
    phase,
    scrollConfig,
    getRowsPerPage,
    getTotalRows,
    isAtBottom,
    scrollToRow,
    scrollToTop,
  ])

  return {
    phase,
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    pause,
    resume,
    reset,
  }
}

export default useAutoScroll
