// The board's domain state and one pure function per input (CONTRACTS §1.6, §7.1, §7.2).
// No React, no time, no network: the caller fetches, buffers by seq and renders.
import type {
  Attempt,
  Class,
  ClassEntriesResponse,
  ClassPhasesResponse,
  ClassStandingsResponse,
  Course,
  EventCurrentResponse,
  OnCourseResponse,
  OnsiteEntry,
  OnsiteEvent,
  Phase,
  PhaseAttemptsResponse,
  Standing,
  Timestamp,
  WsMessage,
} from '@opencanoetiming/c123-contract'

export type OnCourseSet = {
  attemptIds: string[] // upstream's order, as delivered
  featuredByUpstream: string | null
  asOf: Timestamp | null
}

export type StoreState = {
  event: OnsiteEvent | null
  classes: Readonly<Record<string, Class>> // by classId
  courses: Readonly<Record<string, Course>> // by courseId
  phases: Readonly<Record<string, Phase>> // by phaseId
  entries: Readonly<Record<string, OnsiteEntry>> // by entryId
  attempts: Readonly<Record<string, Attempt>> // by attemptId, never by bib alone
  standings: Readonly<Record<string, Standing>> // by standingKey
  pendingPhaseIds: string[]
  onCourse: OnCourseSet
  appliedSeq: number // highest seq incorporated; only to skip what is already applied (§1.6)
  rehydrationNeeded: boolean // set by `event.changed` naming another eventId: everything was dropped (§7.2)
}

export function emptyStore(): StoreState {
  return {
    event: null,
    classes: {},
    courses: {},
    phases: {},
    entries: {},
    attempts: {},
    standings: {},
    pendingPhaseIds: [],
    onCourse: { attemptIds: [], featuredByUpstream: null, asOf: null },
    appliedSeq: 0,
    rehydrationNeeded: false,
  }
}

function byKey<T>(held: Readonly<Record<string, T>>, items: T[], key: (item: T) => string): Record<string, T> {
  const next = { ...held }
  for (const item of items) next[key(item)] = item
  return next
}

/** Applies one §7.1 hydration body, identified by its GET path. Paths the board does not hold are ignored. */
export function applyHydrationResponse(state: StoreState, path: string, body: unknown): StoreState {
  if (path === '/api/events/current') {
    const b = body as EventCurrentResponse
    return {
      ...state,
      event: b.event,
      classes: byKey(state.classes, b.classes, (c) => c.classId),
      courses: byKey(state.courses, b.courses, (c) => c.courseId),
      pendingPhaseIds: b.pendingPhaseIds,
    }
  }
  if (path === '/api/oncourse') {
    const b = body as OnCourseResponse
    return {
      ...state,
      attempts: byKey(state.attempts, b.attempts, (a) => a.attemptId),
      onCourse: { attemptIds: b.attempts.map((a) => a.attemptId), featuredByUpstream: b.featuredByUpstream, asOf: b.asOf },
    }
  }
  const m = /^\/api\/(classes|phases)\/[^/]+\/(phases|entries|standings|attempts)$/.exec(path)
  if (!m) return state
  const kind = `${m[1]}/${m[2]}`
  if (kind === 'classes/phases') {
    return { ...state, phases: byKey(state.phases, (body as ClassPhasesResponse).phases, (p) => p.phaseId) }
  }
  if (kind === 'classes/entries') {
    return { ...state, entries: byKey(state.entries, (body as ClassEntriesResponse).entries, (e) => e.entryId) }
  }
  if (kind === 'classes/standings') {
    return { ...state, standings: byKey(state.standings, (body as ClassStandingsResponse).standings, (s) => s.standingKey) }
  }
  if (kind === 'phases/attempts') {
    return { ...state, attempts: byKey(state.attempts, (body as PhaseAttemptsResponse).attempts, (a) => a.attemptId) }
  }
  return state
}

/**
 * Builds a fresh store from a hydration step: every body keyed by its GET path, and
 * `asOfSeq`, the smallest `asOfSeq` among them (§1.6 step 4).
 */
export function hydrate(responses: Readonly<Record<string, unknown>>, asOfSeq: number): StoreState {
  let state = emptyStore()
  for (const [path, body] of Object.entries(responses)) state = applyHydrationResponse(state, path, body)
  return { ...state, appliedSeq: asOfSeq }
}

// Per-field delta (§7.2): an omitted field is untouched; a delivered one, `not-yet` and `null`
// included, replaces the held value. The first message for an unknown id carries the whole resource.
function merge<T>(held: T | undefined, identity: Partial<T>, fields: Partial<T>): T {
  return { ...(held ?? identity), ...fields, ...identity } as T
}

type StandingScope = Standing['scope']

// Every Phase a Standing's scope names: a `pair` names both runs (§7.2).
function scopeNames(scope: StandingScope, phaseId: string): boolean {
  return scope.kind === 'pair' ? scope.firstPhaseId === phaseId || scope.secondPhaseId === phaseId : scope.phaseId === phaseId
}

// The Phase whose Attempts are a Standing's own rows: a `pair`'s are the second run's (§5, §7.2).
function ownPhase(scope: StandingScope): string {
  return scope.kind === 'pair' ? scope.secondPhaseId : scope.phaseId
}

function without<T>(held: Readonly<Record<string, T>>, drop: (item: T) => boolean): Record<string, T> {
  return Object.fromEntries(Object.entries(held).filter(([, item]) => !drop(item)))
}

/** Applies one `/ws` message (§7.2). A message with `seq` at or below `appliedSeq` is already incorporated. */
export function applyMessage(state: StoreState, msg: WsMessage): StoreState {
  if (msg.seq <= state.appliedSeq) return state
  const next = { ...state, appliedSeq: msg.seq }
  switch (msg.type) {
    case 'attempt.updated': {
      const id = msg.attemptId
      return { ...next, attempts: { ...state.attempts, [id]: merge<Attempt>(state.attempts[id], { attemptId: id }, msg.fields) } }
    }
    case 'phase.updated': {
      const id = msg.phaseId
      return { ...next, phases: { ...state.phases, [id]: merge<Phase>(state.phases[id], { phaseId: id }, msg.fields) } }
    }
    case 'entry.updated': {
      const id = msg.entryId
      return { ...next, entries: { ...state.entries, [id]: merge<OnsiteEntry>(state.entries[id], { entryId: id }, msg.fields) } }
    }
    case 'class.updated': {
      const id = msg.classId
      return { ...next, classes: { ...state.classes, [id]: merge<Class>(state.classes[id], { classId: id }, msg.fields) } }
    }
    case 'standing.updated':
      return { ...next, standings: { ...state.standings, [msg.standing.standingKey]: msg.standing } }
    case 'course.updated':
      return { ...next, courses: { ...state.courses, [msg.course.courseId]: msg.course } }
    case 'oncourse.updated':
      return {
        ...next,
        onCourse: { attemptIds: msg.attemptIds, featuredByUpstream: msg.featuredByUpstream, asOf: msg.asOf },
      }
    case 'scope.replaced': {
      // A replace, never a merge: what of the scope the message does not carry is removed.
      const scope = msg.scope
      const inScope = scope.kind === 'event' ? () => true : (id: string) => id === scope.phaseId
      const attempts = without(state.attempts, (a) => inScope(a.phaseId))
      const standings = without(state.standings, (s) =>
        scope.kind === 'event' ? true : scopeNames(s.scope, scope.phaseId),
      )
      return {
        ...next,
        attempts: byKey(attempts, msg.attempts, (a) => a.attemptId),
        standings: byKey(standings, msg.standings, (s) => s.standingKey),
      }
    }
    case 'attempt.deleted': {
      const removed = state.attempts[msg.attemptId]
      if (!removed) return next
      const attempts = without(state.attempts, (a) => a.attemptId === msg.attemptId)
      const entryId = removed.entry.state === 'known' ? removed.entry.value.entryId : null
      const standings: Record<string, Standing> = {}
      for (const [key, s] of Object.entries(state.standings)) {
        const holds = ownPhase(s.scope) === removed.phaseId && s.entries.some((e) => e.entryId === entryId)
        standings[key] = holds ? { ...s, entries: s.entries.filter((e) => e.entryId !== entryId) } : s
      }
      return { ...next, attempts, standings }
    }
    case 'phase.deleted': {
      const id = msg.phaseId
      return {
        ...next,
        phases: without(state.phases, (p) => p.phaseId === id),
        attempts: without(state.attempts, (a) => a.phaseId === id),
        standings: without(state.standings, (s) => scopeNames(s.scope, id)),
      }
    }
    case 'event.changed':
      if (state.event?.eventId === msg.event.eventId) return { ...next, event: msg.event }
      return { ...emptyStore(), appliedSeq: msg.seq, rehydrationNeeded: true }
    default:
      // write, sources, check, flag and diagnostics carry no board domain state.
      return next
  }
}
