import type { ConnectionStatus, OnCourseCompetitor, RaceConfig, VisibilityState } from '@/types'
import type {
  DataProvider,
  Unsubscribe,
  ResultsData,
  OnCourseData,
  EventInfoData,
} from './types'

/**
 * CLIProvider options
 */
export interface CLIProviderOptions {
  /** Reconnect on disconnect (default: true) */
  autoReconnect?: boolean
  /** Maximum reconnect delay in ms (default: 30000) */
  maxReconnectDelay?: number
  /** Initial reconnect delay in ms (default: 1000) */
  initialReconnectDelay?: number
}

/**
 * CLIProvider - WebSocket connection to CLI tool
 *
 * This provider connects to the CLI WebSocket server (typically port 8081)
 * and receives live timing data. It implements exponential backoff
 * for automatic reconnection.
 *
 * Protocol: JSON messages over WebSocket
 * Message types: top, comp, oncourse, control, title, infotext, daytime
 */
export class CLIProvider implements DataProvider {
  private ws: WebSocket | null = null
  private _status: ConnectionStatus = 'disconnected'
  private url: string
  private autoReconnect: boolean
  private maxReconnectDelay: number
  private initialReconnectDelay: number
  private currentReconnectDelay: number
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null
  private isManualDisconnect = false

  // Callbacks
  private resultsCallbacks = new Set<(data: ResultsData) => void>()
  private onCourseCallbacks = new Set<(data: OnCourseData) => void>()
  private configCallbacks = new Set<(config: RaceConfig) => void>()
  private visibilityCallbacks = new Set<(visibility: VisibilityState) => void>()
  private eventInfoCallbacks = new Set<(info: EventInfoData) => void>()
  private connectionCallbacks = new Set<(status: ConnectionStatus) => void>()

  constructor(url: string, options: CLIProviderOptions = {}) {
    // Ensure proper WebSocket URL format
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      url = `ws://${url}`
    }
    this.url = url
    this.autoReconnect = options.autoReconnect ?? true
    this.maxReconnectDelay = options.maxReconnectDelay ?? 30000
    this.initialReconnectDelay = options.initialReconnectDelay ?? 1000
    this.currentReconnectDelay = this.initialReconnectDelay
  }

  // --- DataProvider interface ---

  get status(): ConnectionStatus {
    return this._status
  }

  get connected(): boolean {
    return this._status === 'connected'
  }

  async connect(): Promise<void> {
    if (this._status === 'connected' || this._status === 'connecting') {
      return
    }

    this.isManualDisconnect = false
    return this.doConnect()
  }

  private doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setStatus('connecting')

      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          this.setStatus('connected')
          this.currentReconnectDelay = this.initialReconnectDelay // Reset backoff
          resolve()
        }

        this.ws.onclose = () => {
          this.handleDisconnect()
        }

        this.ws.onerror = (event) => {
          // Only reject if we haven't connected yet
          if (this._status === 'connecting') {
            reject(new Error(`WebSocket connection failed to ${this.url}`))
          }
          console.error('WebSocket error:', event)
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }
      } catch (err) {
        this.setStatus('disconnected')
        reject(err)
      }
    })
  }

  disconnect(): void {
    this.isManualDisconnect = true
    this.cancelReconnect()

    if (this.ws) {
      this.ws.onclose = null // Prevent reconnect attempt
      this.ws.close()
      this.ws = null
    }

    this.setStatus('disconnected')
  }

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

  // --- Private methods ---

  private setStatus(status: ConnectionStatus): void {
    this._status = status
    this.connectionCallbacks.forEach((cb) => cb(status))
  }

  private handleDisconnect(): void {
    this.ws = null

    if (this.isManualDisconnect) {
      this.setStatus('disconnected')
      return
    }

    if (this.autoReconnect) {
      this.setStatus('reconnecting')
      this.scheduleReconnect()
    } else {
      this.setStatus('disconnected')
    }
  }

  private scheduleReconnect(): void {
    this.cancelReconnect()

    this.reconnectTimeoutId = setTimeout(() => {
      this.attemptReconnect()
    }, this.currentReconnectDelay)

    // Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (capped)
    this.currentReconnectDelay = Math.min(
      this.currentReconnectDelay * 2,
      this.maxReconnectDelay
    )
  }

  private async attemptReconnect(): Promise<void> {
    try {
      await this.doConnect()
    } catch {
      // doConnect handles reconnect scheduling on failure via onclose
    }
  }

  private cancelReconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = null
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data)
      const type = message.msg || message.type

      switch (type) {
        case 'top':
          this.handleTopMessage(message)
          break
        case 'comp':
          this.handleCompMessage(message)
          break
        case 'oncourse':
          this.handleOnCourseMessage(message)
          break
        case 'control':
          this.handleControlMessage(message)
          break
        case 'title':
          this.handleTitleMessage(message)
          break
        case 'infotext':
          this.handleInfoTextMessage(message)
          break
        case 'daytime':
          this.handleDayTimeMessage(message)
          break
      }
    } catch (err) {
      console.warn('Failed to parse WebSocket message:', err)
    }
  }

  private handleTopMessage(message: { msg: string; data: Record<string, unknown> }): void {
    const payload = message.data

    const results: ResultsData = {
      results: this.parseResults(payload),
      raceName: (payload.RaceName as string) || '',
      raceStatus: (payload.RaceStatus as string) || '',
      highlightBib: payload.HighlightBib ? String(payload.HighlightBib) : null,
    }

    this.resultsCallbacks.forEach((cb) => cb(results))
  }

  private parseResults(payload: Record<string, unknown>): ResultsData['results'] {
    const list = payload.list as Array<Record<string, unknown>> | undefined
    if (!list || !Array.isArray(list)) {
      return []
    }

    return list.map((row) => ({
      rank: Number(row.Rank) || 0,
      bib: String(row.Bib || '').trim(),
      name: String(row.Name || ''),
      familyName: String(row.FamilyName || ''),
      givenName: String(row.GivenName || ''),
      club: String(row.Club || ''),
      nat: String(row.Nat || ''),
      total: String(row.Total || ''),
      pen: Number(row.Pen) || 0,
      behind: String(row.Behind || '').replace('&nbsp;', ''),
    }))
  }

  private handleCompMessage(message: { msg: string; data: Record<string, unknown> }): void {
    const payload = message.data
    const current = this.parseCompetitor(payload)

    const onCourseData: OnCourseData = {
      current,
      onCourse: current ? [current] : [],
    }

    this.onCourseCallbacks.forEach((cb) => cb(onCourseData))
  }

  private handleOnCourseMessage(message: { msg: string; data: Record<string, unknown>[] }): void {
    const competitors = message.data || []

    const parsed = competitors
      .map((c) => this.parseCompetitor(c))
      .filter((c): c is OnCourseCompetitor => c !== null)

    const onCourseData: OnCourseData = {
      current: parsed[0] || null,
      onCourse: parsed,
    }

    this.onCourseCallbacks.forEach((cb) => cb(onCourseData))
  }

  private parseCompetitor(data: Record<string, unknown>): OnCourseCompetitor | null {
    if (!data || !data.Bib || data.Bib === '') {
      return null
    }

    return {
      bib: String(data.Bib || ''),
      name: String(data.Name || ''),
      club: String(data.Club || ''),
      nat: String(data.Nat || ''),
      raceId: String(data.RaceId || ''),
      time: String(data.Time || ''),
      total: String(data.Total || ''),
      pen: Number(data.Pen) || 0,
      gates: String(data.Gates || ''),
      dtStart: data.dtStart ? String(data.dtStart) : null,
      dtFinish: data.dtFinish ? String(data.dtFinish) : null,
      ttbDiff: String(data.TTBDiff || ''),
      ttbName: String(data.TTBName || ''),
      rank: Number(data.Rank) || 0,
    }
  }

  private handleControlMessage(message: { msg: string; data: Record<string, string> }): void {
    const payload = message.data

    const visibility: VisibilityState = {
      displayCurrent: payload.displayCurrent === '1',
      displayTop: payload.displayTop === '1',
      displayTitle: payload.displayTitle === '1',
      displayTopBar: payload.displayTopBar === '1',
      displayFooter: payload.displayFooter === '1',
      displayDayTime: payload.displayDayTime === '1',
      displayOnCourse: payload.displayOnCourse === '1',
    }

    this.visibilityCallbacks.forEach((cb) => cb(visibility))
  }

  private handleTitleMessage(message: { msg: string; data: { text: string } }): void {
    const info: EventInfoData = {
      title: message.data?.text || '',
      infoText: '',
      dayTime: '',
    }

    this.eventInfoCallbacks.forEach((cb) => cb(info))
  }

  private handleInfoTextMessage(message: { msg: string; data: { text: string } }): void {
    const info: EventInfoData = {
      title: '',
      infoText: message.data?.text || '',
      dayTime: '',
    }

    this.eventInfoCallbacks.forEach((cb) => cb(info))
  }

  private handleDayTimeMessage(message: { msg: string; data: { time: string } }): void {
    const info: EventInfoData = {
      title: '',
      infoText: '',
      dayTime: message.data?.time || '',
    }

    this.eventInfoCallbacks.forEach((cb) => cb(info))
  }
}
