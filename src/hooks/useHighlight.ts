import { useScoreboard } from '@/context/ScoreboardContext'
import { HIGHLIGHT_DURATION } from '@/context/constants'
import { useTimestamp } from './useTimestamp'

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

  const { isActive, timeRemaining, progress } = useTimestamp(
    highlightBib && highlightTimestamp ? highlightTimestamp : null,
    HIGHLIGHT_DURATION
  )

  return {
    highlightBib: isActive ? highlightBib : null,
    isActive,
    timeRemaining,
    progress,
  }
}

export default useHighlight
