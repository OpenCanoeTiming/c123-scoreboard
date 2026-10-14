/**
 * FixtureReplayProvider - tier-3 harness driver (TEST-ARCHITECTURE §3.3), spike S3
 *
 * A DataProvider that replays a fixture of today's WS messages and owns the
 * clock: each step advances the clock to the step's observedAt, then delivers
 * the message the way C123ServerProvider would.
 */

import type { ConnectionStatus, RaceConfig, VisibilityState } from '@/types'
import type {
  C123ServerMessage,
  C123OnCourseData,
  C123ResultsData,
  C123TimeOfDayData,
  C123RaceConfigData,
} from '@/types/c123server'
import type {
  DataProvider,
  Unsubscribe,
  ResultsData,
  OnCourseData,
  EventInfoData,
  ProviderError,
} from '@/providers/types'
import { CallbackManager } from '@/providers/utils/CallbackManager'
import { mapOnCourse, mapResults, mapTimeOfDay, mapRaceConfig } from '@/providers/utils/c123ServerMapper'

export interface FixtureStep {
  note?: string
  /** A WS envelope exactly as c123-server sends it; `timestamp` is the step's observedAt */
  ws: C123ServerMessage
}

export interface Fixture {
  fixtureId: string
  source: { kind: 'synthetic' | 'recording'; reason?: string; excerpt?: string }
  wireProtocolVersion: string
  marks: Record<string, number>
  steps: FixtureStep[]
}

/**
 * The clock the harness owns. Today's client reads Date.now()/setTimeout/rAF
 * directly, so the only implementation is a global fake-timer patch (fakeClock.ts).
 */
export interface HarnessClock {
  now(): number
  advanceTo(epochMs: number): void
}

export class FixtureReplayProvider implements DataProvider {
  private _status: ConnectionStatus = 'disconnected'
  private callbacks = new CallbackManager(false)
  private nextIndex = 0

  // Mirrors C123ServerProvider's race tracking for mapRaceConfig
  private currentRaceName = ''
  private currentRaceIsCurrent = true

  private readonly fixture: Fixture
  private readonly clock: HarnessClock

  constructor(fixture: Fixture, clock: HarnessClock) {
    this.fixture = fixture
    this.clock = clock
  }

  get status(): ConnectionStatus {
    return this._status
  }

  get connected(): boolean {
    return this._status === 'connected'
  }

  get position(): number {
    return this.nextIndex
  }

  async connect(): Promise<void> {
    this._status = 'connected'
    this.callbacks.emitConnection('connected')
  }

  disconnect(): void {
    this._status = 'disconnected'
    this.callbacks.emitConnection('disconnected')
  }

  observedAt(index: number): number {
    return Date.parse(this.fixture.steps[index].ws.timestamp)
  }

  /** Advance the clock to the next step's observedAt, then deliver it */
  step(): void {
    const index = this.nextIndex
    if (index >= this.fixture.steps.length) {
      throw new Error(`fixture ${this.fixture.fixtureId} has no step ${index}`)
    }
    this.clock.advanceTo(this.observedAt(index))
    this.nextIndex++
    this.deliver(this.fixture.steps[index].ws)
  }

  /** Advance the clock with no fixture entry */
  advanceTo(epochMs: number): void {
    this.clock.advanceTo(epochMs)
  }

  /**
   * Same dispatch as C123ServerProvider.handleMessage (C123ServerProvider.ts:374-408)
   * for the message types a fixture carries. BR2Manager is not run: the fixture
   * holds BR1 races only, for which it passes results through unchanged.
   */
  private deliver(message: C123ServerMessage): void {
    // Round-trip through JSON like a WS frame, so the client never shares fixture objects
    const msg = JSON.parse(JSON.stringify(message)) as C123ServerMessage
    switch (msg.type) {
      case 'Connected':
        break
      case 'TimeOfDay':
        this.callbacks.emitEventInfo(mapTimeOfDay(msg.data as C123TimeOfDayData))
        break
      case 'OnCourse':
        this.callbacks.emitOnCourse(mapOnCourse(msg.data as C123OnCourseData))
        break
      case 'Results': {
        const data = msg.data as C123ResultsData
        this.currentRaceName = data.mainTitle || data.raceId
        this.currentRaceIsCurrent = data.isCurrent
        this.callbacks.emitResults({ ...mapResults(data), isBR2: false })
        break
      }
      case 'RaceConfig':
        this.callbacks.emitConfig(
          mapRaceConfig(msg.data as C123RaceConfigData, this.currentRaceName, this.currentRaceIsCurrent)
        )
        break
      default:
        throw new Error(`fixture message type ${msg.type} not supported by the harness`)
    }
  }

  onResults(callback: (data: ResultsData) => void): Unsubscribe {
    return this.callbacks.onResults(callback)
  }

  onOnCourse(callback: (data: OnCourseData) => void): Unsubscribe {
    return this.callbacks.onOnCourse(callback)
  }

  onConfig(callback: (config: RaceConfig) => void): Unsubscribe {
    return this.callbacks.onConfig(callback)
  }

  onVisibility(callback: (visibility: VisibilityState) => void): Unsubscribe {
    return this.callbacks.onVisibility(callback)
  }

  onEventInfo(callback: (info: EventInfoData) => void): Unsubscribe {
    return this.callbacks.onEventInfo(callback)
  }

  onConnectionChange(callback: (status: ConnectionStatus) => void): Unsubscribe {
    return this.callbacks.onConnectionChange(callback)
  }

  onError(callback: (error: ProviderError) => void): Unsubscribe {
    return this.callbacks.onError(callback)
  }
}
