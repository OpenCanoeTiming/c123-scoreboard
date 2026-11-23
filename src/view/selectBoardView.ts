/**
 * selectBoardView: the store's domain state -> what the board shows.
 *
 * Renders what the contract delivers: rows are a Standing's entries in their delivered order with their
 * delivered rank, the featured row is the first of the server's on-course order. It computes no rank,
 * merges nothing and detects no finish (ADR-002). The connection state is the transport's, not the
 * store's, so the caller adds it.
 */
import type { Attempt, Observed, Outcome, StandingEntry } from '@opencanoetiming/c123-contract'
import type { Clock } from '../clock/clock'
import type { StoreState } from '../store/store'
import { formatName } from '../utils/formatName'
import type { BoardView, FeaturedRowView, ResultRowView, TimeCellView, TitleView } from './boardView'
import type { DisplayPolicy } from './displayPolicy'

export type StoreBoardView = Omit<BoardView, 'connection'>

function known<T>(field: Observed<T> | undefined): T | null {
  return field?.state === 'known' ? field.value : null
}

const seconds = (s: number) => s.toFixed(2)

function noTime(): TimeCellView {
  return { kind: 'none', text: '', penalty: '', penaltyKind: 'clear', penaltyLarge: false, underReview: false }
}

function resultCell(result: Outcome | null, underReview: boolean): TimeCellView {
  if (result?.kind !== 'duration') return noTime() // marks: #161
  const pen = result.penaltySeconds
  return {
    kind: 'time',
    text: seconds(result.totalSeconds),
    penalty: String(pen),
    penaltyKind: pen === 0 ? 'clear' : pen <= 4 ? 'touch' : 'miss',
    penaltyLarge: pen >= 100,
    underReview,
  }
}

function entryName(state: StoreState, entryId: string | undefined): string {
  return formatName(entryId ? known(state.entries[entryId]?.displayName) : null)
}

function toRow(state: StoreState, e: StandingEntry): ResultRowView {
  return {
    bib: e.bib,
    rank: e.rank === null ? '' : `${e.rank}.`,
    name: entryName(state, e.entryId),
    result: resultCell(e.result, e.underReview),
    behind: e.behindSeconds ? `+${seconds(e.behindSeconds)}` : '',
    runs: null,
    highlighted: false, // highlight lifetime: #162
    provisional: e.provisional,
  }
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

/** The domain state as the board shows it, under `policy`. `clock` drives the display lifetimes (#162). */
export function selectBoardView(state: StoreState, policy: DisplayPolicy, clock: Clock): StoreBoardView {
  void clock // no display lifetime yet (#162)
  const phase = Object.values(state.phases)[0] // the single Phase; the Phase choice is #161
  const klass = phase ? state.classes[phase.classId] : undefined

  const title: TitleView = {
    event: state.event?.name ?? '',
    category: klass?.code ?? '',
    run: phase ? (policy.runLabel[phase.format] ?? phase.format) : null,
  }

  const standing = phase
    ? Object.values(state.standings).find(
        (s) => s.scope.kind === 'phase' && s.scope.phaseId === phase.phaseId && s.ageCategoryId === null
      )
    : undefined

  const onCourse = state.onCourse.attemptIds.map((id) => state.attempts[id]).filter((a): a is Attempt => !!a)
  const first = onCourse[0]

  return {
    title,
    dayTime: '',
    visibility: policy.visibility,
    featured: first ? toFeatured(state, first) : null,
    rows: standing ? standing.entries.map((e) => toRow(state, e)) : [],
    resultsScroll: {
      highlightBib: null, // highlight lifetime: #162
      someoneRacing: onCourse.some((a) => known(a.status) === 'on-course'),
    },
  }
}
