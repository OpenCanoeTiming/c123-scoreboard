import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadFixture } from './harness'
import { createStepper } from './stepper'

// The step loop the two §3.3 playbacks share (TEST-ARCHITECTURE §3.3 step 3): the harness advances the fake
// clock by `gapToNext`, the fixture source waits for it on its Clock; both then `apply` the same step.

const FIXTURE = resolve(process.cwd(), 'tests/fixtures/synthetic/slalom-k1m-one-run.json')
const fixture = () => loadFixture(JSON.parse(readFileSync(FIXTURE, 'utf8')))

describe('fixture stepper', () => {
  it('starts from the hydration step and applies each delta in order, with the gap to it', () => {
    const s = createStepper(fixture())
    expect(s.state.appliedSeq).toBe(1040)
    expect(s.done).toBe(false)

    const seen: [number, number][] = []
    while (!s.done) {
      const gap = s.gapToNext
      seen.push([gap, s.apply().appliedSeq])
    }
    expect(seen).toEqual([
      [10_000, 1041],
      [0, 1042],
      [97_420, 1043],
      [0, 1044],
      [680, 1045],
      [0, 1046],
      [0, 1047],
    ])
    expect(s.state.appliedSeq).toBe(1047)
  })

  it('throws when no step is left', () => {
    const s = createStepper(fixture())
    while (!s.done) s.apply()
    expect(() => s.apply()).toThrow(/no step left/)
    expect(() => s.gapToNext).toThrow(/no step left/)
  })
})
