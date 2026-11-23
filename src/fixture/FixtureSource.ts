// `?source=fixture&fixture=<id>`: plays a synthetic fixture (TEST-ARCHITECTURE §4) into the store, as the
// tier-3 harness does, on a given Clock: the hydration step at once, each later step after its gap to the
// previous one (§3.3 step 3). The fixture files and their validator load lazily, outside the main bundle.
import { useEffect, useState } from 'react'
import type { WsMessage } from '@opencanoetiming/c123-contract'
import type { Clock, TimerHandle } from '../clock/clock'
import { applyMessage, hydrate, type StoreState } from '../store/store'
import type { Fixture } from './harness'

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
  const [hydration, ...deltas] = fixture.steps
  let state = hydrate(hydration.responses, hydration.asOfSeq)
  let previousAt = hydration.observedAt
  let index = 0
  let handle: TimerHandle | null = null

  const scheduleNext = () => {
    handle = null
    if (index >= deltas.length) return
    const { observedAt, ...message } = deltas[index]
    handle = clock.setTimeout(() => {
      index++
      previousAt = observedAt
      state = applyMessage(state, message as WsMessage) // the wire message carries no observedAt
      onState(state)
      scheduleNext()
    }, Date.parse(observedAt) - Date.parse(previousAt))
  }

  onState(state)
  scheduleNext()
  return () => {
    if (handle !== null) clock.clearTimeout(handle)
    handle = null
    index = deltas.length
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
