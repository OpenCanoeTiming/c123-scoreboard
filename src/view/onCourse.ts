/**
 * The on-course side of the board (CONTRACTS §2.6, §7.1; CLIENT-OBLIGATIONS L62-L64, L67, L75, L77, L96,
 * L145, L161, L167-L169; c123-scoreboard#170, choices 3, 7, 8, 10, 11).
 *
 * The on-course set is upstream's list, in the server's order. Who the board counts as on course is its
 * own policy on top of it:
 * - an Attempt of the set whose run has not ended: not finished, no mark, not `left-without-finish`
 *   (the last leaves the row at once, with no label), and not `at-start` (the start queue is not on
 *   course, #182);
 * - a finisher for `finishedGraceMs` from the receipt of its finish, listed or not: never from the
 *   Attempt leaving the set, which is upstream's closure.
 *
 * The featured row: the latest finisher for `finishDisplayMs`; else the first Attempt counted on course;
 * else, for `departingMs`, an athlete whose run on course ended in a mark. Time and penalty are shown as
 * delivered and never ticked; with `?category=` every part of it considers only Attempts of the pinned
 * class (#182); gate penalties come from `gates`, a gate not judged (`null`) shows nothing.
 */
import type { Attempt, Gate, Observed } from '@opencanoetiming/c123-contract'
import type { StoreState } from '../store/store'
import { formatName } from '../utils/formatName'
import type { FeaturedRowView, GatePenaltyView } from './boardView'
import type { DisplayPolicy } from './displayPolicy'
import { isMark, statusOf, within, type Lifetimes } from './lifetimes'

function known<T>(field: Observed<T> | undefined): T | null {
  return field?.state === 'known' ? field.value : null
}

/** Upstream's running display: whole seconds while running, decimals during a split hold (DERIVATIONS §4.3). */
const asDelivered = (s: number) => (Number.isInteger(s) ? String(s) : s.toFixed(2))
const seconds = (s: number) => s.toFixed(2)

function runEnded(attempt: Attempt): boolean {
  const status = statusOf(attempt)
  return status === 'finished' || status === 'left-without-finish' || isMark(status)
}

/** Whether the athlete is accruing a time: `outcome.kind` is `running` (L62). */
export function isRunning(attempt: Attempt): boolean {
  return known(attempt.outcome)?.kind === 'running'
}

/** Whether the Attempt is of the pinned class; a Phase not held cannot be told, so it is not. No pin: all. */
function inCategory(state: StoreState, category: string | null, attempt: Attempt): boolean {
  return category === null || state.phases[attempt.phaseId]?.classId === category
}

/** The Attempts the board counts as on course, in the server's order; finishers in their grace period last. */
export function countedOnCourse(
  state: StoreState,
  lifetimes: Lifetimes,
  policy: DisplayPolicy,
  now: number,
  category: string | null = null
): Attempt[] {
  const listed = state.onCourse.attemptIds
    .map((id) => state.attempts[id])
    .filter((a): a is Attempt => !!a && !runEnded(a) && statusOf(a) !== 'at-start' && inCategory(state, category, a))
  const finishers = within(lifetimes.finishedAt, policy.lifetimes.finishedGraceMs, now)
    .reverse()
    .map((id) => state.attempts[id])
    .filter((a): a is Attempt => !!a && inCategory(state, category, a))
  return [...listed, ...finishers]
}

/** Penalised gates as the components draw them; 0 and not judged (`null`) show nothing. */
function gatePenalties(gates: Gate[] | null, policy: DisplayPolicy): GatePenaltyView[] {
  return (gates ?? [])
    .filter((g): g is Gate & { penalty: number } => g.penalty !== null && g.penalty > 0)
    .map((g) => ({ gate: g.number, kind: g.penalty <= policy.penalty.touchUpTo ? 'touch' : 'miss' }))
}

function toFeatured(state: StoreState, attempt: Attempt, departing: boolean, policy: DisplayPolicy): FeaturedRowView {
  const outcome = known(attempt.outcome)
  const time =
    outcome?.kind === 'running' ? asDelivered(outcome.elapsedSeconds) : outcome?.kind === 'duration' ? seconds(outcome.totalSeconds) : ''
  const pen = outcome?.kind === 'running' || outcome?.kind === 'duration' ? outcome.penaltySeconds : 0
  const entryId = known(attempt.entry)?.entryId
  return {
    bib: attempt.bib,
    name: formatName(entryId ? known(state.entries[entryId]?.displayName) : null),
    gatePenalties: gatePenalties(known(attempt.gates), policy),
    penalty: String(pen),
    hasPenalty: pen > 0,
    time,
    racing: isRunning(attempt),
    departing,
  }
}

export function featuredRow(
  state: StoreState,
  onCourse: Attempt[],
  lifetimes: Lifetimes,
  policy: DisplayPolicy,
  now: number,
  category: string | null = null
): FeaturedRowView | null {
  const finisher = within(lifetimes.finishedAt, policy.lifetimes.finishDisplayMs, now)
    .map((id) => state.attempts[id])
    .find((a) => !!a && inCategory(state, category, a))
  if (finisher) return toFeatured(state, finisher, true, policy)

  const first = onCourse.find((a) => !runEnded(a))
  if (first) return toFeatured(state, first, false, policy)

  const marked = within(lifetimes.markedAt, policy.lifetimes.departingMs, now)
    .map((id) => state.attempts[id])
    .find((a) => !!a && inCategory(state, category, a))
  return marked ? toFeatured(state, marked, true, policy) : null
}

/** The bib of the shown Phase's row to highlight: the latest finisher of that Phase within `highlightMs`. */
export function highlightBib(state: StoreState, phaseId: string | null, lifetimes: Lifetimes, policy: DisplayPolicy, now: number): string | null {
  if (phaseId === null) return null
  const id = within(lifetimes.finishedAt, policy.lifetimes.highlightMs, now).find((a) => state.attempts[a]?.phaseId === phaseId)
  return id ? state.attempts[id].bib : null
}
