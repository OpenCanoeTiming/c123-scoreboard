/**
 * Shared parsing utilities for CLI and Replay providers
 *
 * These functions parse incoming WebSocket message data into strongly typed
 * result and competitor objects.
 */

import type { OnCourseCompetitor, Result } from '@/types'
import { safeString, safeNumber, isArray, validateResultRow } from './validation'

/**
 * Parse result list from 'top' message payload
 *
 * @param payload - The data object from a 'top' message
 * @param skipValidation - Skip row validation (for replay which has pre-validated data)
 * @returns Array of parsed result objects
 */
export function parseResults(
  payload: Record<string, unknown>,
  skipValidation = false
): Result[] {
  const list = payload.list
  if (!isArray(list)) {
    return []
  }

  const results: Result[] = []

  for (const row of list) {
    if (!skipValidation) {
      const validation = validateResultRow(row)
      if (!validation.valid) {
        console.warn('Skipping invalid result row:', validation.error)
        continue
      }
    }

    const r = row as Record<string, unknown>
    results.push({
      rank: safeNumber(r.Rank, 0),
      bib: safeString(r.Bib).trim(),
      name: safeString(r.Name),
      familyName: safeString(r.FamilyName),
      givenName: safeString(r.GivenName),
      club: safeString(r.Club),
      nat: safeString(r.Nat),
      total: safeString(r.Total),
      pen: safeNumber(r.Pen, 0),
      behind: safeString(r.Behind).replaceAll('&nbsp;', ''),
    })
  }

  return results
}

/**
 * Parse competitor data from 'comp' or 'oncourse' message
 *
 * @param data - Single competitor data object
 * @returns Parsed competitor or null if data represents empty/no competitor
 */
export function parseCompetitor(data: Record<string, unknown>): OnCourseCompetitor | null {
  if (!data || !data.Bib || data.Bib === '') {
    return null
  }

  return {
    bib: safeString(data.Bib),
    name: safeString(data.Name),
    club: safeString(data.Club),
    nat: safeString(data.Nat),
    raceId: safeString(data.RaceId),
    time: safeString(data.Time),
    total: safeString(data.Total),
    pen: safeNumber(data.Pen, 0),
    gates: safeString(data.Gates),
    dtStart: data.dtStart ? safeString(data.dtStart) : null,
    dtFinish: data.dtFinish ? safeString(data.dtFinish) : null,
    ttbDiff: safeString(data.TTBDiff),
    ttbName: safeString(data.TTBName),
    rank: safeNumber(data.Rank, 0),
  }
}
