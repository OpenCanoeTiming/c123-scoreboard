import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createFakeClock } from '../clock/fakeClock'
import type { StoreState } from '../store/store'
import { loadFixture } from './harness'
import { loadFixtureById, playFixture } from './FixtureSource'

// `?source=fixture&fixture=<id>` plays a fixture into the store: hydration at once, each later step after
// its gap to the previous one, the gap waited for through the Clock (TEST-ARCHITECTURE §3.3 step 3, §5).

const FIXTURE = resolve(process.cwd(), 'tests/fixtures/synthetic/slalom-k1m-one-run.json')
const fixture = () => loadFixture(JSON.parse(readFileSync(FIXTURE, 'utf8')))

describe('FixtureSource', () => {
  it('hydrates at once, then applies each step after its gap, through the Clock', () => {
    const clock = createFakeClock(1_000_000)
    const seen: StoreState[] = []
    playFixture(fixture(), clock, (state) => seen.push(state))
    expect(seen.map((s) => s.appliedSeq)).toEqual([1040])

    clock.advance(9_999)
    expect(seen.at(-1)?.appliedSeq).toBe(1040)
    clock.advance(1) // 10:14:00, two steps share the instant
    expect(seen.at(-1)?.appliedSeq).toBe(1042)
    expect(seen.at(-1)?.onCourse.attemptIds).toEqual(['K1M_BR1_5:3'])

    clock.advance(98_100) // to the last step at 10:15:38.100
    expect(seen.at(-1)?.appliedSeq).toBe(1047)
  })

  it('stops: no step is applied after the returned stop is called', () => {
    const clock = createFakeClock(1_000_000)
    const seen: StoreState[] = []
    const stop = playFixture(fixture(), clock, (state) => seen.push(state))
    stop()
    clock.advance(200_000)
    expect(seen.map((s) => s.appliedSeq)).toEqual([1040])
  })

  it('loads a fixture by id, validated, and rejects an unknown id', async () => {
    expect((await loadFixtureById('slalom-k1m-one-run')).fixtureId).toBe('slalom-k1m-one-run')
    await expect(loadFixtureById('no-such-fixture')).rejects.toThrow(/no-such-fixture/)
  })
})
