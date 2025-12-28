/**
 * Competitor currently on course
 */
export interface OnCourseCompetitor {
  bib: string
  name: string
  club: string
  nat: string
  raceId: string

  // Times
  time: string // Running or final time
  total: string // Total time with penalties
  pen: number // Total penalty seconds

  // Gates - "0,0,2,0,50,..." or "0 0 2 0 50 ..."
  gates: string

  // Checkpoint timestamps
  dtStart: string | null
  dtFinish: string | null // KEY for finish detection

  // TTB (Time To Beat)
  ttbDiff: string
  ttbName: string
  rank: number
}
