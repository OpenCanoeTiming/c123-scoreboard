/**
 * The result rows of the shown Phase, as its Standing delivers them (CONTRACTS §5; CLIENT-OBLIGATIONS L41,
 * L68, L70, L71, L74, L84-L87, L165, L166). Delivered order and rank, nothing re-sorted or ranked;
 * time, penalty and `behindSeconds` as delivered; a no-result outcome shows its mark.
 *
 * A second run of a pair shows both runs, as today's vertical layout does: run 1 from the first Phase's
 * Attempt, run 2 from the Standing entry, joined by `entryId`; the highlighted run is `countingRun`; the
 * result is the combined one, `pairTotal`, never computed here. Before the sibling is known there is no
 * pair Standing and the Phase's own Standing is shown, with `pairTotal` from the Attempt.
 */
import type { Attempt, Observed, Outcome, Phase, Standing, StandingEntry } from '@opencanoetiming/c123-contract'
import type { StoreState } from '../store/store'
import { formatName } from '../utils/formatName'
import type { ResultRowView, TimeCellView } from './boardView'
import { classifyPenalty, type DisplayPolicy } from './displayPolicy'
import { noResultLabel } from './labels'

function known<T>(field: Observed<T> | undefined): T | null {
  return field?.state === 'known' ? field.value : null
}

const seconds = (s: number) => s.toFixed(2)

function emptyCell(kind: 'missing' | 'none'): TimeCellView {
  return { kind, text: kind === 'missing' ? '-' : '', penalty: '', penaltyKind: 'clear', penaltyLarge: false, underReview: false }
}

/** A run's own outcome as a cell. A Cross `ordinal` has no time to show (no Cross view, #170 choice 13). */
function outcomeCell(outcome: Outcome | null, underReview: boolean, policy: DisplayPolicy): TimeCellView {
  if (outcome === null) return emptyCell('none') // an untimed row: placement, no time (L70)
  switch (outcome.kind) {
    case 'duration':
      return {
        kind: 'time',
        text: seconds(outcome.totalSeconds),
        penalty: String(outcome.penaltySeconds),
        ...classifyPenalty(outcome.penaltySeconds, policy.penalty),
        underReview,
      }
    case 'no-result':
      return { ...emptyCell('none'), kind: 'status', text: noResultLabel(outcome.status, policy) }
    case 'pending':
    case 'running':
      return emptyCell('missing')
    default:
      return emptyCell('none')
  }
}

/** The combined result of a pair: a time without a penalty of its own. */
function totalCell(total: number, underReview: boolean): TimeCellView {
  return { ...emptyCell('none'), kind: 'time', text: seconds(total), underReview }
}

function wholeClass(state: StoreState, matches: (scope: Standing['scope']) => boolean): Standing | undefined {
  return Object.values(state.standings).find((s) => s.ageCategoryId === null && matches(s.scope))
}

/** A Phase's Attempts by the Entry they point at. */
function attemptsByEntry(state: StoreState, phaseId: string | null): Map<string, Attempt> {
  const byEntry = new Map<string, Attempt>()
  if (phaseId === null) return byEntry
  for (const attempt of Object.values(state.attempts)) {
    const entry = known(attempt.entry)
    if (attempt.phaseId === phaseId && entry) byEntry.set(entry.entryId, attempt)
  }
  return byEntry
}

function baseRow(state: StoreState, e: StandingEntry, result: TimeCellView): ResultRowView {
  return {
    bib: e.bib,
    rank: e.rank === null ? '' : `${e.rank}.`,
    name: formatName(known(state.entries[e.entryId]?.displayName)),
    result,
    behind: e.behindSeconds ? `+${seconds(e.behindSeconds)}` : '',
    runs: null,
    highlighted: false, // highlight lifetime: #162
    provisional: e.provisional, // carried, not rendered (#170, choice 1)
  }
}

export function resultRows(state: StoreState, phase: Phase, policy: DisplayPolicy): ResultRowView[] {
  const own = wholeClass(state, (s) => s.kind === 'phase' && s.phaseId === phase.phaseId)

  if (phase.pair?.role !== 'second') {
    return (own?.entries ?? []).map((e) => baseRow(state, e, outcomeCell(e.result, e.underReview, policy)))
  }

  const pair = wholeClass(state, (s) => s.kind === 'pair' && s.secondPhaseId === phase.phaseId)
  const standing = pair ?? own
  const firstRun = attemptsByEntry(state, pair?.scope.kind === 'pair' ? pair.scope.firstPhaseId : phase.pair.siblingPhaseId)
  const secondRun = attemptsByEntry(state, phase.phaseId)

  return (standing?.entries ?? []).map((e) => {
    const run1 = firstRun.get(e.entryId)
    const run2 = secondRun.get(e.entryId)
    const second = outcomeCell(e.result, e.underReview, policy)
    const total = e.pairTotalSeconds ?? known(run2?.pairTotal) ?? null
    return {
      ...baseRow(state, e, total === null ? second : totalCell(total, e.underReview)),
      runs: {
        first: run1 ? outcomeCell(known(run1.outcome), known(run1.underReview) ?? false, policy) : emptyCell('none'),
        second,
        better: known(run2?.countingRun) ?? null,
      },
    }
  })
}
