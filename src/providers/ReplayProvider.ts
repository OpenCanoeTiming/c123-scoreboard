import type { ConnectionStatus, RaceConfig } from '@/types'
import type {
  DataProvider,
  Unsubscribe,
  ResultsData,
  OnCourseData,
  ProviderError,
} from './types'
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
 * Recorded message structure from JSONL file
 */
interface RecordedMessage {
  ts: number // Timestamp in ms from start of recording
  src: 'ws' | 'tcp' | 'udp27333' | 'udp10600'
  type: string
  data: unknown
}

/**
 * Playback state
 */
type PlaybackState = 'idle' | 'playing' | 'paused' | 'finished'

/**
 * ReplayProvider options
 */
export interface ReplayProviderOptions {
  /** Speed multiplier (1.0 = realtime, 2.0 = 2x faster, 0.5 = half speed) */
  speed?: number
  /** Only process messages from these sources (default: ['ws']) */
  sources?: string[]
  /** Auto-start playback on connect (default: true) */
  autoPlay?: boolean
  /** Loop playback when finished (default: false) */
  loop?: boolean
  /** Pause playback after N messages (for testing, default: null = don't pause) */
  pauseAfter?: number | null
}

/**
 * ReplayProvider - Replays recorded WebSocket sessions for development
 *
 * This provider reads JSONL recordings and replays messages with their
 * original timing (adjusted by speed multiplier). It's the primary
 * data source during development, allowing testing without a live server.
 */
export class ReplayProvider implements DataProvider {
  private messages: RecordedMessage[] = []
  private currentIndex = 0
  private playbackState: PlaybackState = 'idle'
  private _status: ConnectionStatus = 'disconnected'
  private speed: number
  private sources: string[]
  private autoPlay: boolean
  private loop: boolean
  private pauseAfter: number | null
  private dispatchedCount = 0
  private playbackStartTime = 0
  private playbackStartTimestamp = 0
  private timeoutId: ReturnType<typeof setTimeout> | null = null

  // Callback manager (safeMode=true for ReplayProvider - errors are logged but don't break playback)
  private callbacks = new CallbackManager(true)

  // Data source
  private source: string

  constructor(source: string, options: ReplayProviderOptions = {}) {
    this.source = source
    this.speed = options.speed ?? 1.0
    this.sources = options.sources ?? ['ws']
    this.autoPlay = options.autoPlay ?? true
    this.loop = options.loop ?? false
    this.pauseAfter = options.pauseAfter ?? null
  }

  // --- DataProvider interface ---

  get status(): ConnectionStatus {
    return this._status
  }

  get connected(): boolean {
    return this._status === 'connected'
  }

  async connect(): Promise<void> {
    if (this._status !== 'disconnected') {
      return
    }

    this.setStatus('connecting')

    try {
      await this.loadMessages()
      this.setStatus('connected')

      if (this.autoPlay && this.messages.length > 0) {
        this.play()
      }
    } catch (err) {
      this.setStatus('disconnected')
      throw err
    }
  }

  disconnect(): void {
    this.stop()
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

  // --- Playback controls ---

  /**
   * Start or resume playback
   */
  play(): void {
    if (this.playbackState === 'playing') return
    if (this.playbackState === 'finished') {
      this.seek(0)
    }

    this.playbackState = 'playing'
    this.playbackStartTime = Date.now()

    if (this.currentIndex < this.messages.length) {
      this.playbackStartTimestamp = this.messages[this.currentIndex].ts
    }

    this.scheduleNext()
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.playbackState !== 'playing') return

    this.playbackState = 'paused'
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }

  /**
   * Resume playback after pause
   */
  resume(): void {
    if (this.playbackState !== 'paused') return
    this.play()
  }

  /**
   * Stop playback and reset to beginning
   */
  stop(): void {
    this.pause()
    this.playbackState = 'idle'
    this.currentIndex = 0
  }

  /**
   * Seek to position in milliseconds (in recording time)
   */
  seek(positionMs: number): void {
    const wasPlaying = this.playbackState === 'playing'

    if (wasPlaying) {
      this.pause()
    }

    // Find the message index at or after this position
    this.currentIndex = this.messages.findIndex((m) => m.ts >= positionMs)

    if (this.currentIndex === -1) {
      // Past the end
      this.currentIndex = this.messages.length
      this.playbackState = 'finished'
    } else {
      this.playbackState = 'idle'
    }

    if (wasPlaying && this.playbackState !== 'finished') {
      this.play()
    }
  }

  /**
   * Set playback speed multiplier
   */
  setSpeed(multiplier: number): void {
    if (multiplier <= 0) {
      throw new Error('Speed multiplier must be positive')
    }

    const wasPlaying = this.playbackState === 'playing'
    if (wasPlaying) {
      this.pause()
    }

    this.speed = multiplier

    if (wasPlaying) {
      this.play()
    }
  }

  /**
   * Get current playback position in ms
   */
  get position(): number {
    if (this.currentIndex >= this.messages.length) {
      return this.messages.length > 0 ? this.messages[this.messages.length - 1].ts : 0
    }
    if (this.currentIndex === 0) {
      return 0
    }
    return this.messages[this.currentIndex].ts
  }

  /**
   * Get total duration in ms
   */
  get duration(): number {
    if (this.messages.length === 0) return 0
    return this.messages[this.messages.length - 1].ts
  }

  /**
   * Get current playback state
   */
  get state(): PlaybackState {
    return this.playbackState
  }

  /**
   * Get number of loaded messages
   */
  get messageCount(): number {
    return this.messages.length
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

  private async loadMessages(): Promise<void> {
    let content: string

    // Check if source is a URL (absolute or relative path)
    const isUrl = this.source.startsWith('http://') ||
                  this.source.startsWith('https://') ||
                  this.source.startsWith('/')

    if (isUrl) {
      // Fetch from URL
      const response = await fetch(this.source)
      if (!response.ok) {
        throw new Error(`Failed to fetch recording: ${response.status}`)
      }
      content = await response.text()
    } else {
      // Treat as JSONL content directly
      content = this.source
    }

    this.parseJSONL(content)
  }

  private parseJSONL(content: string): void {
    const lines = content.split('\n').filter((line) => line.trim() !== '')
    this.messages = []

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line)

        // Skip metadata line
        if ('_meta' in parsed) {
          continue
        }

        const msg = parsed as RecordedMessage

        // Filter by source
        if (this.sources.length > 0 && !this.sources.includes(msg.src)) {
          continue
        }

        this.messages.push(msg)
      } catch (err) {
        // Skip invalid JSON lines but emit error
        const truncatedLine = line.substring(0, 100)
        console.warn('Skipping invalid JSONL line:', truncatedLine)
        this.emitError('PARSE_ERROR', 'Invalid JSONL line in recording', {
          line: truncatedLine,
          error: err,
        })
      }
    }

    // Sort by timestamp (should already be sorted, but ensure)
    this.messages.sort((a, b) => a.ts - b.ts)
  }

  private scheduleNext(): void {
    if (this.playbackState !== 'playing') return
    if (this.currentIndex >= this.messages.length) {
      this.handlePlaybackEnd()
      return
    }

    const msg = this.messages[this.currentIndex]
    const elapsed = Date.now() - this.playbackStartTime
    const targetTime = (msg.ts - this.playbackStartTimestamp) / this.speed
    const delay = Math.max(0, targetTime - elapsed)

    this.timeoutId = setTimeout(() => {
      this.dispatchMessage(msg)
      this.currentIndex++
      this.dispatchedCount++

      // Check if we should pause after N messages
      if (this.pauseAfter !== null && this.dispatchedCount >= this.pauseAfter) {
        this.pause()
        return
      }

      this.scheduleNext()
    }, delay)
  }

  private handlePlaybackEnd(): void {
    this.playbackState = 'finished'

    if (this.loop) {
      this.currentIndex = 0
      this.playbackState = 'idle'
      this.play()
    }
  }

  private dispatchMessage(msg: RecordedMessage): void {
    const { type, data } = msg

    // Handle WS messages (already parsed JSON)
    if (msg.src === 'ws') {
      this.dispatchWSMessage(type, data)
    }

    // Handle TCP messages (XML strings)
    if (msg.src === 'tcp') {
      this.dispatchTCPMessage(type, data)
    }
  }

  private dispatchTCPMessage(type: string, data: unknown): void {
    switch (type) {
      case 'TimeOfDay':
        this.handleTimeOfDayMessage(data)
        break
    }
  }

  private handleTimeOfDayMessage(data: unknown): void {
    // TCP message format: XML string like "<Canoe123 System=\"Main\"><TimeOfDay>10:34:08</TimeOfDay></Canoe123>"
    if (typeof data !== 'string') return

    // Parse time from XML - simple regex extraction
    const match = data.match(/<TimeOfDay>([^<]+)<\/TimeOfDay>/)
    if (!match) return

    const time = match[1] // e.g., "10:34:08"

    const info: EventInfoData = {
      title: '',
      infoText: '',
      dayTime: time,
    }

    this.callbacks.emitEventInfo(info)
  }

  private dispatchWSMessage(type: string, data: unknown): void {
    switch (type) {
      case 'top':
        this.handleTopMessage(data)
        break
      case 'comp':
        this.handleCompMessage(data)
        break
      case 'oncourse':
        this.handleOnCourseMessage(data)
        break
      case 'control':
        this.handleControlMessage(data)
        break
      case 'title':
        this.handleTitleMessage(data)
        break
      case 'infotext':
        this.handleInfoTextMessage(data)
        break
      case 'daytime':
        this.handleDayTimeMessage(data)
        break
    }
  }

  private handleTopMessage(data: unknown): void {
    // CLI message format: { msg: 'top', data: { ... } }
    const wrapper = data as { msg: string; data: Record<string, unknown> } | null
    if (!wrapper || !wrapper.data) {
      return
    }

    // Transform to ResultsData - skip validation for replay (data is pre-validated)
    const results = transformTopMessage(wrapper.data, { skipValidation: true })
    this.callbacks.emitResults(results)
  }

  private handleCompMessage(data: unknown): void {
    // CLI message format: { msg: 'comp', data: { ... } }
    const wrapper = data as { msg: string; data: Record<string, unknown> } | null
    if (!wrapper || !wrapper.data) {
      // Skip messages with null/missing data
      return
    }

    const onCourseData = transformCompMessage(wrapper.data)
    this.callbacks.emitOnCourse(onCourseData)
  }

  private handleOnCourseMessage(data: unknown): void {
    // CLI message format: { msg: 'oncourse', data: [...] }
    const wrapper = data as { msg: string; data: unknown[] }
    const competitors = wrapper.data || []

    const onCourseData = transformOnCourseMessage(competitors)
    this.callbacks.emitOnCourse(onCourseData)
  }

  private handleControlMessage(data: unknown): void {
    // CLI message format: { msg: 'control', data: { ... } }
    const wrapper = data as { msg: string; data: Record<string, unknown> } | null
    if (!wrapper || !wrapper.data) {
      return
    }

    const visibility = transformControlMessage(wrapper.data)
    this.callbacks.emitVisibility(visibility)
  }

  private handleTitleMessage(data: unknown): void {
    // CLI message format: { msg: 'title', data: { text: '...' } }
    const wrapper = data as { msg: string; data: { text?: string } } | null

    const info = transformTitleMessage(wrapper?.data || {})
    this.callbacks.emitEventInfo(info)
  }

  private handleInfoTextMessage(data: unknown): void {
    // CLI message format: { msg: 'infotext', data: { text: '...' } }
    const wrapper = data as { msg: string; data: { text?: string } } | null

    const info = transformInfoTextMessage(wrapper?.data || {})
    this.callbacks.emitEventInfo(info)
  }

  private handleDayTimeMessage(data: unknown): void {
    // CLI message format: { msg: 'daytime', data: { time: '...' } }
    const wrapper = data as { msg: string; data: { time?: string } } | null

    const info = transformDayTimeMessage(wrapper?.data || {})
    this.callbacks.emitEventInfo(info)
  }
}
