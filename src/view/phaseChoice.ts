/**
 * Which Phase the board shows (CLIENT-OBLIGATIONS L73; c123-scoreboard#170, choice 9). The server names no
 * current race. One Phase at a time, no cycling:
 * - the Phase of the first Attempt the board counts as on course (`onCourse.ts`: not at the start, of the
 *   pinned class), in the server's order;
 * - with nobody on course, the Phase of the most recently changed whole-class Standing (`asOf`);
 * - `?category=` pins a class: only its Phases are candidates.
 * Only held Phases are candidates: an on-course Attempt whose Phase is not held yet is passed over (L104).
 * The choice is made afresh from every state, so a deleted Phase falls back to the same rule.
 */
import type { Attempt, Phase, Standing } from '@opencanoetiming/c123-contract'
import type { StoreState } from '../store/store'

/** The Phase whose rows a Standing holds: a pair's are the second run's (CONTRACTS §5). */
function standingPhaseId(scope: Standing['scope']): string {
  return scope.kind === 'pair' ? scope.secondPhaseId : scope.phaseId
}

export function choosePhase(state: StoreState, category: string | null, onCourse: readonly Attempt[]): Phase | null {
  const candidate = (phaseId: string): Phase | null => {
    const phase = state.phases[phaseId]
    return phase && (category === null || phase.classId === category) ? phase : null
  }

  for (const attempt of onCourse) {
    const phase = candidate(attempt.phaseId)
    if (phase) return phase
  }

  let latest: { phase: Phase; at: number } | null = null
  for (const standing of Object.values(state.standings)) {
    if (standing.ageCategoryId !== null || standing.scope.kind === 'classification') continue
    const phase = candidate(standingPhaseId(standing.scope))
    const at = Date.parse(standing.asOf)
    if (phase && (latest === null || at > latest.at)) latest = { phase, at }
  }
  return latest?.phase ?? null
}
