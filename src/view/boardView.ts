/**
 * BoardView - what the scoreboard shows, as display strings and flags.
 *
 * Components render only this type. A producer fills it: today the legacy
 * adapter (`legacyAdapter.ts`), later the selector over the contract store.
 * Nothing here is a copy of a wire or reducer type; every field is something
 * a component puts on screen or a flag that picks how it is put there.
 */

/** State of the connection dot. */
export type ConnectionView = 'live' | 'connecting' | 'reconnecting' | 'error' | 'disconnected'

/** Title line: `<event> <category>/<run>.` */
export interface TitleView {
  /** Event name */
  event: string
  /** Class label as shown, e.g. "K1M"; empty when unknown */
  category: string
  /** Run label without decoration, e.g. "1"; null when not shown */
  run: string | null
}

/** Penalty weight, picks the colour of a penalty value. */
export type PenaltyKind = 'clear' | 'touch' | 'miss'

/** A gate where the athlete took a penalty. */
export interface GatePenaltyView {
  /** Gate number as shown */
  gate: number
  /** touch = 2 s, miss = 50 s */
  kind: 'touch' | 'miss'
}

/**
 * A time cell of a result row.
 * - time: a time with its penalty
 * - status: a no-result mark (DNS, DNF, DSQ) in `text`
 * - missing: a run without a time yet, shown as "-"
 * - none: nothing to show
 */
export interface TimeCellView {
  kind: 'time' | 'status' | 'missing' | 'none'
  /** Time, status mark, "-" or empty */
  text: string
  /** Penalty seconds as shown, e.g. "0", "52" */
  penalty: string
  penaltyKind: PenaltyKind
  /** Penalty needs three digits (100 s and more) */
  penaltyLarge: boolean
  /** Under review: shown with a star */
  underReview: boolean
}

/** One row of the results table. */
export interface ResultRowView {
  bib: string
  /** Rank as shown, e.g. "1."; empty for a row without a result */
  rank: string
  name: string
  /** The result: kind time, status or none */
  result: TimeCellView
  /** Gap to the leader as shown, e.g. "+1.23"; empty when none */
  behind: string
  /** Both runs of a best-run race; null when the race shows one result */
  runs: { first: TimeCellView; second: TimeCellView; better: 1 | 2 | null } | null
  /** The row of the athlete who just finished */
  highlighted: boolean
  /** Judges are still entering this result. Not rendered yet (#170, choice 1). */
  provisional: boolean
}

/** An athlete on course. */
export interface OnCourseRowView {
  bib: string
  name: string
  gatePenalties: GatePenaltyView[]
  /** Total penalty seconds as shown */
  penalty: string
  hasPenalty: boolean
  /** Running or final time as shown */
  time: string
  /** Started and has a running time */
  racing: boolean
}

/** The featured on-course row above the results. */
export interface FeaturedRowView extends OnCourseRowView {
  /** The athlete has just finished or left the course */
  departing: boolean
}

/** Which parts of the board are shown. */
export interface BoardVisibility {
  topBar: boolean
  title: boolean
  dayTime: boolean
  featured: boolean
  results: boolean
  footer: boolean
}

export interface BoardView {
  connection: ConnectionView
  title: TitleView
  /** Time of day as shown */
  dayTime: string
  visibility: BoardVisibility
  /** The featured on-course row, or null */
  featured: FeaturedRowView | null
  rows: ResultRowView[]
}
