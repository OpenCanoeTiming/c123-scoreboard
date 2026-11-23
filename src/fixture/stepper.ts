// The step loop over a fixture (TEST-ARCHITECTURE §3.3 step 3), shared by the tier-3 harness and the
// `?source=fixture` playback so the two stay in step. It holds no clock: the caller waits `gapToNext`
// (the harness by advancing its fake clock, the fixture source through its Clock), then calls `apply`.
import type { WsMessage } from '@opencanoetiming/c123-contract'
import { applyMessage, hydrate, type StoreState } from '../store/store'
import type { Fixture } from './harness'

export type Stepper = {
  readonly state: StoreState
  readonly done: boolean
  /** Milliseconds from the previous step's observedAt to the next one's. */
  readonly gapToNext: number
  /** Applies the next delta as the transport would and returns the new state. */
  apply(): StoreState
}

/** Starts from the hydration step's store. */
export function createStepper(fixture: Fixture): Stepper {
  const [hydration, ...deltas] = fixture.steps
  let state = hydrate(hydration.responses, hydration.asOfSeq)
  let previousAt = hydration.observedAt
  let index = 0

  const pending = () => {
    if (index >= deltas.length) throw new Error(`fixture ${fixture.fixtureId}: no step left`)
    return deltas[index]
  }

  return {
    get state() {
      return state
    },
    get done() {
      return index >= deltas.length
    },
    get gapToNext() {
      return Date.parse(pending().observedAt) - Date.parse(previousAt)
    },
    apply() {
      const { observedAt, ...message } = pending()
      index++
      previousAt = observedAt
      state = applyMessage(state, message as WsMessage) // the wire message carries no observedAt
      return state
    },
  }
}
