import { useState, useEffect, useCallback } from 'react'
import { useClock } from '@/clock/clockContext'

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
 * Uses the Clock's frames for smooth updates during the active period.
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
  const clock = useClock()
  const [, setNow] = useState(() => clock.now())

  /**
   * Calculate whether timestamp is active based on elapsed time
   */
  const calculateIsActive = useCallback(() => {
    if (timestamp === null) {
      return false
    }
    return clock.now() - timestamp < duration
  }, [timestamp, duration, clock])

  /**
   * Calculate time remaining until expiration
   */
  const calculateTimeRemaining = useCallback(() => {
    if (timestamp === null) {
      return 0
    }
    const elapsed = clock.now() - timestamp
    const remaining = duration - elapsed
    return Math.max(0, remaining)
  }, [timestamp, duration, clock])

  /**
   * Calculate progress (0 to 1, where 1 is fully elapsed)
   */
  const calculateProgress = useCallback(() => {
    if (timestamp === null) {
      return 0
    }
    const elapsed = clock.now() - timestamp
    return Math.min(1, elapsed / duration)
  }, [timestamp, duration, clock])

  /**
   * Use Clock frames to update time during active period
   * This ensures smooth animations without excessive re-renders
   */
  useEffect(() => {
    if (timestamp === null) {
      return
    }

    let animationFrameId: number

    const updateTime = () => {
      setNow(clock.now())

      // Continue animation if still active
      if (clock.now() - timestamp < duration) {
        animationFrameId = clock.requestFrame(updateTime)
      }
    }

    // Start the animation loop
    animationFrameId = clock.requestFrame(updateTime)

    return () => {
      if (animationFrameId) {
        clock.cancelFrame(animationFrameId)
      }
    }
  }, [timestamp, duration, clock])

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
