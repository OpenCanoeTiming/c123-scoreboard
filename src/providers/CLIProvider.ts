import type { ConnectionStatus, RaceConfig, VisibilityState } from '@/types'
import type {
  DataProvider,
  Unsubscribe,
  ResultsData,
  OnCourseData,
  ProviderError,
  EventInfoData,
} from './types'
import {
  isObject,
  validateTopMessage,
  validateCompMessage,
  validateOnCourseMessage,
  validateControlMessage,
  validateTextMessage,
} from './utils/validation'
import { CallbackManager } from './utils/CallbackManager'
import {
  transformTopMessage,
  transformCompMessage,
  transformOnCourseMessage,
  transformControlMessage,
  transformTitleMessage,
  transformInfoTextMessage,
  transformDayTimeMessage,
} from './utils/messageHandlers'

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

  // Callback manager (safeMode=false for CLIProvider - errors bubble up)
  private callbacks = new CallbackManager(false)

  constructor(url: string, options: CLIProviderOptions = {}) {
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
    const results = transformTopMessage(payload)
    this.callbacks.emitResults(results)
  }

  private handleCompMessage(message: Record<string, unknown>): void {
    const validation = validateCompMessage(message)
    if (!validation.valid) {
      this.emitError('VALIDATION_ERROR', `Invalid comp message: ${validation.error}`)
      return
    }

    const payload = message.data as Record<string, unknown>
    const onCourseData = transformCompMessage(payload)
    this.callbacks.emitOnCourse(onCourseData)
  }

  private handleOnCourseMessage(message: Record<string, unknown>): void {
    const validation = validateOnCourseMessage(message)
    if (!validation.valid) {
      this.emitError('VALIDATION_ERROR', `Invalid oncourse message: ${validation.error}`)
      return
    }

    const competitors = message.data as unknown[]
    const onCourseData = transformOnCourseMessage(competitors)
    this.callbacks.emitOnCourse(onCourseData)
  }

  private handleControlMessage(message: Record<string, unknown>): void {
    const validation = validateControlMessage(message)
    if (!validation.valid) {
      this.emitError('VALIDATION_ERROR', `Invalid control message: ${validation.error}`)
      return
    }

    const payload = message.data as Record<string, unknown>
    const visibility = transformControlMessage(payload)
    this.callbacks.emitVisibility(visibility)
  }

  private handleTitleMessage(message: Record<string, unknown>): void {
    const validation = validateTextMessage(message, 'title')
    if (!validation.valid) {
      this.emitError('VALIDATION_ERROR', `Invalid title message: ${validation.error}`)
      return
    }

    const payload = message.data as Record<string, unknown>
    const info = transformTitleMessage(payload)
    this.callbacks.emitEventInfo(info)
  }

  private handleInfoTextMessage(message: Record<string, unknown>): void {
    const validation = validateTextMessage(message, 'infotext')
    if (!validation.valid) {
      this.emitError('VALIDATION_ERROR', `Invalid infotext message: ${validation.error}`)
      return
    }

    const payload = message.data as Record<string, unknown>
    const info = transformInfoTextMessage(payload)
    this.callbacks.emitEventInfo(info)
  }

  private handleDayTimeMessage(message: Record<string, unknown>): void {
    const validation = validateTextMessage(message, 'daytime')
    if (!validation.valid) {
      this.emitError('VALIDATION_ERROR', `Invalid daytime message: ${validation.error}`)
      return
    }

    const payload = message.data as Record<string, unknown>
    const info = transformDayTimeMessage(payload)
    this.callbacks.emitEventInfo(info)
  }
}
