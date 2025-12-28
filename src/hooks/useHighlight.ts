import { useState, useEffect, useCallback } from 'react'
import { useScoreboard } from '@/context/ScoreboardContext'
import { HIGHLIGHT_DURATION } from '@/context/constants'

/**
 * Return type for useHighlight hook
 */
export interface UseHighlightReturn {
  /** The currently highlighted bib, or null if no active highlight */
  highlightBib: string | null
  /** Whether the highlight is currently active (not expired) */
  isActive: boolean
  /** Time remaining in milliseconds until highlight expires, or 0 if not active */
  timeRemaining: number
  /** Progress from 0 to 1 (useful for progress bars/animations) */
  progress: number
}

/**
 * Hook for managing highlight state with timestamp-based expiration
 *
 * Uses requestAnimationFrame for smooth updates during the highlight period.
 * After HIGHLIGHT_DURATION (5s), the highlight is considered expired.
 *
 * @example
 * ```tsx
 * function ResultRow({ result }) {
 *   const { highlightBib, isActive } = useHighlight()
 *   const isHighlighted = isActive && result.bib === highlightBib
 *
 *   return <div className={isHighlighted ? 'highlighted' : ''}>{...}</div>
 * }
 * ```
 */
export function useHighlight(): UseHighlightReturn {
  const { highlightBib, highlightTimestamp } = useScoreboard()

  // Current time for calculating remaining time
  // Note: setNow triggers re-renders to update time-based calculations
  // Using lazy initializer to avoid impure function call during render
  const [, setNow] = useState(() => Date.now())

  /**
   * Calculate whether highlight is active based on timestamp
   */
  const calculateIsActive = useCallback(() => {
    if (!highlightBib || !highlightTimestamp) {
      return false
    }
    return Date.now() - highlightTimestamp < HIGHLIGHT_DURATION
  }, [highlightBib, highlightTimestamp])

  /**
   * Calculate time remaining until highlight expires
   */
  const calculateTimeRemaining = useCallback(() => {
    if (!highlightBib || !highlightTimestamp) {
      return 0
    }
    const elapsed = Date.now() - highlightTimestamp
    const remaining = HIGHLIGHT_DURATION - elapsed
    return Math.max(0, remaining)
  }, [highlightBib, highlightTimestamp])

  /**
   * Calculate progress (0 to 1, where 1 is fully elapsed)
   */
  const calculateProgress = useCallback(() => {
    if (!highlightBib || !highlightTimestamp) {
      return 0
    }
    const elapsed = Date.now() - highlightTimestamp
    return Math.min(1, elapsed / HIGHLIGHT_DURATION)
  }, [highlightBib, highlightTimestamp])

  /**
   * Use requestAnimationFrame to update time during active highlight
   * This ensures smooth animations without excessive re-renders
   */
  useEffect(() => {
    if (!highlightBib || !highlightTimestamp) {
      return
    }

    let animationFrameId: number

    const updateTime = () => {
      setNow(Date.now())

      // Continue animation if highlight is still active
      if (Date.now() - highlightTimestamp < HIGHLIGHT_DURATION) {
        animationFrameId = requestAnimationFrame(updateTime)
      }
    }

    // Start the animation loop
    animationFrameId = requestAnimationFrame(updateTime)

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [highlightBib, highlightTimestamp])

  // Force recalculation when `now` changes
  const isActive = calculateIsActive()
  const timeRemaining = calculateTimeRemaining()
  const progress = calculateProgress()

  return {
    highlightBib: isActive ? highlightBib : null,
    isActive,
    timeRemaining,
    progress,
  }
}

export default useHighlight
