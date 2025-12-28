import { useState, useEffect, useCallback } from 'react'
import {
  useScoreboard,
  DEPARTING_TIMEOUT,
} from '@/context/ScoreboardContext'
import type { OnCourseCompetitor } from '@/types'

/**
 * Return type for useDeparting hook
 */
export interface UseDepartingReturn {
  /** The departing competitor, or null if none */
  departingCompetitor: OnCourseCompetitor | null
  /** Whether the departing competitor is currently active (not expired) */
  isActive: boolean
  /** Time remaining in milliseconds until departing expires, or 0 if not active */
  timeRemaining: number
  /** Progress from 0 to 1 (useful for progress bars/animations) */
  progress: number
}

/**
 * Hook for managing departing competitor state with timestamp-based expiration
 *
 * Uses requestAnimationFrame for smooth updates during the departing period.
 * After DEPARTING_TIMEOUT (3s), the departing competitor is considered expired.
 *
 * The departing competitor is the competitor who just left the course
 * but hasn't been highlighted yet (result not processed).
 *
 * @example
 * ```tsx
 * function CurrentCompetitorArea() {
 *   const { departingCompetitor, isActive } = useDeparting()
 *
 *   return (
 *     <div>
 *       {isActive && departingCompetitor && (
 *         <DepartingDisplay competitor={departingCompetitor} />
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
export function useDeparting(): UseDepartingReturn {
  const { departingCompetitor, departedAt } = useScoreboard()

  // Current time for calculating remaining time
  // Note: setNow triggers re-renders to update time-based calculations
  const [, setNow] = useState(Date.now())

  /**
   * Calculate whether departing is active based on timestamp
   */
  const calculateIsActive = useCallback(() => {
    if (!departingCompetitor || !departedAt) {
      return false
    }
    return Date.now() - departedAt < DEPARTING_TIMEOUT
  }, [departingCompetitor, departedAt])

  /**
   * Calculate time remaining until departing expires
   */
  const calculateTimeRemaining = useCallback(() => {
    if (!departingCompetitor || !departedAt) {
      return 0
    }
    const elapsed = Date.now() - departedAt
    const remaining = DEPARTING_TIMEOUT - elapsed
    return Math.max(0, remaining)
  }, [departingCompetitor, departedAt])

  /**
   * Calculate progress (0 to 1, where 1 is fully elapsed)
   */
  const calculateProgress = useCallback(() => {
    if (!departingCompetitor || !departedAt) {
      return 0
    }
    const elapsed = Date.now() - departedAt
    return Math.min(1, elapsed / DEPARTING_TIMEOUT)
  }, [departingCompetitor, departedAt])

  /**
   * Use requestAnimationFrame to update time during active departing
   * This ensures smooth animations without excessive re-renders
   */
  useEffect(() => {
    if (!departingCompetitor || !departedAt) {
      return
    }

    let animationFrameId: number

    const updateTime = () => {
      setNow(Date.now())

      // Continue animation if departing is still active
      if (Date.now() - departedAt < DEPARTING_TIMEOUT) {
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
  }, [departingCompetitor, departedAt])

  // Force recalculation when `now` changes
  const isActive = calculateIsActive()
  const timeRemaining = calculateTimeRemaining()
  const progress = calculateProgress()

  return {
    departingCompetitor: isActive ? departingCompetitor : null,
    isActive,
    timeRemaining,
    progress,
  }
}

export default useDeparting
