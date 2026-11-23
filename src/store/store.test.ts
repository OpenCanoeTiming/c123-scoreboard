import { describe, expect, it } from 'vitest'
import type {
  Attempt,
  Class,
  ClassEntriesResponse,
  ClassPhasesResponse,
  ClassStandingsResponse,
  Course,
  EventCurrentResponse,
  Observed,
  OnCourseResponse,
  OnsiteEntry,
  Phase,
  PhaseAttemptsResponse,
  Standing,
  WsMessage,
} from '@opencanoetiming/c123-contract'
import { applyHydrationResponse, applyMessage, emptyStore, hydrate } from './store'

// Every fixture below is written from CONTRACTS §1.6, §7.1 and §7.2 (synthetic, no recording).

const AT = '2026-09-15T10:14:02.083Z'
const NOT_YET = { state: 'not-yet' } as const
const NA = { state: 'unavailable', reason: 'not-applicable' } as const

function known<T>(value: T, extra: Partial<{ source: 'tcp' | 'xml' | 'operator-write'; provisional: boolean }> = {}): Observed<T> {
  return {
    state: 'known',
    value,
    observedAt: AT,
    source: extra.source ?? 'tcp',
    confidence: 'authoritative',
    provisional: extra.provisional ?? false,
  }
}

const PHASE_1 = 'K1M_BR1_5'
const PHASE_2 = 'K1M_BR2_6'

function attempt(phaseId: string, bib: string, over: Partial<Attempt> = {}): Attempt {
  return {
    attemptId: `${phaseId}:${bib}`,
    phaseId,
    bib,
    entry: known({ entryId: `E${bib}` }),
    run: known(1),
    startOrder: known(Number(bib)),
    scheduledStart: NOT_YET,
    heat: NA,
    startLane: NA,
    status: known('not-started'),
    outcome: known({ kind: 'pending' }),
    gates: NOT_YET,
    splits: NA,
    faults: NA,
    courseOrder: NOT_YET,
    timeToBeat: NOT_YET,
    placement: NOT_YET,
    pairTotal: NA,
    countingRun: NA,
    underReview: known(false),
    qualified: NA,
    ...over,
  }
}

function phase(phaseId: string, over: Partial<Phase> = {}): Phase {
  return {
    phaseId,
    classId: 'K1M',
    format: 'BR1',
    kind: 'race',
    scoringKind: 'duration',
    pair: null,
    heats: false,
    stage: 'run',
    date: '2026-09-15',
    courseId: known('1', { source: 'xml' }),
    scheduledStart: NOT_YET,
    programmeOrder: known(5),
    title: NOT_YET,
    status: known('scheduled'),
    ...over,
  }
}

function entry(entryId: string, over: Partial<OnsiteEntry> = {}): OnsiteEntry {
  return {
    entryId,
    classId: 'K1M',
    displayName: known('NOVAK Jan'),
    members: known([{ givenName: 'Jan', familyName: 'Novak', externalId: null, birthYear: 2001 }]),
    club: known('Club A'),
    nation: known('CZE'),
    ageCategoryId: NA,
    eventBib: NA,
    isTeam: known(false),
    ...over,
  }
}

const K1M: Class = {
  classId: 'K1M',
  eventId: 'ev1',
  code: 'K1M',
  name: known('K1 Men'),
  discipline: 'slalom',
  ageCategories: known([]),
}

function course(courseId: string, layout: string): Course {
  return {
    courseId,
    eventId: 'ev1',
    layout: known(layout, { source: 'xml' }),
    gates: NOT_YET,
    slots: NOT_YET,
    sectorEndsAfterGate: NOT_YET,
    splitsAfterGate: NOT_YET,
    captions: NOT_YET,
  }
}

function standing(standingKey: string, entries: Standing['entries']): Standing {
  return {
    standingKey,
    classId: 'K1M',
    scope: { kind: 'phase', phaseId: PHASE_1 },
    ageCategoryId: null,
    asOf: AT,
    entries,
    anomalies: [],
  }
}

function row(entryId: string, bib: string, rank: number | null): Standing['entries'][number] {
  return {
    entryId,
    bib,
    rank,
    order: rank,
    result: { kind: 'pending' },
    behindSeconds: null,
    provisional: false,
    underReview: false,
  }
}

function hydrated(): ReturnType<typeof hydrate> {
  const current: EventCurrentResponse = {
    asOfSeq: 1040,
    event: { eventId: 'ev1', name: 'Spring Slalom', details: NOT_YET },
    classes: [K1M],
    courses: [course('1', 'DUDDU')],
    pendingPhaseIds: [],
  }
  const phases: ClassPhasesResponse = { asOfSeq: 1040, phases: [phase(PHASE_1), phase(PHASE_2, { format: 'BR2' })] }
  const entries: ClassEntriesResponse = { asOfSeq: 1040, entries: [entry('E9'), entry('E12')] }
  const attempts1: PhaseAttemptsResponse = { asOfSeq: 1040, attempts: [attempt(PHASE_1, '9'), attempt(PHASE_1, '12')] }
  const attempts2: PhaseAttemptsResponse = { asOfSeq: 1040, attempts: [attempt(PHASE_2, '9')] }
  const standings: ClassStandingsResponse = { asOfSeq: 1040, standings: [standing('phase:K1M_BR1_5/all', [row('E9', '9', 1)])] }
  const oncourse: OnCourseResponse = {
    asOfSeq: 1040,
    attempts: [attempt(PHASE_1, '12', { courseOrder: known(1) })],
    featuredByUpstream: null,
    asOf: AT,
  }
  return hydrate(
    {
      '/api/events/current': current,
      '/api/classes/K1M/phases': phases,
      '/api/classes/K1M/entries': entries,
      [`/api/phases/${PHASE_1}/attempts`]: attempts1,
      [`/api/phases/${PHASE_2}/attempts`]: attempts2,
      '/api/classes/K1M/standings': standings,
      '/api/oncourse': oncourse,
    },
    1040,
  )
}

describe('hydration (CONTRACTS §7.1)', () => {
  it('holds every resource of the hydration bodies, keyed by its id', () => {
    const s = hydrated()
    expect(s.event?.eventId).toBe('ev1')
    expect(Object.keys(s.classes)).toEqual(['K1M'])
    expect(Object.keys(s.courses)).toEqual(['1'])
    expect(Object.keys(s.phases).sort()).toEqual([PHASE_1, PHASE_2])
    expect(Object.keys(s.entries).sort()).toEqual(['E12', 'E9'])
    expect(Object.keys(s.standings)).toEqual(['phase:K1M_BR1_5/all'])
    expect(s.onCourse).toEqual({ attemptIds: [`${PHASE_1}:12`], featuredByUpstream: null, asOf: AT })
    expect(s.attempts[`${PHASE_1}:12`].courseOrder).toEqual(known(1))
    expect(s.appliedSeq).toBe(1040)
  })

  it('keys Attempts by attemptId, never by bib alone: bib 9 in two Phases is two Attempts', () => {
    const s = hydrated()
    expect(s.attempts[`${PHASE_1}:9`].phaseId).toBe(PHASE_1)
    expect(s.attempts[`${PHASE_2}:9`].phaseId).toBe(PHASE_2)
  })

  it('applies one response at a time onto a store', () => {
    const body: PhaseAttemptsResponse = { asOfSeq: 7, attempts: [attempt(PHASE_1, '3')] }
    const s = applyHydrationResponse(emptyStore(), `/api/phases/${PHASE_1}/attempts`, body)
    expect(Object.keys(s.attempts)).toEqual([`${PHASE_1}:3`])
  })

  it('keeps the pendingPhaseIds of /api/events/current', () => {
    const body: EventCurrentResponse = {
      asOfSeq: 5,
      event: { eventId: 'ev1', name: 'x', details: NOT_YET },
      classes: [],
      courses: [],
      pendingPhaseIds: ['K1W_BR1_7'],
    }
    expect(applyHydrationResponse(emptyStore(), '/api/events/current', body).pendingPhaseIds).toEqual(['K1W_BR1_7'])
  })
})

describe('seq (CONTRACTS §1.6)', () => {
  const msg = (seq: number, bib = '9'): WsMessage => ({
    seq,
    type: 'attempt.updated',
    attemptId: `${PHASE_1}:${bib}`,
    fields: { status: known('on-course') },
  })

  it('skips a message at or below the snapshot asOfSeq', () => {
    const s = hydrated()
    expect(applyMessage(s, msg(1040))).toBe(s)
    expect(applyMessage(s, msg(1000))).toBe(s)
  })

  it('applies a message above asOfSeq and records its seq', () => {
    const s = applyMessage(hydrated(), msg(1041))
    expect(s.attempts[`${PHASE_1}:9`].status).toEqual(known('on-course'))
    expect(s.appliedSeq).toBe(1041)
  })

  it('does not apply a message twice', () => {
    const once = applyMessage(hydrated(), msg(1041))
    expect(applyMessage(once, msg(1041))).toBe(once)
  })
})

describe('per-field deltas (CONTRACTS §7.2)', () => {
  const id9 = `${PHASE_1}:9`

  it('leaves an omitted field untouched', () => {
    const before = hydrated()
    const s = applyMessage(before, {
      seq: 1041,
      type: 'attempt.updated',
      attemptId: id9,
      fields: { status: known('on-course') },
    })
    expect(s.attempts[id9]).toEqual({ ...before.attempts[id9], status: known('on-course') })
    expect(s.attempts[id9].outcome).toEqual(known({ kind: 'pending' }))
  })

  it('applies an explicit { state: "not-yet" } as a reset (run-generation change)', () => {
    let s = applyMessage(hydrated(), {
      seq: 1041,
      type: 'attempt.updated',
      attemptId: id9,
      fields: {
        outcome: known({ kind: 'duration', runSeconds: 90, penaltySeconds: 2, totalSeconds: 92 }),
        placement: known({ rank: 1, order: 1 }),
      },
    })
    s = applyMessage(s, {
      seq: 1042,
      type: 'attempt.updated',
      attemptId: id9,
      fields: { run: known(2), outcome: NOT_YET, placement: NOT_YET, status: known('on-course') },
    })
    expect(s.attempts[id9].outcome).toEqual(NOT_YET)
    expect(s.attempts[id9].placement).toEqual(NOT_YET)
    expect(s.attempts[id9].run).toEqual(known(2))
  })

  it('keeps a known 0 and a known null as delivered, distinct from not-yet and unavailable', () => {
    const s = applyMessage(hydrated(), {
      seq: 1041,
      type: 'attempt.updated',
      attemptId: id9,
      fields: {
        pairTotal: known(null),
        startOrder: known(0),
        gates: known([{ number: 1, penalty: 0 }, { number: 2, penalty: null }]),
        splits: { state: 'unavailable', reason: 'source-unreachable' },
      },
    })
    const a = s.attempts[id9]
    expect(a.pairTotal).toEqual(known(null))
    expect(a.startOrder).toEqual(known(0))
    expect(a.gates).toEqual(known([{ number: 1, penalty: 0 }, { number: 2, penalty: null }]))
    expect(a.splits).toEqual({ state: 'unavailable', reason: 'source-unreachable' })
  })

  it('keeps a null structural field distinct from an absent one', () => {
    const s = applyMessage(hydrated(), {
      seq: 1041,
      type: 'phase.updated',
      phaseId: PHASE_2,
      fields: { pair: { role: 'second', siblingPhaseId: null, combination: 'best' } },
    })
    expect(s.phases[PHASE_2].pair).toEqual({ role: 'second', siblingPhaseId: null, combination: 'best' })
    expect(s.phases[PHASE_1].pair).toBeNull()
  })

  it('creates an Attempt from the first message for an unknown attemptId', () => {
    const whole = attempt('K1W_BR1_7', '4')
    const { attemptId, ...fields } = whole
    const s = applyMessage(hydrated(), { seq: 1041, type: 'attempt.updated', attemptId, fields })
    expect(s.attempts[attemptId]).toEqual(whole)
  })

  it('creates a Phase, an Entry and a Class from their first message', () => {
    const { phaseId, ...phaseFields } = phase('K1W_BR1_7', { classId: 'K1W' })
    const { entryId, ...entryFields } = entry('E77', { classId: 'K1W' })
    const { classId, ...classFields } = { ...K1M, classId: 'K1W', code: 'K1W' }
    let s = applyMessage(hydrated(), { seq: 1041, type: 'phase.updated', phaseId, fields: phaseFields })
    s = applyMessage(s, { seq: 1042, type: 'entry.updated', entryId, fields: entryFields })
    s = applyMessage(s, { seq: 1043, type: 'class.updated', classId, fields: classFields })
    expect(s.phases[phaseId]).toEqual({ phaseId, ...phaseFields })
    expect(s.entries[entryId]).toEqual({ entryId, ...entryFields })
    expect(s.classes[classId]).toEqual({ classId, ...classFields })
  })

  it('applies phase, entry and class deltas per field', () => {
    let s = applyMessage(hydrated(), {
      seq: 1041,
      type: 'phase.updated',
      phaseId: PHASE_1,
      fields: { status: known('running') },
    })
    s = applyMessage(s, { seq: 1042, type: 'entry.updated', entryId: 'E9', fields: { club: NOT_YET } })
    s = applyMessage(s, { seq: 1043, type: 'class.updated', classId: 'K1M', fields: { name: known('K1 Men A') } })
    expect(s.phases[PHASE_1]).toEqual(phase(PHASE_1, { status: known('running') }))
    expect(s.entries.E9).toEqual(entry('E9', { club: NOT_YET }))
    expect(s.classes.K1M).toEqual({ ...K1M, name: known('K1 Men A') })
  })

  it('applies an optimistic write as a delta like any other; write.updated alone changes no domain state', () => {
    const gates = known([{ number: 1, penalty: 2 }], { source: 'operator-write', provisional: true })
    const s = applyMessage(hydrated(), { seq: 1041, type: 'attempt.updated', attemptId: id9, fields: { gates } })
    expect(s.attempts[id9].gates).toEqual(gates)
    const after = applyMessage(s, {
      seq: 1042,
      type: 'write.updated',
      write: {
        writeId: 'w1',
        target: { phaseId: PHASE_1, bib: '9', run: 1, field: 'gate-penalty' },
        requestedValue: 2,
        submittedAt: AT,
        status: 'pending',
      },
    })
    expect(after.attempts).toEqual(s.attempts)
    expect(after.appliedSeq).toBe(1042)
  })
})

describe('whole-resource replaces (CONTRACTS §7.2)', () => {
  it('replaces a Standing whole by standingKey, never merges its entries', () => {
    const replaced = standing('phase:K1M_BR1_5/all', [row('E12', '12', 1)])
    const s = applyMessage(hydrated(), { seq: 1041, type: 'standing.updated', standing: replaced })
    expect(s.standings['phase:K1M_BR1_5/all']).toEqual(replaced)
  })

  it('creates a Standing for a new standingKey', () => {
    const fresh = { ...standing('phase:K1M_BR2_6/all', []), scope: { kind: 'phase' as const, phaseId: PHASE_2 } }
    const s = applyMessage(hydrated(), { seq: 1041, type: 'standing.updated', standing: fresh })
    expect(Object.keys(s.standings).sort()).toEqual(['phase:K1M_BR1_5/all', 'phase:K1M_BR2_6/all'])
  })

  it('replaces a Course whole by courseId', () => {
    const next = { ...course('1', 'DDUUD'), gates: known([{ number: 1, kind: 'downstream' as const }]) }
    const s = applyMessage(hydrated(), { seq: 1041, type: 'course.updated', course: next })
    expect(s.courses['1']).toEqual(next)
  })

  it('replaces the on-course set whole, in the message order', () => {
    let s = applyMessage(hydrated(), {
      seq: 1041,
      type: 'oncourse.updated',
      attemptIds: [`${PHASE_2}:9`, `${PHASE_1}:9`],
      featuredByUpstream: `${PHASE_1}:9`,
      asOf: '2026-09-15T10:15:00.000Z',
    })
    expect(s.onCourse).toEqual({
      attemptIds: [`${PHASE_2}:9`, `${PHASE_1}:9`],
      featuredByUpstream: `${PHASE_1}:9`,
      asOf: '2026-09-15T10:15:00.000Z',
    })
    s = applyMessage(s, { seq: 1042, type: 'oncourse.updated', attemptIds: [], featuredByUpstream: null, asOf: AT })
    expect(s.onCourse).toEqual({ attemptIds: [], featuredByUpstream: null, asOf: AT })
  })
})

describe('purity', () => {
  it('never mutates the state it is given', () => {
    const before = hydrated()
    const snapshot = structuredClone(before)
    applyMessage(before, { seq: 1041, type: 'attempt.updated', attemptId: `${PHASE_1}:9`, fields: { run: known(2) } })
    applyMessage(before, { seq: 1042, type: 'oncourse.updated', attemptIds: [], featuredByUpstream: null, asOf: AT })
    expect(before).toEqual(snapshot)
  })
})
