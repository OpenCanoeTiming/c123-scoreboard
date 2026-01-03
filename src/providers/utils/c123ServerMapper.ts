/**
 * C123 Server Message Mappers
 *
 * Functions to transform C123 Server message data to scoreboard internal types.
 * Used by C123ServerProvider to normalize incoming WebSocket messages.
 */

import type { OnCourseCompetitor, Result, RaceConfig } from '@/types'
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
 * @param data - C123 OnCourse message data
 * @returns OnCourseData for scoreboard
 */
export function mapOnCourse(data: C123OnCourseData): OnCourseData {
  const competitors = data.competitors.map(mapOnCourseCompetitor)

  return {
    current: findOldestOnCourse(competitors),
    onCourse: competitors,
    updateOnCourse: true,
  }
}

// =============================================================================
// Results Mapping
// =============================================================================

/**
 * Map C123 result row to scoreboard Result
 */
function mapResultRow(row: C123ResultRow): Result {
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
  }
}

/**
 * Map C123 race status to scoreboard raceStatus string.
 *
 * C123 Server uses isCurrent boolean:
 * - isCurrent: true → race is running → "3"
 * - isCurrent: false → race is finished → "5"
 */
function mapRaceStatus(isCurrent: boolean): string {
  return isCurrent ? '3' : '5'
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
  return {
    results: data.rows.map(mapResultRow),
    raceName: data.mainTitle || data.raceId,
    raceStatus: mapRaceStatus(data.isCurrent),
    highlightBib: null, // C123 Server doesn't provide this; finish detection uses dtFinish
  }
}

// =============================================================================
// TimeOfDay Mapping
// =============================================================================

/**
 * Map C123 TimeOfDay message data to partial EventInfoData
 *
 * Only updates dayTime field; title and infoText are preserved.
 *
 * @param data - C123 TimeOfDay message data
 * @returns Partial EventInfoData with dayTime set
 */
export function mapTimeOfDay(data: C123TimeOfDayData): EventInfoData {
  return {
    title: '',
    infoText: '',
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
    raceStatus: isCurrent ? '3' : '5',
    gateCount: data.nrGates,
  }
}
