import { useState, useEffect, useCallback } from 'react'

/**
 * Return type for useTimestamp hook
 */
export interface UseTimestampReturn {
  /** Whether the timestamp is currently active (not expired) */
  isActive: boolean
  /** Time remaining in milliseconds until expiration, or 0 if not active */
  timeRemaining: number
  /** Progress from 0 to 1 (useful for progress bars/animations) */
  progress: number
}

/**
 * Shared hook for timestamp-based expiration logic
 *
 * Uses requestAnimationFrame for smooth updates during the active period.
 * After the specified duration, the timestamp is considered expired.
 *
 * This is a low-level hook used by useHighlight and useDeparting.
 *
 * @param timestamp - The timestamp when the timer started, or null if inactive
 * @param duration - The duration in milliseconds until expiration
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isActive, timeRemaining, progress } = useTimestamp(startTime, 5000)
 *
 *   if (!isActive) return null
 *
 *   return <div>Time remaining: {timeRemaining}ms</div>
 * }
 * ```
 */
export function useTimestamp(
  timestamp: number | null,
  duration: number
): UseTimestampReturn {
  // Current time for calculating remaining time
  // Note: setNow triggers re-renders to update time-based calculations
  // Using lazy initializer to avoid impure function call during render
  const [, setNow] = useState(() => Date.now())

  /**
   * Calculate whether timestamp is active based on elapsed time
   */
  const calculateIsActive = useCallback(() => {
    if (timestamp === null) {
      return false
    }
    return Date.now() - timestamp < duration
  }, [timestamp, duration])

  /**
   * Calculate time remaining until expiration
   */
  const calculateTimeRemaining = useCallback(() => {
    if (timestamp === null) {
      return 0
    }
    const elapsed = Date.now() - timestamp
    const remaining = duration - elapsed
    return Math.max(0, remaining)
  }, [timestamp, duration])

  /**
   * Calculate progress (0 to 1, where 1 is fully elapsed)
   */
  const calculateProgress = useCallback(() => {
    if (timestamp === null) {
      return 0
    }
    const elapsed = Date.now() - timestamp
    return Math.min(1, elapsed / duration)
  }, [timestamp, duration])

  /**
   * Use requestAnimationFrame to update time during active period
   * This ensures smooth animations without excessive re-renders
   */
  useEffect(() => {
    if (timestamp === null) {
      return
    }

    let animationFrameId: number

    const updateTime = () => {
      setNow(Date.now())

      // Continue animation if still active
      if (Date.now() - timestamp < duration) {
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
  }, [timestamp, duration])

  // Force recalculation when `now` changes
  const isActive = calculateIsActive()
  const timeRemaining = calculateTimeRemaining()
  const progress = calculateProgress()

  return {
    isActive,
    timeRemaining,
    progress,
  }
}

export default useTimestamp
