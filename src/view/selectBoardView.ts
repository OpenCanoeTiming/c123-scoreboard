/**
 * selectBoardView: the store's domain state -> what the board shows.
 *
 * Renders what the contract delivers: the shown Phase is chosen in `phaseChoice.ts`, its rows are its
 * Standing's entries as delivered (`results.ts`), the title's run label comes from `labels.ts`, the on-course
 * side and the featured row come from `onCourse.ts`. It computes no rank, merges nothing and detects no
 * finish (ADR-002): a finish is `status` becoming `finished`, stamped in `lifetimes.ts`, and every display
 * lifetime is evaluated against the injected Clock. The connection state is the transport's, not the
 * store's, so the caller adds it.
 */
import type { Clock } from '../clock/clock'
import type { StoreState } from '../store/store'
import type { BoardView, TitleView } from './boardView'
import type { DisplayPolicy } from './displayPolicy'
import { runLabel } from './labels'
import { emptyLifetimes, type Lifetimes } from './lifetimes'
import { countedOnCourse, featuredRow, highlightBib, isRunning } from './onCourse'
import { choosePhase } from './phaseChoice'
import { resultRows } from './results'

export type StoreBoardView = Omit<BoardView, 'connection'>

export interface SelectOptions {
  /** `?category=`: the class the board is pinned to, or null */
  category?: string | null
  /** The board's receipt stamps (`observeLifetimes`); none by default */
  lifetimes?: Lifetimes
}

/** The domain state as the board shows it, under `policy`, at `clock.now()`. */
export function selectBoardView(
  state: StoreState,
  policy: DisplayPolicy,
  clock: Clock,
  options: SelectOptions = {}
): StoreBoardView {
  const now = clock.now()
  const lifetimes = options.lifetimes ?? emptyLifetimes
  const onCourse = countedOnCourse(state, lifetimes, policy, now)
  const phase = choosePhase(state, options.category ?? null, onCourse)
  const klass = phase ? state.classes[phase.classId] : undefined

  const title: TitleView = {
    event: state.event?.name ?? '',
    category: klass?.code ?? '',
    run: phase ? runLabel(phase, policy) : null,
  }

  const highlight = highlightBib(state, phase?.phaseId ?? null, lifetimes, policy, now)
  const rows = phase ? resultRows(state, phase, policy).map((r) => (r.bib === highlight ? { ...r, highlighted: true } : r)) : []

  return {
    title,
    dayTime: '',
    visibility: policy.visibility,
    featured: featuredRow(state, onCourse, lifetimes, policy, now),
    rows,
    resultsScroll: {
      highlightBib: rows.some((r) => r.highlighted) ? highlight : null,
      someoneRacing: onCourse.some(isRunning),
    },
  }
}
