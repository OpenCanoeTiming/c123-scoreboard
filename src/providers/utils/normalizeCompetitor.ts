import type { OnCourseCompetitor, CompMessage, TopRow, Result } from '@/types'

/**
 * Normalize CompMessage from CLI to OnCourseCompetitor
 *
 * @param comp - CompMessage from CLI
 * @returns Normalized OnCourseCompetitor
 */
export function normalizeCompetitor(comp: CompMessage): OnCourseCompetitor {
  return {
    bib: comp.Bib,
    name: comp.Name,
    club: comp.Club,
    nat: comp.Nat,
    raceId: comp.RaceId,
    time: comp.Time,
    total: comp.TotalTime,
    pen: comp.Pen,
    gates: comp.Gates,
    dtStart: comp.DTStart || null,
    dtFinish: comp.DTFinish || null,
    ttbDiff: comp.TTBDiff,
    ttbName: comp.TTBName,
    rank: comp.Rank,
  }
}

/**
 * Normalize TopRow from CLI to Result
 *
 * @param row - TopRow from CLI
 * @returns Normalized Result
 */
export function normalizeResult(row: TopRow): Result {
  return {
    rank: row.Rank,
    bib: row.Bib,
    name: `${row.FamilyName} ${row.GivenName}`.trim(),
    familyName: row.FamilyName,
    givenName: row.GivenName,
    club: row.Club,
    nat: row.Nat,
    total: row.Total,
    pen: row.Pen,
    behind: row.Behind,
  }
}

/**
 * Check if competitor data is empty/blank
 *
 * @param comp - CompMessage from CLI
 * @returns true if competitor is empty
 */
export function isEmptyCompetitor(comp: CompMessage): boolean {
  return !comp.Bib || comp.Bib === '' || comp.Bib === '0'
}
