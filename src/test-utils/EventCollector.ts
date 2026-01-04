/**
 * EventCollector - Collects events from DataProvider for testing
 *
 * Usage:
 *   const collector = new EventCollector()
 *   collector.attach(provider)
 *   // ... wait for events ...
 *   const normalized = collector.normalize()
 */

import type { DataProvider, ResultsData, OnCourseData, EventInfoData } from '@/providers/types'
import type { RaceConfig, VisibilityState, ConnectionStatus } from '@/types'

/**
 * Collected event with timestamp
 */
export interface CollectedEvent<T> {
  timestamp: number
  data: T
}

/**
 * Normalized events for comparison
 * Removes timestamps and sorts arrays for deterministic comparison
 */
export interface NormalizedEvents {
  /** Results messages - sorted by raceName */
  results: NormalizedResult[]
  /** OnCourse messages - sorted by current.bib */
  onCourse: NormalizedOnCourse[]
  /** EventInfo messages (dayTime only) */
  dayTimes: string[]
  /** Config changes */
  configs: RaceConfig[]
  /** Statistics */
  stats: {
    resultsCount: number
    onCourseCount: number
    configCount: number
    eventInfoCount: number
    errorCount: number
  }
}

/**
 * Normalized result for comparison
 * Removes fields that differ between providers but don't affect UI
 */
export interface NormalizedResult {
  raceName: string
  raceStatus: string
  highlightBib: string | null
  results: Array<{
    rank: number
    bib: string
    name: string
    total: string
    pen: number
    behind: string
  }>
}

/**
 * Normalized on-course data for comparison
 */
export interface NormalizedOnCourse {
  currentBib: string | null
  currentName: string | null
  currentTime: string | null
  currentPen: number | null
  currentDtFinish: string | null
  competitorCount: number
  /** Sorted bib list of on-course competitors */
  onCourseBibs: string[]
}

/**
 * EventCollector - Collects all events from a DataProvider
 */
export class EventCollector {
  private _results: CollectedEvent<ResultsData>[] = []
  private _onCourse: CollectedEvent<OnCourseData>[] = []
  private _eventInfo: CollectedEvent<EventInfoData>[] = []
  private _configs: CollectedEvent<RaceConfig>[] = []
  private _visibility: CollectedEvent<VisibilityState>[] = []
  private _connections: CollectedEvent<ConnectionStatus>[] = []
  private _errors: CollectedEvent<{ code: string; message: string }>[] = []

  private unsubscribes: Array<() => void> = []

  /**
   * Attach collector to a DataProvider
   * Starts collecting all events
   */
  attach(provider: DataProvider): void {
    this.unsubscribes.push(
      provider.onResults((data) => {
        this._results.push({ timestamp: Date.now(), data })
      })
    )

    this.unsubscribes.push(
      provider.onOnCourse((data) => {
        this._onCourse.push({ timestamp: Date.now(), data })
      })
    )

    this.unsubscribes.push(
      provider.onEventInfo((data) => {
        this._eventInfo.push({ timestamp: Date.now(), data })
      })
    )

    this.unsubscribes.push(
      provider.onConfig((data) => {
        this._configs.push({ timestamp: Date.now(), data })
      })
    )

    this.unsubscribes.push(
      provider.onVisibility((data) => {
        this._visibility.push({ timestamp: Date.now(), data })
      })
    )

    this.unsubscribes.push(
      provider.onConnectionChange((status) => {
        this._connections.push({ timestamp: Date.now(), data: status })
      })
    )

    this.unsubscribes.push(
      provider.onError((error) => {
        this._errors.push({
          timestamp: Date.now(),
          data: { code: error.code, message: error.message },
        })
      })
    )
  }

  /**
   * Detach from provider - stop collecting events
   */
  detach(): void {
    for (const unsub of this.unsubscribes) {
      unsub()
    }
    this.unsubscribes = []
  }

  /**
   * Clear all collected events
   */
  clear(): void {
    this._results = []
    this._onCourse = []
    this._eventInfo = []
    this._configs = []
    this._visibility = []
    this._connections = []
    this._errors = []
  }

  // Raw accessors
  get results(): CollectedEvent<ResultsData>[] {
    return this._results
  }
  get onCourse(): CollectedEvent<OnCourseData>[] {
    return this._onCourse
  }
  get eventInfo(): CollectedEvent<EventInfoData>[] {
    return this._eventInfo
  }
  get configs(): CollectedEvent<RaceConfig>[] {
    return this._configs
  }
  get visibility(): CollectedEvent<VisibilityState>[] {
    return this._visibility
  }
  get connections(): CollectedEvent<ConnectionStatus>[] {
    return this._connections
  }
  get errors(): CollectedEvent<{ code: string; message: string }>[] {
    return this._errors
  }

  /**
   * Normalize collected events for comparison
   * - Removes timestamps
   * - Sorts arrays deterministically
   * - Extracts comparable fields only
   */
  normalize(): NormalizedEvents {
    return {
      results: this.normalizeResults(),
      onCourse: this.normalizeOnCourse(),
      dayTimes: this.extractDayTimes(),
      configs: this._configs.map((c) => c.data),
      stats: {
        resultsCount: this._results.length,
        onCourseCount: this._onCourse.length,
        configCount: this._configs.length,
        eventInfoCount: this._eventInfo.length,
        errorCount: this._errors.length,
      },
    }
  }

  /**
   * Get unique results (deduplicated by content)
   * Useful when comparing final state rather than all updates
   */
  getUniqueResults(): NormalizedResult[] {
    const seen = new Set<string>()
    const unique: NormalizedResult[] = []

    for (const event of this._results) {
      const normalized = this.normalizeResultData(event.data)
      const key = JSON.stringify(normalized)
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(normalized)
      }
    }

    return unique
  }

  /**
   * Get last result for each race
   */
  getLastResultPerRace(): Map<string, NormalizedResult> {
    const lastPerRace = new Map<string, NormalizedResult>()

    for (const event of this._results) {
      const normalized = this.normalizeResultData(event.data)
      lastPerRace.set(normalized.raceName, normalized)
    }

    return lastPerRace
  }

  /**
   * Get last on-course state
   */
  getLastOnCourse(): NormalizedOnCourse | null {
    if (this._onCourse.length === 0) return null
    const last = this._onCourse[this._onCourse.length - 1]
    return this.normalizeOnCourseData(last.data)
  }

  // Private normalization methods

  private normalizeResults(): NormalizedResult[] {
    return this._results
      .map((e) => this.normalizeResultData(e.data))
      .sort((a, b) => a.raceName.localeCompare(b.raceName))
  }

  private normalizeResultData(data: ResultsData): NormalizedResult {
    return {
      raceName: data.raceName,
      raceStatus: data.raceStatus,
      highlightBib: data.highlightBib,
      results: data.results.map((r) => ({
        rank: r.rank,
        bib: r.bib,
        name: r.name,
        total: r.total,
        pen: r.pen,
        behind: r.behind,
      })),
    }
  }

  private normalizeOnCourse(): NormalizedOnCourse[] {
    return this._onCourse
      .map((e) => this.normalizeOnCourseData(e.data))
      .sort((a, b) => (a.currentBib || '').localeCompare(b.currentBib || ''))
  }

  private normalizeOnCourseData(data: OnCourseData): NormalizedOnCourse {
    return {
      currentBib: data.current?.bib || null,
      currentName: data.current?.name || null,
      currentTime: data.current?.time || null,
      currentPen: data.current?.pen ?? null,
      currentDtFinish: data.current?.dtFinish || null,
      competitorCount: data.onCourse.length,
      onCourseBibs: data.onCourse.map((c) => c.bib).sort(),
    }
  }

  private extractDayTimes(): string[] {
    return this._eventInfo
      .map((e) => e.data.dayTime)
      .filter((dt): dt is string => dt !== undefined && dt.length > 0)
  }
}
