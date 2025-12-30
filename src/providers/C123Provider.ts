import type { ConnectionStatus, RaceConfig, VisibilityState, OnCourseCompetitor, Result } from '@/types'
import type {
  DataProvider,
  Unsubscribe,
  ResultsData,
  OnCourseData,
  ProviderError,
  EventInfoData,
} from './types'
import { CallbackManager } from './utils/CallbackManager'

/**
 * C123Provider options
 */
export interface C123ProviderOptions {
  /** Reconnect on disconnect (default: true) */
  autoReconnect?: boolean
  /** Maximum reconnect delay in ms (default: 30000) */
  maxReconnectDelay?: number
  /** Initial reconnect delay in ms (default: 1000) */
  initialReconnectDelay?: number
}

/**
 * C123Provider - Direct connection to Canoe123 via WebSocket proxy
 *
 * This provider connects to a WebSocket proxy (c123-proxy.js) that bridges
 * to the Canoe123 TCP server (port 27333). It parses XML messages directly
 * from the timing system.
 *
 * Requires running the proxy:
 *   node scripts/c123-proxy.js [c123-host] [ws-port]
 *
 * Protocol: XML messages over WebSocket (proxied from TCP)
 * Message types: OnCourse, Results, TimeOfDay, RaceConfig, Schedule
 *
 * See: analysis/07-sitova-komunikace.md for protocol documentation
 */
export class C123Provider implements DataProvider {
  private ws: WebSocket | null = null
  private _status: ConnectionStatus = 'disconnected'
  private url: string
  private autoReconnect: boolean
  private maxReconnectDelay: number
  private initialReconnectDelay: number
  private currentReconnectDelay: number
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null
  private isManualDisconnect = false

  // Callback manager (safeMode=false for C123Provider - errors bubble up)
  private callbacks = new CallbackManager(false)

  // XML parser
  private parser = new DOMParser()

  constructor(url: string, options: C123ProviderOptions = {}) {
    // Ensure proper WebSocket URL format
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      url = `ws://${url}`
    }
    // Validate URL format
    try {
      new URL(url)
    } catch {
      throw new Error(`Invalid WebSocket URL: ${url}`)
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

  // --- Private methods ---

  private setStatus(status: ConnectionStatus): void {
    this._status = status
    this.callbacks.emitConnection(status)
  }

  private emitError(
    code: ProviderError['code'],
    message: string,
    cause?: unknown
  ): void {
    this.callbacks.emitError(code, message, cause)
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
    // Check for proxy status messages (JSON)
    if (data.startsWith('{')) {
      try {
        const json = JSON.parse(data)
        if (json.type === 'proxy_status') {
          // Handle proxy status
          if (json.status === 'disconnected') {
            this.emitError('CONNECTION_ERROR', 'Proxy lost connection to C123')
          }
          return
        }
      } catch {
        // Not JSON, continue as XML
      }
    }

    // Parse XML message
    try {
      const doc = this.parser.parseFromString(data, 'text/xml')
      const parseError = doc.querySelector('parsererror')
      if (parseError) {
        this.emitError('PARSE_ERROR', 'Failed to parse XML message', data.slice(0, 100))
        return
      }

      const root = doc.querySelector('Canoe123')
      if (!root) {
        this.emitError('VALIDATION_ERROR', 'Missing Canoe123 root element')
        return
      }

      // Process child elements
      for (const child of Array.from(root.children)) {
        this.processXmlElement(child)
      }
    } catch (err) {
      this.emitError('PARSE_ERROR', 'Exception parsing XML', err)
    }
  }

  private processXmlElement(element: Element): void {
    const tagName = element.tagName

    try {
      switch (tagName) {
        case 'OnCourse':
          this.handleOnCourse(element)
          break
        case 'Results':
          this.handleResults(element)
          break
        case 'TimeOfDay':
          this.handleTimeOfDay(element)
          break
        case 'RaceConfig':
          this.handleRaceConfig(element)
          break
        case 'Schedule':
          // Schedule could be used for race list, not implemented yet
          break
        default:
          // Unknown element - ignore silently
          break
      }
    } catch (err) {
      console.warn(`Failed to process ${tagName} element:`, err)
      this.emitError('PARSE_ERROR', `Failed to process ${tagName} element`, err)
    }
  }

  /**
   * Handle OnCourse XML element
   * Contains competitors currently on course with their timing data
   */
  private handleOnCourse(element: Element): void {
    const competitors: OnCourseCompetitor[] = []

    // Each child contains Participant + Result elements
    for (const child of Array.from(element.children)) {
      if (child.tagName === 'OnCourse') {
        // Nested OnCourse for each competitor
        const competitor = this.parseOnCourseEntry(child)
        if (competitor) {
          competitors.push(competitor)
        }
      }
    }

    // Also check for direct Participant (single competitor format)
    const participant = element.querySelector('Participant')
    if (participant && competitors.length === 0) {
      const competitor = this.parseOnCourseEntry(element)
      if (competitor) {
        competitors.push(competitor)
      }
    }

    const onCourseData: OnCourseData = {
      current: competitors[0] || null,
      onCourse: competitors,
      updateOnCourse: true,
    }

    this.callbacks.emitOnCourse(onCourseData)
  }

  /**
   * Parse single OnCourse entry (Participant + Result elements)
   */
  private parseOnCourseEntry(container: Element): OnCourseCompetitor | null {
    const participant = container.querySelector('Participant')
    if (!participant) return null

    const bib = participant.getAttribute('Bib') || ''
    if (!bib) return null

    // Find Result elements
    const resultC = container.querySelector('Result[Type="C"]')
    const resultT = container.querySelector('Result[Type="T"]')

    return {
      bib,
      name: participant.getAttribute('Name') || '',
      club: participant.getAttribute('Club') || '',
      nat: participant.getAttribute('Nat') || '',
      raceId: participant.getAttribute('RaceId') || '',
      time: resultT?.getAttribute('Time') || '',
      total: resultT?.getAttribute('Total') || '',
      pen: parseInt(resultT?.getAttribute('Pen') || '0', 10) || 0,
      gates: resultC?.getAttribute('Gates') || '',
      dtStart: resultC?.getAttribute('dtStart') || null,
      dtFinish: resultC?.getAttribute('dtFinish') || null,
      ttbDiff: resultT?.getAttribute('TTBDiff') || '',
      ttbName: resultT?.getAttribute('TTBName') || '',
      rank: parseInt(resultT?.getAttribute('Rank') || '0', 10) || 0,
    }
  }

  /**
   * Handle Results XML element
   * Contains full results list for a category
   */
  private handleResults(element: Element): void {
    const mainTitle = element.getAttribute('MainTitle') || ''
    const subTitle = element.getAttribute('SubTitle') || ''

    const results: Result[] = []

    // Parse Row elements
    for (const row of Array.from(element.querySelectorAll('Row'))) {
      const participant = row.querySelector('Participant')
      const result = row.querySelector('Result[Type="T"]')

      if (!participant) continue

      const bib = participant.getAttribute('Bib') || ''
      if (!bib) continue

      results.push({
        rank: parseInt(result?.getAttribute('Rank') || row.getAttribute('Number') || '0', 10) || 0,
        bib,
        name: participant.getAttribute('Name') || '',
        familyName: participant.getAttribute('FamilyName') || '',
        givenName: participant.getAttribute('GivenName') || '',
        club: participant.getAttribute('Club') || '',
        nat: participant.getAttribute('Nat') || '',
        total: result?.getAttribute('Total') || result?.getAttribute('Time') || '',
        pen: parseInt(result?.getAttribute('Pen') || '0', 10) || 0,
        behind: result?.getAttribute('Behind') || '',
      })
    }

    // Sort by rank
    results.sort((a, b) => a.rank - b.rank)

    const raceName = mainTitle + (subTitle ? ` - ${subTitle}` : '')

    // Note: C123 doesn't have HighlightBib - we detect finish via dtFinish change
    // For now, we don't emit highlight from C123 directly
    const resultsData: ResultsData = {
      results,
      raceName,
      raceStatus: element.getAttribute('Current') === 'Y' ? '3' : '5', // 3 = running, 5 = finished
      highlightBib: null,
    }

    this.callbacks.emitResults(resultsData)
  }

  /**
   * Handle TimeOfDay XML element
   */
  private handleTimeOfDay(element: Element): void {
    const time = element.textContent || ''

    const eventInfo: EventInfoData = {
      title: '',
      infoText: '',
      dayTime: time,
    }

    this.callbacks.emitEventInfo(eventInfo)
  }

  /**
   * Handle RaceConfig XML element
   */
  private handleRaceConfig(element: Element): void {
    const config: RaceConfig = {
      raceName: '',
      raceStatus: '',
      gateCount: parseInt(element.getAttribute('NrGates') || '0', 10) || 0,
    }

    this.callbacks.emitConfig(config)
  }
}
