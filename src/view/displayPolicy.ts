/**
 * The board's display choices, in one place (CLIENT-OBLIGATIONS "c123-scoreboard": the board owns its
 * display policy; c123-scoreboard#170 lists the choices and their defaults).
 *
 * It holds what the walking skeleton needs. Marks, pairs and the Phase choice join in #161; durations
 * and the tick period of the display lifetimes in #162.
 *
 * Stated here without a setting, because the skeleton has only one way:
 * - Featured row (#170, choice 10): the first of the server's on-course order.
 * - Phase (#170, choice 9, built in #161): the single Phase the store holds.
 */
import type { BoardVisibility } from './boardView'

export interface DisplayPolicy {
  /** Which parts of the board are shown. Time of day is off: the contract does not carry it (#170, choice 12). */
  visibility: BoardVisibility
  /**
   * Run label of the title, `<event> <class> /N.` (#170, choice 5), by the Phase's `format` token.
   * A token not listed is shown verbatim.
   */
  runLabel: Readonly<Record<string, string>>
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
}
