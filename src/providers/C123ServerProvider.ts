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

import type { ConnectionStatus, RaceConfig, VisibilityState, Result } from '@/types'
import type {
  C123ServerMessage,
  C123ConnectedData,
  C123OnCourseData,
  C123ResultsData,
  C123TimeOfDayData,
  C123RaceConfigData,
  C123ErrorData,
  C123XmlChangeData,
  C123ForceRefreshData,
  C123ConfigPushData,
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
import { getWebSocketUrl, getServerInfo, getClientIdFromUrl } from './utils/discovery-client'
import { mapOnCourse, mapResults, mapTimeOfDay, mapRaceConfig } from './utils/c123ServerMapper'
import { C123ServerApi } from './utils/c123ServerApi'
import { BR2Manager } from './utils/br1br2Merger'
import { saveAssets, isValidAssetUrl, type AssetConfig } from '@/utils/assetStorage'

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
  /** REST API timeout in ms (default: 5000) */
  apiTimeout?: number
  /** Sync state via REST API after reconnect (default: true) */
  syncOnReconnect?: boolean
  /** Client ID for server identification (default: from URL ?clientId param) */
  clientId?: string
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
  private httpUrl: string
  private clientId: string | null
  private autoReconnect: boolean
  private maxReconnectDelay: number
  private initialReconnectDelay: number
  private currentReconnectDelay: number
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null
  private isManualDisconnect = false
  private syncOnReconnect: boolean
  private isReconnect = false
  private connectPromise: Promise<void> | null = null

  // REST API client for sync operations
  private api: C123ServerApi

  // BR2 Manager for merging BR1/BR2 results
  private br2Manager: BR2Manager

  // Track current race for config mapping
  private currentRaceName: string = ''
  private currentRaceId: string = ''
  private currentRaceIsCurrent: boolean = true

  // Last results data for re-emit after BR1 cache update
  private lastResultsData: Result[] = []

  // Track last XML checksum to avoid redundant syncs
  private lastXmlChecksum: string = ''

  // Callback manager (safeMode=false - errors bubble up)
  private callbacks = new CallbackManager(false)

  /**
   * Create C123ServerProvider instance
   *
   * @param serverUrl - Server HTTP URL (e.g., "http://192.168.1.50:27123")
   * @param options - Provider options
   */
  constructor(serverUrl: string, options: C123ServerProviderOptions = {}) {
    // Get clientId from options or URL parameter
    this.clientId = options.clientId ?? getClientIdFromUrl()
    this.wsUrl = getWebSocketUrl(serverUrl, this.clientId ?? undefined)
    // Normalize HTTP URL for REST API
    this.httpUrl = serverUrl.replace(/\/$/, '')
    if (!this.httpUrl.startsWith('http')) {
      this.httpUrl = `http://${this.httpUrl}`
    }
    this.autoReconnect = options.autoReconnect ?? true
    this.maxReconnectDelay = options.maxReconnectDelay ?? 30000
    this.initialReconnectDelay = options.initialReconnectDelay ?? 1000
    this.currentReconnectDelay = this.initialReconnectDelay
    this.syncOnReconnect = options.syncOnReconnect ?? true
    this.api = new C123ServerApi(this.httpUrl, options.apiTimeout ?? 5000)

    // Initialize BR2 Manager for merging BR1/BR2 results
    // BR1 from REST API (stable), BR2 from WebSocket time+pen (live)
    this.br2Manager = new BR2Manager(this.api, () => {
      this.reemitResultsWithBR1Data()
    })
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
    // If already connected, nothing to do
    if (this._status === 'connected') {
      return
    }

    // If connect is already in progress, return the existing promise
    // This prevents double-connect issues with React StrictMode
    if (this._status === 'connecting' && this.connectPromise) {
      return this.connectPromise
    }

    this.isManualDisconnect = false
    this.connectPromise = this.doConnect()

    try {
      await this.connectPromise
    } finally {
      this.connectPromise = null
    }
  }

  disconnect(): void {
    this.isManualDisconnect = true
    this.cancelReconnect()
    this.br2Manager.dispose()

    if (this.ws) {
      const ws = this.ws

      if (ws.readyState === WebSocket.CONNECTING) {
        // WebSocket is still connecting - don't call close() directly
        // as it causes "WebSocket is closed before connection established" error
        // Instead, let it connect and close immediately, or fail naturally
        ws.onmessage = null
        ws.onerror = null
        ws.onopen = () => {
          ws.close()
        }
        ws.onclose = null
      } else if (ws.readyState === WebSocket.OPEN) {
        // WebSocket is open - remove handlers and close
        ws.onopen = null
        ws.onclose = null
        ws.onerror = null
        ws.onmessage = null
        ws.close()
      } else {
        // CLOSING or CLOSED - just remove handlers
        ws.onopen = null
        ws.onclose = null
        ws.onerror = null
        ws.onmessage = null
      }

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
          const wasReconnect = this.isReconnect
          this.isReconnect = true // Next connect will be a reconnect
          this.setStatus('connected')
          this.currentReconnectDelay = this.initialReconnectDelay // Reset backoff

          // Fetch event name on every connect (initial and reconnect)
          this.fetchEventName().catch(err => {
            console.warn('C123Server: Failed to fetch event name:', err)
          })

          // Sync state via REST API after reconnect
          if (wasReconnect && this.syncOnReconnect) {
            this.syncState().catch(err => {
              console.warn('C123Server: Failed to sync state after reconnect:', err)
            })
          }

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
          this.handleXmlChange(message.data as C123XmlChangeData)
          break
        case 'Error':
          this.handleServerError(message.data as C123ErrorData)
          break
        case 'ForceRefresh':
          this.handleForceRefresh(message.data as C123ForceRefreshData)
          break
        case 'ConfigPush':
          this.handleConfigPush(message.data as C123ConfigPushData)
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

    // Fetch event name from discovery endpoint and emit as title
    this.fetchEventName().catch(err => {
      console.warn('C123Server: Failed to fetch event name:', err)
    })
  }

  /**
   * Fetch event name and emit as EventInfo title
   *
   * Priority:
   * 1. customTitle from URL params (set by ConfigPush)
   * 2. eventName from /api/discover endpoint
   */
  private async fetchEventName(): Promise<void> {
    // Check for customTitle in URL params (highest priority)
    const urlParams = new URLSearchParams(window.location.search)
    const customTitle = urlParams.get('customTitle')

    if (customTitle) {
      console.log(`C123Server: Using custom title from URL: ${customTitle}`)
      this.callbacks.emitEventInfo({ title: customTitle })
      return
    }

    // Fall back to eventName from discover endpoint
    const serverInfo = await getServerInfo(this.httpUrl)
    if (serverInfo?.eventName) {
      console.log(`C123Server: Event name: ${serverInfo.eventName}`)
      this.callbacks.emitEventInfo({ title: serverInfo.eventName })
    }
  }

  private handleTimeOfDay(data: C123TimeOfDayData): void {
    const eventInfo = mapTimeOfDay(data)
    this.callbacks.emitEventInfo(eventInfo)
  }

  private handleOnCourse(data: C123OnCourseData): void {
    const onCourseData = mapOnCourse(data)

    // Update BR2 Manager with live penalties from OnCourse
    // OnCourse has the most up-to-date penalty info (even after finish)
    this.br2Manager.updateOnCoursePenalties(
      data.competitors.map(c => ({ bib: c.bib, pen: c.pen }))
    )

    this.callbacks.emitOnCourse(onCourseData)
  }

  private handleResults(data: C123ResultsData): void {
    // Track current race info for config mapping and REST API sync
    this.currentRaceName = data.mainTitle || data.raceId
    this.currentRaceId = data.raceId
    this.currentRaceIsCurrent = data.isCurrent

    const resultsData = mapResults(data)

    // Store for re-emit after BR1 cache update
    this.lastResultsData = resultsData.results

    // Process through BR2 Manager for BR1/BR2 merging
    const processedResults = this.br2Manager.processResults(
      resultsData.results,
      data.raceId
    )

    // Emit results (enriched with run1/run2 if BR2 race)
    this.callbacks.emitResults({
      ...resultsData,
      results: processedResults,
      isBR2: this.br2Manager.isBR2Mode,
    })
  }

  /**
   * Re-emit results after BR1 cache is updated
   */
  private reemitResultsWithBR1Data(): void {
    if (this.lastResultsData.length === 0 || !this.currentRaceId) return

    const processedResults = this.br2Manager.processResults(
      this.lastResultsData,
      this.currentRaceId
    )

    this.callbacks.emitResults({
      results: processedResults,
      raceName: this.currentRaceName,
      raceStatus: this.currentRaceIsCurrent ? 'In Progress' : 'Unofficial',
      highlightBib: null,
      raceId: this.currentRaceId,
      isBR2: this.br2Manager.isBR2Mode,
    })
  }

  private handleRaceConfig(data: C123RaceConfigData): void {
    const config = mapRaceConfig(data, this.currentRaceName, this.currentRaceIsCurrent)
    this.callbacks.emitConfig(config)
  }

  private handleServerError(data: C123ErrorData): void {
    console.error(`C123Server error: [${data.code}] ${data.message}`)
    this.emitError('UNKNOWN_ERROR', `C123 Server: ${data.message}`)
  }

  private handleXmlChange(data: C123XmlChangeData): void {
    // Skip if checksum hasn't changed (duplicate notification)
    if (data.checksum === this.lastXmlChecksum) {
      return
    }
    this.lastXmlChecksum = data.checksum

    // Sync relevant sections via REST API
    // Results changes are handled by real-time WebSocket messages,
    // but we sync anyway to ensure consistency after XML file updates
    if (data.sections.includes('Results') && this.currentRaceId) {
      this.syncResults(this.currentRaceId).catch(err => {
        console.warn('C123Server: Failed to sync results after XmlChange:', err)
      })
    }
  }

  private handleForceRefresh(data: C123ForceRefreshData): void {
    console.log(`C123Server: Force refresh requested - ${data.reason || 'No reason provided'}`)
    // Perform hard reload (bypass cache)
    window.location.reload()
  }

  private handleConfigPush(data: C123ConfigPushData): void {
    console.log('C123Server: Received config push:', data)

    // Save assets to localStorage if provided (persisted for useAssets hook)
    const assetsToSave: AssetConfig = {}
    if (data.logoUrl && isValidAssetUrl(data.logoUrl)) {
      assetsToSave.logoUrl = data.logoUrl
    }
    if (data.partnerLogoUrl && isValidAssetUrl(data.partnerLogoUrl)) {
      assetsToSave.partnerLogoUrl = data.partnerLogoUrl
    }
    if (data.footerImageUrl && isValidAssetUrl(data.footerImageUrl)) {
      assetsToSave.footerImageUrl = data.footerImageUrl
    }
    if (Object.keys(assetsToSave).length > 0) {
      saveAssets(assetsToSave)
      console.log('C123Server: Saved assets to localStorage:', assetsToSave)
    }

    // Apply configuration changes by updating URL parameters and reloading
    // This ensures the layout hook picks up the new values
    const url = new URL(window.location.href)

    // Apply clientId - if changed, will trigger reconnect with new ID
    if (data.clientId !== undefined) {
      const currentClientId = url.searchParams.get('clientId')
      if (data.clientId !== currentClientId) {
        console.log(`C123Server: Client ID changed: ${currentClientId} -> ${data.clientId}`)
        url.searchParams.set('clientId', data.clientId)
      }
    }

    // Apply layout type
    if (data.type !== undefined) {
      url.searchParams.set('type', data.type)
    }

    // Apply display rows
    if (data.displayRows !== undefined) {
      url.searchParams.set('displayRows', String(data.displayRows))
    }

    // Apply custom title (stored for use by components)
    if (data.customTitle !== undefined) {
      url.searchParams.set('customTitle', data.customTitle)
    }

    // Apply scrollToFinished
    if (data.scrollToFinished !== undefined) {
      url.searchParams.set('scrollToFinished', String(data.scrollToFinished))
    }

    // Check if URL changed or assets were saved (reload needed to apply new assets)
    const hasAssetChanges = Object.keys(assetsToSave).length > 0
    if (url.href !== window.location.href || hasAssetChanges) {
      console.log('C123Server: Applying config push - reloading with new config')
      window.location.href = url.href
    } else {
      console.log('C123Server: Config push received but no changes to apply')
    }

    // Send ClientState response
    this.sendClientState(data)
  }

  /**
   * Send ClientState message to server reporting current configuration
   */
  private sendClientState(appliedConfig: C123ConfigPushData): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    const params = new URLSearchParams(window.location.search)
    const scrollToFinishedParam = params.get('scrollToFinished')
    const message = {
      type: 'ClientState',
      timestamp: new Date().toISOString(),
      data: {
        current: {
          clientId: params.get('clientId') || appliedConfig.clientId || undefined,
          type: params.get('type') || appliedConfig.type || 'vertical',
          displayRows: parseInt(params.get('displayRows') || '', 10) || appliedConfig.displayRows || 10,
          customTitle: params.get('customTitle') || appliedConfig.customTitle || undefined,
          scrollToFinished: scrollToFinishedParam !== null ? scrollToFinishedParam !== 'false' : appliedConfig.scrollToFinished ?? true,
          // Report current asset URLs (from ConfigPush)
          logoUrl: appliedConfig.logoUrl || undefined,
          partnerLogoUrl: appliedConfig.partnerLogoUrl || undefined,
          footerImageUrl: appliedConfig.footerImageUrl || undefined,
        },
        version: '3.0.0',
        capabilities: ['configPush', 'forceRefresh', 'clientIdPush', 'scrollToFinished', 'assetManagement'],
      },
    }

    try {
      this.ws.send(JSON.stringify(message))
      console.log('C123Server: Sent ClientState response')
    } catch (err) {
      console.warn('C123Server: Failed to send ClientState:', err)
    }
  }

  // ===========================================================================
  // REST API Sync
  // ===========================================================================

  /**
   * Sync state via REST API after reconnect
   *
   * Fetches current server status and race results to ensure
   * the scoreboard has complete state after a reconnection.
   */
  private async syncState(): Promise<void> {
    // Get server status to check current race
    const status = await this.api.getStatus()
    if (!status) {
      console.warn('C123Server: Could not fetch server status for sync')
      return
    }

    // If there's a current race, fetch its results
    if (status.event.currentRaceId) {
      await this.syncResults(status.event.currentRaceId)
    }
  }

  /**
   * Sync results for a specific race via REST API
   */
  private async syncResults(raceId: string): Promise<void> {
    const raceInfo = await this.api.getRaceInfo(raceId)
    if (!raceInfo) {
      return
    }

    // Note: REST API returns raw race data, but the WebSocket already provides
    // properly formatted Results messages. The main purpose of this sync is to
    // ensure we have the latest data after reconnect or XML changes.
    // The WebSocket will continue to provide real-time updates.
    console.log(`C123Server: Synced race info for ${raceId}`)
  }

  private emitError(
    code: ProviderError['code'],
    message: string,
    cause?: unknown
  ): void {
    this.callbacks.emitError(code, message, cause)
  }
}
