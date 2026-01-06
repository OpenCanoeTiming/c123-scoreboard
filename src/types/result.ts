/**
 * Result status for invalid results
 * - DNS: Did Not Start
 * - DNF: Did Not Finish
 * - DSQ: Disqualified
 */
export type ResultStatus = 'DNS' | 'DNF' | 'DSQ' | ''

/**
 * Single run result data for merged BR1/BR2 display
 */
export interface RunResult {
  /** Total time in seconds (e.g., "78.99") */
  total?: string
  /** Penalty seconds */
  pen?: number
  /** Rank for this run */
  rank?: number
  /** Status for invalid results */
  status?: ResultStatus
}

/**
 * Result in the results list
 *
 * For single-run races, only the base fields are used.
 * For BR1/BR2 merged display, run1, run2, and bestRun fields are populated.
 */
export interface Result {
  rank: number
  bib: string
  name: string
  familyName: string
  givenName: string
  club: string
  nat: string
  /** Total time - for BR2 races this is BEST of both runs! */
  total: string
  pen: number
  behind: string
  /** Status for invalid results (DNS, DNF, DSQ). Empty string for valid results. */
  status?: ResultStatus

  // === Raw BR2 time for calculating BR2 total (time + pen) ===
  /** BR2 time without penalty (only set during BR2 races) */
  time?: string

  // === Merged BR1/BR2 fields (optional, only for merged view) ===

  /** First run (BR1) result data */
  run1?: RunResult
  /** Second run (BR2) result data */
  run2?: RunResult
  /** Which run had the best time (1 or 2) */
  bestRun?: 1 | 2

  // === Raw BR1 data from C123 (centiseconds, for BR2 calculation) ===
  /** BR1 time in centiseconds */
  prevTime?: number
  /** BR1 penalty in seconds */
  prevPen?: number
  /** BR1 total in centiseconds */
  prevTotal?: number
  /** Which run was better: 1 or 2 (from C123) */
  betterRunNr?: number
}
