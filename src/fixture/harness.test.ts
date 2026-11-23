import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadFixture, startHarness } from './harness'

// TEST-ARCHITECTURE §3.3 (harness shape), §4 (fixture format); CLIENT-OBLIGATIONS L130, L131 and the
// parked L343, L347, L348. Until the contract package ships a schema for a whole fixture file, the
// harness checks the header and step shapes itself and an `admitted` block against the package's
// schema (c123-server#440, recommended reading).

const DIR = resolve(process.cwd(), 'tests/fixtures/synthetic')
const FIRST = 'slalom-k1m-one-run.json'
const P = 'K1M_BR1_5'
const OFFSET = 37_000 // the stated offset of the fake clock from the hydration step's observedAt

function read(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(DIR, name), 'utf8'))
}

type FixtureJson = {
  domainLayerVersion: { contract: string }
  source: { reason?: string }
  admitted?: unknown
  steps: Record<string, unknown>[]
}

function variant(change: (f: FixtureJson) => void): unknown {
  const copy = structuredClone(read(FIRST)) as unknown as FixtureJson
  change(copy)
  return copy
}

const at = (iso: string) => Date.parse(iso) + OFFSET

describe('fixture files (TEST-ARCHITECTURE §4)', () => {
  const files = readdirSync(DIR).filter((n) => n.endsWith('.json'))

  it('has the first synthetic fixture', () => {
    expect(files).toContain(FIRST)
  })

  for (const name of files) {
    it(`${name} is a valid synthetic fixture with a reason`, () => {
      const fixture = loadFixture(read(name))
      expect(fixture.source.kind).toBe('synthetic')
      expect(fixture.source.reason.length).toBeGreaterThan(0)
    })
  }

  it('throws, loudly, on a domainLayerVersion.contract other than the pinned package', () => {
    expect(() => loadFixture(variant((f) => (f.domainLayerVersion.contract = '0.1.0')))).toThrow(/domainLayerVersion\.contract/)
  })

  it('rejects a synthetic fixture without a reason', () => {
    expect(() => loadFixture(variant((f) => delete f.source.reason))).toThrow(/reason/)
  })

  it('rejects a file whose first step is not the hydration step', () => {
    expect(() => loadFixture(variant((f) => f.steps.shift()))).toThrow(/hydration/)
  })

  it('rejects a hydration step without observedAt', () => {
    expect(() => loadFixture(variant((f) => delete f.steps[0].observedAt))).toThrow(/observedAt/)
  })

  it('rejects a delta whose type the contract does not define', () => {
    expect(() => loadFixture(variant((f) => (f.steps[1].type = 'attempt.changed')))).toThrow(/attempt\.changed/)
  })

  it('validates an admitted block against the package schema', () => {
    const block = {
      status: 'admitted',
      gate1: false,
      gate2: true,
      gate3: {
        mechanical: {
          attempts: 1, fields: 1, match: 1, mismatch: 0, changedAfterWindow: 0, changedAfterWindowEqualsWindowEnd: 0,
          noFinalRow: 0, report: { file: 'r.json', sha256: 'a'.repeat(64) }, against: 'published-results', windowSpansWholeRaces: true,
        },
        human: 'human-checked-2026-09-15 by A. Checker',
      },
      evidence: {
        gate1: { stepLogSha256: ['a'.repeat(64), 'a'.repeat(64)], finalStateSha256: ['b'.repeat(64), 'b'.repeat(64)], candidateSha256: ['c'.repeat(64), 'c'.repeat(64)] },
        gate2: { checker: 'x', violations: {}, exercised: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`P${i + 1}`, 1])) },
      },
    }
    expect(() => loadFixture(variant((f) => (f.admitted = { ...block, gate1: true })))).not.toThrow()
    expect(() => loadFixture(variant((f) => (f.admitted = block)))).toThrow(/admitted/) // gate1 false cannot be admitted
  })
})

describe('tier-3 harness (TEST-ARCHITECTURE §3.3)', () => {
  const fixture = () => loadFixture(read(FIRST))

  it('refuses a zero offset: the clock must never equal observedAt', () => {
    expect(() => startHarness(fixture(), { offsetMs: 0 })).toThrow(/offset/)
  })

  it('initialises the store from the hydration step, the clock at observedAt + the offset', () => {
    const h = startHarness(fixture(), { offsetMs: OFFSET })
    expect(h.clock.now()).toBe(at('2026-09-15T10:13:50.000Z'))
    expect(h.state.appliedSeq).toBe(1040)
    expect(Object.keys(h.state.phases)).toEqual([P])
    expect(Object.keys(h.state.entries).sort()).toEqual(['E1', 'E2', 'E3'])
    expect(h.state.attempts[`${P}:3`].status).toMatchObject({ state: 'known', value: 'not-started' })
    expect(h.state.attempts[`${P}:1`].placement).toMatchObject({ value: { rank: 1, order: 1 } })
    expect(h.state.standings[`phase:${P}/all`].entries.map((e) => e.entryId)).toEqual(['E1', 'E2', 'E3'])
    expect(h.state.onCourse.attemptIds).toEqual([])
    expect(h.done).toBe(false)
  })

  it('per step, advances the clock by the gap, keeping the offset, then applies the delta', () => {
    const h = startHarness(fixture(), { offsetMs: OFFSET })
    const fired: number[] = []
    h.clock.setTimeout(() => fired.push(h.clock.now()), 10_000) // the gap to the first delta
    h.next()
    expect(fired).toEqual([at('2026-09-15T10:14:00.000Z')])
    expect(h.clock.now()).toBe(at('2026-09-15T10:14:00.000Z'))
    expect(h.state.appliedSeq).toBe(1041)
    expect(h.state.attempts[`${P}:3`].status).toMatchObject({ value: 'on-course' })
    h.next()
    expect(h.state.onCourse.attemptIds).toEqual([`${P}:3`])
  })

  it('after the last step: the athlete has finished and the Standing is re-ranked', () => {
    const h = startHarness(fixture(), { offsetMs: OFFSET })
    h.runToEnd()
    expect(h.done).toBe(true)
    expect(() => h.next()).toThrow()
    expect(h.clock.now()).toBe(at('2026-09-15T10:15:38.100Z'))
    expect(h.state.appliedSeq).toBe(1047)
    const third = h.state.attempts[`${P}:3`]
    expect(third.status).toMatchObject({ value: 'finished' })
    expect(third.outcome).toMatchObject({ value: { kind: 'duration', runSeconds: 95.42, penaltySeconds: 2, totalSeconds: 97.42 } })
    expect(third.placement).toMatchObject({ value: { rank: 2, order: 2 } })
    expect(h.state.attempts[`${P}:2`].placement).toMatchObject({ value: { rank: 3, order: 3 } })
    expect(h.state.standings[`phase:${P}/all`].entries.map((e) => [e.entryId, e.rank])).toEqual([['E1', 1], ['E3', 2], ['E2', 3]])
    expect(h.state.onCourse.attemptIds).toEqual([])
  })

  it('advancing the clock with no new step moves time alone and leaves the store as it was', () => {
    const h = startHarness(fixture(), { offsetMs: OFFSET })
    h.runToEnd()
    const before = h.state
    const fired: number[] = []
    h.clock.setTimeout(() => fired.push(h.clock.now()), 3_000)
    h.clock.advance(2_999)
    expect(fired).toEqual([])
    h.clock.advance(1)
    expect(fired).toEqual([at('2026-09-15T10:15:41.100Z')])
    expect(h.state).toBe(before)
  })
})

describe('tier-3 harness: removals (CONTRACTS §7.2; CLIENT-OBLIGATIONS L110, L111)', () => {
  it('slalom-k1m-removed-bib: the Attempt and its standing entry go, the Entry stays', () => {
    const h = startHarness(loadFixture(read('slalom-k1m-removed-bib.json')), { offsetMs: OFFSET })
    const removed = `${P}:2`
    h.next() // attempt.deleted
    expect(h.state.attempts[removed]).toBeUndefined()
    expect(h.state.standings[`phase:${P}/all`].entries.map((e) => e.entryId)).toEqual(['E1', 'E3'])
    expect(h.state.entries.E2).toBeDefined()
    h.runToEnd() // the Standing that held it, as standing.updated
    expect(Object.keys(h.state.attempts).sort()).toEqual([`${P}:1`, `${P}:3`])
    expect(h.state.standings[`phase:${P}/all`].entries.map((e) => e.entryId)).toEqual(['E1', 'E3'])
    expect(Object.keys(h.state.entries).sort()).toEqual(['E1', 'E2', 'E3'])
  })

  it('slalom-k1m-removed-phase: the Phase, its Attempts and every Standing naming it go; Class, Entries, Courses stay', () => {
    const h = startHarness(loadFixture(read('slalom-k1m-removed-phase.json')), { offsetMs: OFFSET })
    const [first, second] = ['K1M_BR1_6', 'K1M_BR2_6']
    expect(Object.keys(h.state.standings).sort()).toEqual([`pair:${second}/all`, `phase:${first}/all`, `phase:${second}/all`])
    h.next() // phase.deleted
    expect(Object.keys(h.state.phases)).toEqual([first])
    expect(Object.values(h.state.attempts).map((a) => a.phaseId)).toEqual([first, first])
    expect(Object.keys(h.state.standings)).toEqual([`phase:${first}/all`])
    expect(Object.keys(h.state.classes)).toEqual(['K1M'])
    expect(Object.keys(h.state.entries).sort()).toEqual(['E1', 'E2'])
    expect(Object.keys(h.state.courses)).toEqual(['1'])
    h.runToEnd() // the first run's pair, derived again
    expect(h.state.phases[first].pair).toEqual({ role: 'first', siblingPhaseId: null, combination: 'best' })
    expect(h.state.phases[second]).toBeUndefined()
  })
})
