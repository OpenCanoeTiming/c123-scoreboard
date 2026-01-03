/**
 * C123ServerProvider - WebSocket connection to C123 Server
 *
 * This provider connects to C123 Server (port 27123) and receives live timing data
 * in JSON format. It implements exponential backoff for automatic reconnection.
 *
 * Protocol: JSON messages over WebSocket (/ws endpoint)
 * Message types: Connected, TimeOfDay, OnCourse, Results, RaceConfig, Schedule, XmlChange, Error
 *
 * Usage:
 *   const provider = new C123ServerProvider('http://192.168.1.50:27123')
 *   await provider.connect()
 */

import type { ConnectionStatus, RaceConfig, VisibilityState } from '@/types'
import type {
  C123ServerMessage,
  C123ConnectedData,
  C123OnCourseData,
  C123ResultsData,
  C123TimeOfDayData,
  C123RaceConfigData,
  C123ErrorData,
} from '@/types/c123server'
import type {
  DataProvider,
  Unsubscribe,
  ResultsData,
  OnCourseData,
  ProviderError,
  EventInfoData,
} from './types'
import { CallbackManager } from './utils/CallbackManager'
import { getWebSocketUrl } from './utils/discovery-client'
import { mapOnCourse, mapResults, mapTimeOfDay, mapRaceConfig } from './utils/c123ServerMapper'

// =============================================================================
// Types
// =============================================================================

/**
 * C123ServerProvider options
 */
export interface C123ServerProviderOptions {
  /** Reconnect on disconnect (default: true) */
  autoReconnect?: boolean
  /** Maximum reconnect delay in ms (default: 30000) */
  maxReconnectDelay?: number
  /** Initial reconnect delay in ms (default: 1000) */
  initialReconnectDelay?: number
}

// =============================================================================
// Provider Implementation
// =============================================================================

/**
 * C123ServerProvider - Primary data provider for scoreboard
 *
 * Connects to C123 Server WebSocket endpoint and receives JSON messages.
 * Implements DataProvider interface with exponential backoff reconnection.
 */
export class C123ServerProvider implements DataProvider {
  private ws: WebSocket | null = null
  private _status: ConnectionStatus = 'disconnected'
  private wsUrl: string
  private autoReconnect: boolean
  private maxReconnectDelay: number
  private initialReconnectDelay: number
  private currentReconnectDelay: number
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null
  private isManualDisconnect = false

  // Track current race for config mapping
  private currentRaceName: string = ''
  private currentRaceIsCurrent: boolean = true

  // Callback manager (safeMode=false - errors bubble up)
  private callbacks = new CallbackManager(false)

  /**
   * Create C123ServerProvider instance
   *
   * @param serverUrl - Server HTTP URL (e.g., "http://192.168.1.50:27123")
   * @param options - Provider options
   */
  constructor(serverUrl: string, options: C123ServerProviderOptions = {}) {
    this.wsUrl = getWebSocketUrl(serverUrl)
    this.autoReconnect = options.autoReconnect ?? true
    this.maxReconnectDelay = options.maxReconnectDelay ?? 30000
    this.initialReconnectDelay = options.initialReconnectDelay ?? 1000
    this.currentReconnectDelay = this.initialReconnectDelay
  }

  // ===========================================================================
  // DataProvider Interface
  // ===========================================================================

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

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  private doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setStatus('connecting')

      try {
        this.ws = new WebSocket(this.wsUrl)

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
            reject(new Error(`WebSocket connection failed to ${this.wsUrl}`))
          }
          console.error('C123Server WebSocket error:', event)
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

  private setStatus(status: ConnectionStatus): void {
    this._status = status
    this.callbacks.emitConnection(status)
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

    // Exponential backoff: 1s -> 2s -> 4s -> 8s -> 16s -> 30s (capped)
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

  // ===========================================================================
  // Message Handling
  // ===========================================================================

  private handleMessage(data: string): void {
    let message: C123ServerMessage

    try {
      message = JSON.parse(data)
    } catch (err) {
      console.warn('C123Server: Failed to parse message as JSON:', err)
      this.emitError('PARSE_ERROR', 'Failed to parse C123 Server message as JSON', err)
      return
    }

    if (!message || typeof message.type !== 'string') {
      console.warn('C123Server: Invalid message format:', message)
      this.emitError('VALIDATION_ERROR', 'Invalid C123 Server message format')
      return
    }

    try {
      switch (message.type) {
        case 'Connected':
          this.handleConnected(message.data as C123ConnectedData)
          break
        case 'TimeOfDay':
          this.handleTimeOfDay(message.data as C123TimeOfDayData)
          break
        case 'OnCourse':
          this.handleOnCourse(message.data as C123OnCourseData)
          break
        case 'Results':
          this.handleResults(message.data as C123ResultsData)
          break
        case 'RaceConfig':
          this.handleRaceConfig(message.data as C123RaceConfigData)
          break
        case 'Schedule':
          // Schedule is informational - could be used for race list
          // Not needed for basic scoreboard functionality
          break
        case 'XmlChange':
          // XmlChange is for triggering REST API sync (Phase B)
          // Currently ignored - real-time messages are sufficient
          break
        case 'Error':
          this.handleServerError(message.data as C123ErrorData)
          break
        default:
          // Unknown message type - ignore silently (extensibility)
          break
      }
    } catch (err) {
      console.warn(`C123Server: Failed to process ${message.type} message:`, err)
      this.emitError('PARSE_ERROR', `Failed to process ${message.type} message`, err)
    }
  }

  private handleConnected(data: C123ConnectedData): void {
    console.log(`C123Server: Connected (v${data.version}, c123=${data.c123Connected}, xml=${data.xmlLoaded})`)

    if (!data.c123Connected) {
      // C123 timing system not connected to server
      this.emitError('CONNECTION_ERROR', 'C123 Server is not connected to timing system')
    }
  }

  private handleTimeOfDay(data: C123TimeOfDayData): void {
    const eventInfo = mapTimeOfDay(data)
    this.callbacks.emitEventInfo(eventInfo)
  }

  private handleOnCourse(data: C123OnCourseData): void {
    const onCourseData = mapOnCourse(data)
    this.callbacks.emitOnCourse(onCourseData)
  }

  private handleResults(data: C123ResultsData): void {
    // Track current race info for config mapping
    this.currentRaceName = data.mainTitle || data.raceId
    this.currentRaceIsCurrent = data.isCurrent

    const resultsData = mapResults(data)
    this.callbacks.emitResults(resultsData)
  }

  private handleRaceConfig(data: C123RaceConfigData): void {
    const config = mapRaceConfig(data, this.currentRaceName, this.currentRaceIsCurrent)
    this.callbacks.emitConfig(config)
  }

  private handleServerError(data: C123ErrorData): void {
    console.error(`C123Server error: [${data.code}] ${data.message}`)
    this.emitError('UNKNOWN_ERROR', `C123 Server: ${data.message}`)
  }

  private emitError(
    code: ProviderError['code'],
    message: string,
    cause?: unknown
  ): void {
    this.callbacks.emitError(code, message, cause)
  }
}
