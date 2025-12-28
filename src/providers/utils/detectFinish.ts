import type { OnCourseCompetitor } from '@/types'

/**
 * Detect if competitor has finished based on dtFinish change
 *
 * This is the key detection for C123 protocol where we don't have
 * explicit "finished" messages - we detect finish by dtFinish
 * changing from null/empty to a timestamp value.
 *
 * @param previous - Previous competitor state (can be null)
 * @param current - Current competitor state
 * @returns true if competitor just finished
 */
export function detectFinish(
  previous: OnCourseCompetitor | null,
  current: OnCourseCompetitor | null
): boolean {
  // No current competitor = no finish to detect
  if (!current) {
    return false
  }

  // Must have previous state to detect a *change*
  if (!previous) {
    return false
  }

  // Must be same competitor (same bib)
  if (previous.bib !== current.bib) {
    return false
  }

  // Previous had no finish time, current has one = finish detected
  const previousHasFinish = previous.dtFinish && previous.dtFinish !== ''
  const currentHasFinish = current.dtFinish && current.dtFinish !== ''

  return !previousHasFinish && !!currentHasFinish
}

/**
 * Check if competitor is currently on course (started but not finished)
 *
 * @param competitor - Competitor to check
 * @returns true if competitor is on course
 */
export function isOnCourse(competitor: OnCourseCompetitor | null): boolean {
  if (!competitor) {
    return false
  }

  // Has started
  const hasStarted = !!competitor.dtStart && competitor.dtStart !== ''

  // Has not finished
  const hasFinishedFlag = !!competitor.dtFinish && competitor.dtFinish !== ''

  return hasStarted && !hasFinishedFlag
}

/**
 * Check if competitor has finished
 *
 * @param competitor - Competitor to check
 * @returns true if competitor has finished
 */
export function hasFinished(competitor: OnCourseCompetitor | null): boolean {
  if (!competitor) {
    return false
  }

  return !!competitor.dtFinish && competitor.dtFinish !== ''
}
