import { useRef, useEffect, useCallback, useState } from 'react'
import { useHighlight } from './useHighlight'
import { useLayout } from './useLayout'

/**
 * Auto-scroll phases
 */
type ScrollPhase = 'IDLE' | 'SCROLLING' | 'PAUSED_AT_BOTTOM' | 'RETURNING'

/**
 * Auto-scroll configuration
 */
interface AutoScrollConfig {
  /** Scroll speed in pixels per second (default: 50) */
  scrollSpeed?: number
  /** Pause duration at bottom in ms (default: 2000) */
  pauseAtBottom?: number
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
 * Auto-scroll hook for ResultsList
 *
 * Provides automatic scrolling through results when no highlight is active.
 * Scrolling pauses at the bottom, then returns to top.
 *
 * Phases:
 * - IDLE: Not scrolling (highlight active or paused)
 * - SCROLLING: Scrolling down through results
 * - PAUSED_AT_BOTTOM: Paused at the bottom of the list
 * - RETURNING: Scrolling back to the top
 *
 * @example
 * ```tsx
 * const { containerRef, phase } = useAutoScroll({ scrollSpeed: 50 })
 *
 * return (
 *   <div ref={containerRef} style={{ overflow: 'auto' }}>
 *     {results.map(...)}
 *   </div>
 * )
 * ```
 */
export function useAutoScroll(config: AutoScrollConfig = {}): UseAutoScrollReturn {
  const { scrollSpeed = 50, pauseAtBottom = 2000, enabled = true } = config

  const containerRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<ScrollPhase>('IDLE')
  const [manuallyPaused, setManuallyPaused] = useState(false)

  // Track phase in ref for animation callback
  const phaseRef = useRef(phase)

  // Get highlight state - auto-scroll stops during highlight
  const { isActive: isHighlightActive } = useHighlight()

  // Get layout for speed adjustment
  const { layoutMode } = useLayout()

  // Adjust scroll speed based on layout
  const adjustedSpeed = layoutMode === 'ledwall' ? scrollSpeed * 0.7 : scrollSpeed

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
    // Allow 5px tolerance
    return container.scrollTop + container.clientHeight >= container.scrollHeight - 5
  }, [])

  /**
   * Check if we're at the top
   */
  const isAtTop = useCallback(() => {
    const container = containerRef.current
    if (!container) return false
    return container.scrollTop <= 5
  }, [])

  /**
   * Determine if scrolling should be active
   */
  const shouldScroll = enabled && !manuallyPaused && !isHighlightActive

  // Keep phaseRef in sync with phase state
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  /**
   * Main auto-scroll effect
   */
  useEffect(() => {
    // Don't scroll if disabled, manually paused, or highlight is active
    if (!shouldScroll) {
      // Reset to IDLE when scrolling is disabled
      // Using setTimeout to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => setPhase('IDLE'), 0)
      return () => clearTimeout(timeoutId)
    }

    const container = containerRef.current
    if (!container) return

    // Check if scrolling is even needed
    const canScroll = container.scrollHeight > container.clientHeight
    if (!canScroll) {
      return
    }

    let animationFrameId: number
    let lastTimestamp: number | null = null
    let pauseTimeoutId: ReturnType<typeof setTimeout>

    const animate = (timestamp: number) => {
      if (lastTimestamp === null) {
        lastTimestamp = timestamp
      }

      const deltaTime = timestamp - lastTimestamp
      lastTimestamp = timestamp

      // Calculate scroll delta
      const pixelsPerMs = adjustedSpeed / 1000
      const scrollDelta = pixelsPerMs * deltaTime

      const currentPhase = phaseRef.current

      if (currentPhase === 'SCROLLING') {
        container.scrollTop += scrollDelta

        if (isAtBottom()) {
          setPhase('PAUSED_AT_BOTTOM')
          return
        }
      } else if (currentPhase === 'RETURNING') {
        container.scrollTop -= scrollDelta * 2 // Return faster

        if (isAtTop()) {
          setPhase('SCROLLING')
          return
        }
      }

      animationFrameId = requestAnimationFrame(animate)
    }

    // Start scrolling from IDLE - use timeout to avoid sync setState
    if (phase === 'IDLE') {
      const startTimeout = setTimeout(() => setPhase('SCROLLING'), 0)
      return () => clearTimeout(startTimeout)
    }

    // Handle pause at bottom
    if (phase === 'PAUSED_AT_BOTTOM') {
      pauseTimeoutId = setTimeout(() => {
        setPhase('RETURNING')
      }, pauseAtBottom)

      return () => clearTimeout(pauseTimeoutId)
    }

    // Start animation for SCROLLING or RETURNING
    if (phase === 'SCROLLING' || phase === 'RETURNING') {
      animationFrameId = requestAnimationFrame(animate)

      return () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId)
        }
      }
    }
  }, [shouldScroll, phase, adjustedSpeed, pauseAtBottom, isAtBottom, isAtTop])

  return {
    phase,
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    pause,
    resume,
    reset,
  }
}

export default useAutoScroll
