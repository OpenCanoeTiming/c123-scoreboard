/**
 * C123 Server Message Mappers
 *
 * Functions to transform C123 Server message data to scoreboard internal types.
 * Used by C123ServerProvider to normalize incoming WebSocket messages.
 */

import type { OnCourseCompetitor, Result, RaceConfig, ResultStatus } from '@/types'
import type {
  C123OnCourseData,
  C123OnCourseCompetitor,
  C123ResultsData,
  C123ResultRow,
  C123TimeOfDayData,
  C123RaceConfigData,
} from '@/types/c123server'
import type { ResultsData, OnCourseData, EventInfoData } from '../types'

// =============================================================================
// OnCourse Mapping
// =============================================================================

/**
 * Map C123 OnCourse competitor to scoreboard OnCourseCompetitor
 */
function mapOnCourseCompetitor(c: C123OnCourseCompetitor): OnCourseCompetitor {
  return {
    bib: c.bib,
    name: c.name,
    club: c.club,
    nat: c.nat,
    raceId: c.raceId,
    time: c.time,
    total: c.total,
    pen: c.pen,
    gates: c.gates,
    dtStart: c.dtStart || null,
    dtFinish: c.dtFinish,
    ttbDiff: c.ttbDiff,
    ttbName: c.ttbName,
    rank: c.rank,
  }
}

/**
 * Find the competitor who has been on course the longest (lowest dtStart).
 * This ensures consistent selection when multiple competitors are on course.
 */
function findOldestOnCourse(competitors: OnCourseCompetitor[]): OnCourseCompetitor | null {
  if (competitors.length === 0) return null
  if (competitors.length === 1) return competitors[0]

  // Sort by dtStart ascending (oldest first)
  // Null dtStart goes last
  const sorted = [...competitors].sort((a, b) => {
    if (!a.dtStart && !b.dtStart) return 0
    if (!a.dtStart) return 1
    if (!b.dtStart) return -1
    return a.dtStart.localeCompare(b.dtStart)
  })

  return sorted[0]
}

/**
 * Map C123 OnCourse message data to OnCourseData
 *
 * Filters out competitors without a valid dtStart (not yet on course).
 * This prevents "ghost" competitors from appearing in the on-course display
 * when they're in the start list but haven't actually started.
 *
 * @param data - C123 OnCourse message data
 * @returns OnCourseData for scoreboard
 */
export function mapOnCourse(data: C123OnCourseData): OnCourseData {
  // Map all competitors first
  const allCompetitors = data.competitors.map(mapOnCourseCompetitor)

  // Filter to only competitors who have actually started (have valid dtStart)
  // This fixes the issue where competitors appear/disappear when they're in
  // the start queue but haven't started yet
  const activeCompetitors = allCompetitors.filter(c => c.dtStart !== null && c.dtStart !== '')

  return {
    current: findOldestOnCourse(activeCompetitors),
    onCourse: activeCompetitors,
    updateOnCourse: true,
  }
}

// =============================================================================
// Results Mapping
// =============================================================================

/**
 * Get result status from C123 data.
 *
 * Only uses explicit status field from data (IRM field in XML).
 * Does NOT infer DNS/DNF from data patterns - if status is not in data,
 * display will show "---" instead of time.
 *
 * @param row - C123 result row
 * @returns Status string or empty for valid/unknown results
 */
function getResultStatus(row: C123ResultRow): ResultStatus {
  // Only use explicitly provided status (from IRM field in XML)
  if (row.status) {
    const upperStatus = row.status.toUpperCase()
    if (upperStatus === 'DNS' || upperStatus === 'DNF' || upperStatus === 'DSQ') {
      return upperStatus as ResultStatus
    }
  }

  return ''
}

/**
 * Map C123 result row to scoreboard Result
 */
function mapResultRow(row: C123ResultRow): Result {
  const status = getResultStatus(row)

  return {
    rank: row.rank,
    bib: row.bib,
    name: row.name,
    familyName: row.familyName,
    givenName: row.givenName,
    club: row.club,
    nat: row.nat,
    total: row.total,
    pen: row.pen,
    behind: row.behind,
    status,
  }
}

/**
 * Map C123 race status to scoreboard raceStatus string.
 *
 * C123 Server uses isCurrent boolean:
 * - isCurrent: true → race is running → "In Progress"
 * - isCurrent: false → race is finished → "Unofficial"
 *
 * These match CLI format for consistency in UI display.
 */
function mapRaceStatus(isCurrent: boolean): string {
  return isCurrent ? 'In Progress' : 'Unofficial'
}

/**
 * Extract run suffix from raceId for full race name construction.
 *
 * RaceId format: {CLASS}_{COURSE}_{RUN}_{VERSION}
 * Examples:
 * - K1M_ST_BR1_6 → " - 1. jízda"
 * - K1M_ST_BR2_6 → " - 2. jízda"
 *
 * CLI sends full race name like "K1m - střední trať - 2. jízda"
 * C123 Server sends mainTitle="K1m - střední trať" and we need to add the run suffix.
 */
function getRunSuffixFromRaceId(raceId: string): string {
  // Match BR1 or BR2 in the raceId
  const match = raceId.match(/_BR([12])_/)
  if (!match) return ''

  const runNumber = match[1]
  return ` - ${runNumber}. jízda`
}

/**
 * Build full race name from mainTitle and raceId.
 *
 * CLI sends: "K1m - střední trať - 2. jízda"
 * C123 Server sends: mainTitle="K1m - střední trať", raceId="K1M_ST_BR2_6"
 *
 * We need to combine them to match CLI format.
 */
function buildRaceName(mainTitle: string, raceId: string): string {
  const suffix = getRunSuffixFromRaceId(raceId)
  return mainTitle + suffix
}

/**
 * Map C123 Results message data to ResultsData
 *
 * Note: C123 Server doesn't provide highlightBib in Results messages.
 * Finish detection is handled by ScoreboardContext using dtFinish tracking.
 *
 * @param data - C123 Results message data
 * @returns ResultsData for scoreboard
 */
export function mapResults(data: C123ResultsData): ResultsData {
  // Build race name: if mainTitle is present, append run suffix; otherwise use raceId
  const raceName = data.mainTitle
    ? buildRaceName(data.mainTitle, data.raceId)
    : data.raceId

  return {
    results: data.rows.map(mapResultRow),
    raceName,
    raceStatus: mapRaceStatus(data.isCurrent),
    highlightBib: null, // C123 Server doesn't provide this; finish detection uses dtFinish
    raceId: data.raceId, // Include raceId for active category tracking
  }
}

// =============================================================================
// TimeOfDay Mapping
// =============================================================================

/**
 * Map C123 TimeOfDay message data to partial EventInfoData
 *
 * Only updates dayTime field; title and infoText are not included to
 * prevent overwriting values from other sources (like discovery endpoint).
 *
 * @param data - C123 TimeOfDay message data
 * @returns Partial EventInfoData with dayTime set
 */
export function mapTimeOfDay(data: C123TimeOfDayData): EventInfoData {
  return {
    dayTime: data.time,
  }
}

// =============================================================================
// RaceConfig Mapping
// =============================================================================

/**
 * Map C123 RaceConfig message data to RaceConfig
 *
 * @param data - C123 RaceConfig message data
 * @param currentRaceName - Current race name (from Results message)
 * @param isCurrent - Whether race is currently running
 * @returns RaceConfig for scoreboard
 */
export function mapRaceConfig(
  data: C123RaceConfigData,
  currentRaceName: string = '',
  isCurrent: boolean = true
): RaceConfig {
  return {
    raceName: currentRaceName,
    raceStatus: mapRaceStatus(isCurrent),
    gateCount: data.nrGates,
  }
}
