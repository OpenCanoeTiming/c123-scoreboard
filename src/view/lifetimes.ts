/**
 * The board's display lifetimes (CLIENT-OBLIGATIONS L38, L126, L168, L169; c123-scoreboard#170, choice 8).
 *
 * The board keeps one thing of its own: when it received the end of a run it saw on course. A finish is
 * only `status` becoming `finished` (L40), never a change in the running time; a run that ends in a mark
 * starts the departing row. Both are stamped with the injected Clock at receipt, never with a payload's
 * `observedAt`. A stamp lasts as long as the status it records: a contradicted finish, a retraction or a
 * re-run takes the status away, and with it the stamp, at once (L114, L116, L117; c123-server#309).
 * An Attempt already finished when first seen (a hydration) was not seen finishing and gets no stamp.
 */
import type { Attempt, AttemptStatus } from '@opencanoetiming/c123-contract'
import type { StoreState } from '../store/store'

export type Lifetimes = Readonly<{
  /** Receipt of `status` becoming `finished`, by attemptId, on the board's Clock */
  finishedAt: Readonly<Record<string, number>>
  /** Receipt of a mark ending a run seen on course, by attemptId, on the board's Clock */
  markedAt: Readonly<Record<string, number>>
}>

export const emptyLifetimes: Lifetimes = { finishedAt: {}, markedAt: {} }

const LIFECYCLE: ReadonlySet<AttemptStatus> = new Set<AttemptStatus>([
  'not-started',
  'at-start',
  'on-course',
  'left-without-finish',
  'finished',
])

export function statusOf(attempt: Attempt | undefined): AttemptStatus | null {
  return attempt?.status.state === 'known' ? attempt.status.value : null
}

/** A result mark (CONTRACTS §2.6, `ResultMark`): every status that is not a lifecycle state. */
export function isMark(status: AttemptStatus | null): boolean {
  return status !== null && !LIFECYCLE.has(status)
}

/** The lifetimes after the store moved from `before` to `after`, received at `now`. */
export function observeLifetimes(prev: Lifetimes, before: StoreState | null, after: StoreState, now: number): Lifetimes {
  const finishedAt: Record<string, number> = {}
  const markedAt: Record<string, number> = {}
  for (const [id, attempt] of Object.entries(after.attempts)) {
    const status = statusOf(attempt)
    const wasOnCourse = statusOf(before?.attempts[id]) === 'on-course'
    if (status === 'finished') {
      const at = prev.finishedAt[id] ?? (wasOnCourse ? now : undefined)
      if (at !== undefined) finishedAt[id] = at
    } else if (isMark(status)) {
      const at = prev.markedAt[id] ?? (wasOnCourse ? now : undefined)
      if (at !== undefined) markedAt[id] = at
    }
  }
  return { finishedAt, markedAt }
}

/** The stamps still within `ms` at `now`, the latest first. */
export function within(stamps: Readonly<Record<string, number>>, ms: number, now: number): string[] {
  return Object.entries(stamps)
    .filter(([, at]) => now - at < ms)
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => id)
}

/** Whether any lifetime is still running at `now`, so the board must keep ticking. */
export function anyOpen(lifetimes: Lifetimes, longestMs: number, now: number): boolean {
  return within(lifetimes.finishedAt, longestMs, now).length > 0 || within(lifetimes.markedAt, longestMs, now).length > 0
}
