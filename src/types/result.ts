/**
 * Result status for invalid results
 * - DNS: Did Not Start
 * - DNF: Did Not Finish
 * - DSQ: Disqualified
 */
export type ResultStatus = 'DNS' | 'DNF' | 'DSQ' | ''

/**
 * Result in the results list
 */
export interface Result {
  rank: number
  bib: string
  name: string
  familyName: string
  givenName: string
  club: string
  nat: string
  total: string
  pen: number
  behind: string
  /** Status for invalid results (DNS, DNF, DSQ). Empty string for valid results. */
  status?: ResultStatus
}
