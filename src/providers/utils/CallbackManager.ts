import type { ConnectionStatus, RaceConfig, VisibilityState } from '@/types'
import type {
  Unsubscribe,
  ResultsData,
  OnCourseData,
  EventInfoData,
  ProviderError,
} from '../types'

/**
 * Manages callback subscriptions for data providers
 *
 * Centralizes the callback Set management pattern that was duplicated
 * in CLIProvider and ReplayProvider.
 */
export class CallbackManager {
  private resultsCallbacks = new Set<(data: ResultsData) => void>()
  private onCourseCallbacks = new Set<(data: OnCourseData) => void>()
  private configCallbacks = new Set<(config: RaceConfig) => void>()
  private visibilityCallbacks = new Set<(visibility: VisibilityState) => void>()
  private eventInfoCallbacks = new Set<(info: EventInfoData) => void>()
  private connectionCallbacks = new Set<(status: ConnectionStatus) => void>()
  private errorCallbacks = new Set<(error: ProviderError) => void>()

  private safeMode: boolean

  /**
   * @param safeMode If true, wraps callback calls in try/catch (default: true)
   */
  constructor(safeMode = true) {
    this.safeMode = safeMode
  }

  // --- Subscription methods ---

  onResults(callback: (data: ResultsData) => void): Unsubscribe {
    this.resultsCallbacks.add(callback)
    return () => this.resultsCallbacks.delete(callback)
  }

  onOnCourse(callback: (data: OnCourseData) => void): Unsubscribe {
    this.onCourseCallbacks.add(callback)
    return () => this.onCourseCallbacks.delete(callback)
  }

  onConfig(callback: (config: RaceConfig) => void): Unsubscribe {
    this.configCallbacks.add(callback)
    return () => this.configCallbacks.delete(callback)
  }

  onVisibility(callback: (visibility: VisibilityState) => void): Unsubscribe {
    this.visibilityCallbacks.add(callback)
    return () => this.visibilityCallbacks.delete(callback)
  }

  onEventInfo(callback: (info: EventInfoData) => void): Unsubscribe {
    this.eventInfoCallbacks.add(callback)
    return () => this.eventInfoCallbacks.delete(callback)
  }

  onConnectionChange(callback: (status: ConnectionStatus) => void): Unsubscribe {
    this.connectionCallbacks.add(callback)
    return () => this.connectionCallbacks.delete(callback)
  }

  onError(callback: (error: ProviderError) => void): Unsubscribe {
    this.errorCallbacks.add(callback)
    return () => this.errorCallbacks.delete(callback)
  }

  // --- Emit methods ---

  emitResults(data: ResultsData): void {
    this.callCallbacks(this.resultsCallbacks, data)
  }

  emitOnCourse(data: OnCourseData): void {
    this.callCallbacks(this.onCourseCallbacks, data)
  }

  emitConfig(config: RaceConfig): void {
    this.callCallbacks(this.configCallbacks, config)
  }

  emitVisibility(visibility: VisibilityState): void {
    this.callCallbacks(this.visibilityCallbacks, visibility)
  }

  emitEventInfo(info: EventInfoData): void {
    this.callCallbacks(this.eventInfoCallbacks, info)
  }

  emitConnection(status: ConnectionStatus): void {
    this.callCallbacks(this.connectionCallbacks, status)
  }

  emitError(
    code: ProviderError['code'],
    message: string,
    cause?: unknown
  ): void {
    const error: ProviderError = {
      code,
      message,
      cause,
      timestamp: Date.now(),
    }
    this.callCallbacks(this.errorCallbacks, error)
  }

  // --- Private helpers ---

  private callCallbacks<T>(callbacks: Set<(arg: T) => void>, arg: T): void {
    if (this.safeMode) {
      callbacks.forEach((cb) => {
        try {
          cb(arg)
        } catch (err) {
          console.error('Callback threw error:', err)
        }
      })
    } else {
      callbacks.forEach((cb) => cb(arg))
    }
  }
}
