/**
 * The board's display choices, in one place (CLIENT-OBLIGATIONS "c123-scoreboard": the board owns its
 * display policy; c123-scoreboard#170 lists the choices and their defaults).
 *
 * The display lifetimes (#170, choice 8) take over the values of `src/context/constants.ts`, which the legacy
 * path keeps until #168. Each is read through the injected Clock and re-evaluated on a tick of
 * `TICK_PERIOD_MS`, so a lifetime ends no later than one period after its deadline (CLIENT-OBLIGATIONS L121).
 *
 * Stated here without a setting, because the board has only one way:
 * - Provisional result (#170, choice 1): no mark; the row carries the flag.
 * - Under review (#170, choice 2): `*` at the result, drawn by the components.
 * - Several races at once (#170, choice 9): one Phase, chosen in `phaseChoice.ts`; `?category=` pins a class.
 * - Featured row (#170, choice 10): the first of the server's on-course order; the start queue (`at-start`)
 *   is not on course, and `?category=` limits the featured row to the pinned class (#182).
 * - Running time (#170, choice 7): shown as delivered, never ticked locally.
 * - Leaving without a finish (#170, choice 3): off the on-course row at once, no label, no departing row.
 * - A withdrawn finish (#170, choice 11; c123-server#309): shown and withdrawn as stated, no smoothing.
 */
import type { Outcome } from '@opencanoetiming/c123-contract'
import type { BoardVisibility, PenaltyKind } from './boardView'

/** A finisher stays on top of the board, from the receipt of `status` becoming `finished`. */
export const FINISH_DISPLAY_DURATION = 8000
/** A finisher counts as on course (the Phase choice), from the same receipt; never from leaving the set. */
export const FINISHED_GRACE_PERIOD = 5000
/** The finisher's result row is highlighted, from the same receipt. */
export const HIGHLIGHT_DURATION = 5000
/** An athlete whose run on course ends in a mark stays on the row as departing, from the mark's receipt. */
export const DEPARTING_TIMEOUT = 3000
/** The Clock tick on which the lifetimes are re-evaluated while one is open. */
export const TICK_PERIOD_MS = 250

export type NoResultStatus = Extract<Outcome, { kind: 'no-result' }>['status']

export interface DisplayPolicy {
  /** Which parts of the board are shown. Time of day is off: the contract does not carry it (#170, choice 12). */
  visibility: BoardVisibility
  /**
   * Run label of the title, `<event> <class> /N.` (#170, choice 5), by the Phase's `format` token.
   * A token not listed is shown verbatim, paired or not (CONTRACTS §2.4).
   */
  runLabel: Readonly<Record<string, string>>
  /** No-result marks (#170, choice 4). */
  noResultMark: Readonly<Record<NoResultStatus, string>>
  /** Penalty colour: up to `touchUpTo` seconds a touch, more a miss; three digits from `largeFrom`. */
  penalty: { touchUpTo: number; largeFrom: number }
  /** Display lifetimes in milliseconds, and the tick period they are re-evaluated on. */
  lifetimes: { finishDisplayMs: number; finishedGraceMs: number; highlightMs: number; departingMs: number; tickPeriodMs: number }
}

export const displayPolicy: DisplayPolicy = {
  visibility: {
    topBar: true,
    title: true,
    dayTime: false,
    featured: true,
    results: true,
    footer: true,
  },
  runLabel: { BR1: '1', BR2: '2' },
  noResultMark: {
    dns: 'DNS',
    dnf: 'DNF',
    dsq: 'DSQ',
    'dsq-r': 'DSQ-R',
    dqb: 'DQB',
    cap: 'CAP',
    ral: 'RAL',
    other: 'OTHER',
  },
  penalty: { touchUpTo: 4, largeFrom: 100 },
  lifetimes: {
    finishDisplayMs: FINISH_DISPLAY_DURATION,
    finishedGraceMs: FINISHED_GRACE_PERIOD,
    highlightMs: HIGHLIGHT_DURATION,
    departingMs: DEPARTING_TIMEOUT,
    tickPeriodMs: TICK_PERIOD_MS,
  },
}

/** The colour and width of a penalty value, shared by every producer of a BoardView. */
export function classifyPenalty(
  seconds: number,
  thresholds: DisplayPolicy['penalty'] = displayPolicy.penalty
): { penaltyKind: PenaltyKind; penaltyLarge: boolean } {
  return {
    penaltyKind: seconds === 0 ? 'clear' : seconds <= thresholds.touchUpTo ? 'touch' : 'miss',
    penaltyLarge: seconds >= thresholds.largeFrom,
  }
}
