/**
 * The board's display choices, in one place (CLIENT-OBLIGATIONS "c123-scoreboard": the board owns its
 * display policy; c123-scoreboard#170 lists the choices and their defaults).
 *
 * Durations and the tick period of the display lifetimes join in #162.
 *
 * Stated here without a setting, because the board has only one way:
 * - Provisional result (#170, choice 1): no mark; the row carries the flag.
 * - Under review (#170, choice 2): `*` at the result, drawn by the components.
 * - Several races at once (#170, choice 9): one Phase, chosen in `phaseChoice.ts`; `?category=` pins a class.
 * - Featured row (#170, choice 10): the first of the server's on-course order.
 */
import type { Outcome } from '@opencanoetiming/c123-contract'
import type { BoardVisibility, PenaltyKind } from './boardView'

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
