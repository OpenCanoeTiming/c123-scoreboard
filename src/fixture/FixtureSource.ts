// `?source=fixture&fixture=<id>`: plays a synthetic fixture (TEST-ARCHITECTURE §4) into the store, as the
// tier-3 harness does, on a given Clock: the hydration step at once, each later step after its gap to the
// previous one (§3.3 step 3). The fixture files and their validator load lazily, outside the main bundle.
import { useEffect, useState } from 'react'
import type { Clock, TimerHandle } from '../clock/clock'
import type { StoreState } from '../store/store'
import type { Fixture } from './harness'
import { createStepper } from './stepper'

const files = import.meta.glob<unknown>('../../tests/fixtures/synthetic/*.json', { import: 'default' })

/** Loads the fixture file `<id>.json` and validates it; rejects an unknown id or an invalid file. */
export async function loadFixtureById(id: string): Promise<Fixture> {
  const file = files[`../../tests/fixtures/synthetic/${id}.json`]
  if (!file) throw new Error(`unknown fixture ${id}`)
  const [json, { loadFixture }] = await Promise.all([file(), import('./harness')])
  return loadFixture(json)
}

/** Plays `fixture` on `clock`, reporting every new store state. Returns stop. */
export function playFixture(fixture: Fixture, clock: Clock, onState: (state: StoreState) => void): () => void {
  const stepper = createStepper(fixture)
  let handle: TimerHandle | null = null
  let stopped = false

  const scheduleNext = () => {
    handle = null
    if (stopped || stepper.done) return
    handle = clock.setTimeout(() => {
      onState(stepper.apply())
      scheduleNext()
    }, stepper.gapToNext)
  }

  onState(stepper.state)
  scheduleNext()
  return () => {
    if (handle !== null) clock.clearTimeout(handle)
    handle = null
    stopped = true
  }
}

export type FixtureStore =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; state: StoreState }

/** The store fed by fixture `id` on `clock`. */
export function useFixtureStore(id: string, clock: Clock): FixtureStore {
  const [store, setStore] = useState<FixtureStore>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    let stop: (() => void) | null = null
    loadFixtureById(id).then(
      (fixture) => {
        if (!cancelled) stop = playFixture(fixture, clock, (state) => setStore({ status: 'ready', state }))
      },
      (err: unknown) => {
        if (!cancelled) setStore({ status: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    )
    return () => {
      cancelled = true
      stop?.()
    }
  }, [id, clock])

  return store
}
