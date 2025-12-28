import { useScoreboard } from '@/context/ScoreboardContext'
import { DEPARTING_TIMEOUT } from '@/context/constants'
import { useTimestamp } from './useTimestamp'
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

  const { isActive, timeRemaining, progress } = useTimestamp(
    departingCompetitor && departedAt ? departedAt : null,
    DEPARTING_TIMEOUT
  )

  return {
    departingCompetitor: isActive ? departingCompetitor : null,
    isActive,
    timeRemaining,
    progress,
  }
}

export default useDeparting
