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
