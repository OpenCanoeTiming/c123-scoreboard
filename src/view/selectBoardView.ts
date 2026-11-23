/**
 * selectBoardView: the store's domain state -> what the board shows.
 *
 * Renders what the contract delivers: the shown Phase is chosen in `phaseChoice.ts`, its rows are its
 * Standing's entries as delivered (`results.ts`), the title's run label comes from `labels.ts`, the featured
 * row is the first of the server's on-course order. It computes no rank, merges nothing and detects no
 * finish (ADR-002). The connection state is the transport's, not the
 * store's, so the caller adds it.
 */
import type { Attempt, Observed } from '@opencanoetiming/c123-contract'
import type { Clock } from '../clock/clock'
import type { StoreState } from '../store/store'
import { formatName } from '../utils/formatName'
import type { BoardView, FeaturedRowView, TitleView } from './boardView'
import type { DisplayPolicy } from './displayPolicy'
import { runLabel } from './labels'
import { choosePhase } from './phaseChoice'
import { resultRows } from './results'

export type StoreBoardView = Omit<BoardView, 'connection'>

function known<T>(field: Observed<T> | undefined): T | null {
  return field?.state === 'known' ? field.value : null
}

const seconds = (s: number) => s.toFixed(2)

function entryName(state: StoreState, entryId: string | undefined): string {
  return formatName(entryId ? known(state.entries[entryId]?.displayName) : null)
}

function toFeatured(state: StoreState, attempt: Attempt): FeaturedRowView {
  const outcome = known(attempt.outcome)
  const time =
    outcome?.kind === 'running' ? seconds(outcome.elapsedSeconds) : outcome?.kind === 'duration' ? seconds(outcome.totalSeconds) : ''
  const pen = outcome?.kind === 'running' || outcome?.kind === 'duration' ? outcome.penaltySeconds : 0
  return {
    bib: attempt.bib,
    name: entryName(state, known(attempt.entry)?.entryId),
    gatePenalties: [],
    penalty: String(pen),
    hasPenalty: pen > 0,
    time,
    racing: known(attempt.status) === 'on-course',
    departing: false, // departing lifetime: #162
  }
}

export interface SelectOptions {
  /** `?category=`: the class the board is pinned to, or null */
  category?: string | null
}

/** The domain state as the board shows it, under `policy`. `clock` drives the display lifetimes (#162). */
export function selectBoardView(
  state: StoreState,
  policy: DisplayPolicy,
  clock: Clock,
  options: SelectOptions = {}
): StoreBoardView {
  void clock // no display lifetime yet (#162)
  const phase = choosePhase(state, options.category ?? null)
  const klass = phase ? state.classes[phase.classId] : undefined

  const title: TitleView = {
    event: state.event?.name ?? '',
    category: klass?.code ?? '',
    run: phase ? runLabel(phase, policy) : null,
  }

  const onCourse = state.onCourse.attemptIds.map((id) => state.attempts[id]).filter((a): a is Attempt => !!a)
  const first = onCourse[0]

  return {
    title,
    dayTime: '',
    visibility: policy.visibility,
    featured: first ? toFeatured(state, first) : null,
    rows: phase ? resultRows(state, phase, policy) : [],
    resultsScroll: {
      highlightBib: null, // highlight lifetime: #162
      someoneRacing: onCourse.some((a) => known(a.status) === 'on-course'),
    },
  }
}
