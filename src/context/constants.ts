/**
 * Scoreboard timing constants
 *
 * Extracted from ScoreboardContext to allow Fast Refresh to work properly.
 */

/**
 * Highlight duration in milliseconds (5 seconds)
 */
export const HIGHLIGHT_DURATION = 5000

/**
 * Departing competitor timeout in milliseconds (3 seconds)
 * After this time, the departing competitor is cleared if no highlight arrives
 */
export const DEPARTING_TIMEOUT = 3000

/**
 * Finish display duration in milliseconds (8 seconds)
 *
 * When a competitor finishes (dtFinish), they remain pinned to the
 * CurrentCompetitor slot for this duration — even if another competitor
 * is on course (interval racing). Ensures the finish moment has a
 * visible pause with the final time, instead of being replaced instantly.
 */
export const FINISH_DISPLAY_DURATION = 8000

/**
 * Grace period for finished competitors in onCourse list (5 seconds)
 * After dtFinish is detected, competitor stays visible for this duration
 * before being removed from the on-course display
 */
export const FINISHED_GRACE_PERIOD = 5000

/**
 * Timeout for removing stale competitors from onCourse list (15 seconds)
 *
 * C123 sends OnCourse updates ~1/second per competitor. If a competitor
 * hasn't appeared in any message for this duration, they were removed
 * from the course (DNS/skip) without an explicit dtFinish signal.
 * Removing stale competitors allows activeRaceId to switch to the
 * current race.
 */
export const STALE_COMPETITOR_TIMEOUT = 15000
