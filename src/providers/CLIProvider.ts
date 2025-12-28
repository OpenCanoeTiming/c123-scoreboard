import type { ConnectionStatus, OnCourseCompetitor, RaceConfig, VisibilityState } from '@/types'
import type {
  DataProvider,
  Unsubscribe,
  ResultsData,
  OnCourseData,
  EventInfoData,
  ProviderError,
} from './types'
import {
  isObject,
  isArray,
  safeString,
  safeNumber,
  validateTopMessage,
  validateCompMessage,
  validateOnCourseMessage,
  validateControlMessage,
  validateTextMessage,
  validateResultRow,
} from './utils/validation'

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
  private errorCallbacks = new Set<(error: ProviderError) => void>()

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

  onError(callback: (error: ProviderError) => void): Unsubscribe {
    this.errorCallbacks.add(callback)
    return () => this.errorCallbacks.delete(callback)
  }

  // --- Private methods ---

  private setStatus(status: ConnectionStatus): void {
    this._status = status
    this.connectionCallbacks.forEach((cb) => cb(status))
  }

  private emitError(
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
    this.errorCallbacks.forEach((cb) => cb(error))
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
    let message: unknown

    try {
      message = JSON.parse(data)
    } catch (err) {
      console.warn('Failed to parse WebSocket message as JSON:', err)
      this.emitError('PARSE_ERROR', 'Failed to parse WebSocket message as JSON', err)
      return
    }

    if (!isObject(message)) {
      console.warn('WebSocket message is not an object:', message)
      this.emitError('VALIDATION_ERROR', 'WebSocket message is not an object')
      return
    }

    const type = message.msg || message.type

    try {
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
        default:
          // Unknown message type - ignore silently (may be extension messages)
          break
      }
    } catch (err) {
      console.warn(`Failed to process ${type} message:`, err)
      this.emitError('PARSE_ERROR', `Failed to process ${type} message`, err)
    }
  }

  private handleTopMessage(message: Record<string, unknown>): void {
    const validation = validateTopMessage(message)
    if (!validation.valid) {
      this.emitError('VALIDATION_ERROR', `Invalid top message: ${validation.error}`)
      return
    }

    const payload = message.data as Record<string, unknown>

    const results: ResultsData = {
      results: this.parseResults(payload),
      raceName: safeString(payload.RaceName),
      raceStatus: safeString(payload.RaceStatus),
      highlightBib: payload.HighlightBib ? safeString(payload.HighlightBib) : null,
    }

    this.resultsCallbacks.forEach((cb) => cb(results))
  }

  private parseResults(payload: Record<string, unknown>): ResultsData['results'] {
    const list = payload.list
    if (!isArray(list)) {
      return []
    }

    return list
      .filter((row) => {
        const validation = validateResultRow(row)
        if (!validation.valid) {
          console.warn('Skipping invalid result row:', validation.error)
          return false
        }
        return true
      })
      .map((row) => {
        const r = row as Record<string, unknown>
        return {
          rank: safeNumber(r.Rank, 0),
          bib: safeString(r.Bib).trim(),
          name: safeString(r.Name),
          familyName: safeString(r.FamilyName),
          givenName: safeString(r.GivenName),
          club: safeString(r.Club),
          nat: safeString(r.Nat),
          total: safeString(r.Total),
          pen: safeNumber(r.Pen, 0),
          behind: safeString(r.Behind).replace('&nbsp;', ''),
        }
      })
  }

  private handleCompMessage(message: Record<string, unknown>): void {
    const validation = validateCompMessage(message)
    if (!validation.valid) {
      this.emitError('VALIDATION_ERROR', `Invalid comp message: ${validation.error}`)
      return
    }

    const payload = message.data as Record<string, unknown>
    const current = this.parseCompetitor(payload)

    const onCourseData: OnCourseData = {
      current,
      onCourse: current ? [current] : [],
    }

    this.onCourseCallbacks.forEach((cb) => cb(onCourseData))
  }

  private handleOnCourseMessage(message: Record<string, unknown>): void {
    const validation = validateOnCourseMessage(message)
    if (!validation.valid) {
      this.emitError('VALIDATION_ERROR', `Invalid oncourse message: ${validation.error}`)
      return
    }

    const competitors = message.data as unknown[]

    const parsed = competitors
      .filter((c) => isObject(c))
      .map((c) => this.parseCompetitor(c as Record<string, unknown>))
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
      bib: safeString(data.Bib),
      name: safeString(data.Name),
      club: safeString(data.Club),
      nat: safeString(data.Nat),
      raceId: safeString(data.RaceId),
      time: safeString(data.Time),
      total: safeString(data.Total),
      pen: safeNumber(data.Pen, 0),
      gates: safeString(data.Gates),
      dtStart: data.dtStart ? safeString(data.dtStart) : null,
      dtFinish: data.dtFinish ? safeString(data.dtFinish) : null,
      ttbDiff: safeString(data.TTBDiff),
      ttbName: safeString(data.TTBName),
      rank: safeNumber(data.Rank, 0),
    }
  }

  private handleControlMessage(message: Record<string, unknown>): void {
    const validation = validateControlMessage(message)
    if (!validation.valid) {
      this.emitError('VALIDATION_ERROR', `Invalid control message: ${validation.error}`)
      return
    }

    const payload = message.data as Record<string, unknown>

    const visibility: VisibilityState = {
      displayCurrent: safeString(payload.displayCurrent) === '1',
      displayTop: safeString(payload.displayTop) === '1',
      displayTitle: safeString(payload.displayTitle) === '1',
      displayTopBar: safeString(payload.displayTopBar) === '1',
      displayFooter: safeString(payload.displayFooter) === '1',
      displayDayTime: safeString(payload.displayDayTime) === '1',
      displayOnCourse: safeString(payload.displayOnCourse) === '1',
    }

    this.visibilityCallbacks.forEach((cb) => cb(visibility))
  }

  private handleTitleMessage(message: Record<string, unknown>): void {
    const validation = validateTextMessage(message, 'title')
    if (!validation.valid) {
      this.emitError('VALIDATION_ERROR', `Invalid title message: ${validation.error}`)
      return
    }

    const payload = message.data as Record<string, unknown>
    const info: EventInfoData = {
      title: safeString(payload.text),
      infoText: '',
      dayTime: '',
    }

    this.eventInfoCallbacks.forEach((cb) => cb(info))
  }

  private handleInfoTextMessage(message: Record<string, unknown>): void {
    const validation = validateTextMessage(message, 'infotext')
    if (!validation.valid) {
      this.emitError('VALIDATION_ERROR', `Invalid infotext message: ${validation.error}`)
      return
    }

    const payload = message.data as Record<string, unknown>
    const info: EventInfoData = {
      title: '',
      infoText: safeString(payload.text),
      dayTime: '',
    }

    this.eventInfoCallbacks.forEach((cb) => cb(info))
  }

  private handleDayTimeMessage(message: Record<string, unknown>): void {
    const validation = validateTextMessage(message, 'daytime')
    if (!validation.valid) {
      this.emitError('VALIDATION_ERROR', `Invalid daytime message: ${validation.error}`)
      return
    }

    const payload = message.data as Record<string, unknown>
    const info: EventInfoData = {
      title: '',
      infoText: '',
      dayTime: safeString(payload.time),
    }

    this.eventInfoCallbacks.forEach((cb) => cb(info))
  }
}
