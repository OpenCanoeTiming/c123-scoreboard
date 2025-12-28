import type { ConnectionStatus, OnCourseCompetitor, RaceConfig, VisibilityState } from '@/types'
import type {
  DataProvider,
  Unsubscribe,
  ResultsData,
  OnCourseData,
  EventInfoData,
} from './types'

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
  private playbackStartTime = 0
  private playbackStartTimestamp = 0
  private timeoutId: ReturnType<typeof setTimeout> | null = null

  // Callbacks
  private resultsCallbacks = new Set<(data: ResultsData) => void>()
  private onCourseCallbacks = new Set<(data: OnCourseData) => void>()
  private configCallbacks = new Set<(config: RaceConfig) => void>()
  private visibilityCallbacks = new Set<(visibility: VisibilityState) => void>()
  private eventInfoCallbacks = new Set<(info: EventInfoData) => void>()
  private connectionCallbacks = new Set<(status: ConnectionStatus) => void>()

  // Data source
  private source: string

  constructor(source: string, options: ReplayProviderOptions = {}) {
    this.source = source
    this.speed = options.speed ?? 1.0
    this.sources = options.sources ?? ['ws']
    this.autoPlay = options.autoPlay ?? true
    this.loop = options.loop ?? false
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
    this.connectionCallbacks.forEach((cb) => cb(status))
  }

  private async loadMessages(): Promise<void> {
    let content: string

    if (this.source.startsWith('http://') || this.source.startsWith('https://')) {
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
      } catch {
        // Skip invalid JSON lines
        console.warn('Skipping invalid JSONL line:', line.substring(0, 50))
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
    const wrapper = data as { msg: string; data: Record<string, unknown> }
    const payload = wrapper.data

    // Transform to ResultsData
    const results: ResultsData = {
      results: this.parseResults(payload),
      raceName: (payload.RaceName as string) || '',
      raceStatus: (payload.RaceStatus as string) || '',
      highlightBib: payload.HighlightBib ? String(payload.HighlightBib) : null,
    }

    this.resultsCallbacks.forEach((cb) => cb(results))
  }

  private parseResults(_payload: Record<string, unknown>): ResultsData['results'] {
    // TODO: Parse top message rows into Result[]
    // For now return empty - will implement when we have actual top message data
    return []
  }

  private handleCompMessage(data: unknown): void {
    // CLI message format: { msg: 'comp', data: { ... } }
    const wrapper = data as { msg: string; data: Record<string, unknown> }
    const payload = wrapper.data

    const current = this.parseCompetitor(payload)

    const onCourseData: OnCourseData = {
      current,
      onCourse: current ? [current] : [],
    }

    this.onCourseCallbacks.forEach((cb) => cb(onCourseData))
  }

  private handleOnCourseMessage(data: unknown): void {
    // CLI message format: { msg: 'oncourse', data: [...] }
    const wrapper = data as { msg: string; data: Record<string, unknown>[] }
    const competitors = wrapper.data || []

    const parsed = competitors.map((c) => this.parseCompetitor(c)).filter((c): c is OnCourseCompetitor => c !== null)

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

  private handleControlMessage(data: unknown): void {
    // CLI message format: { msg: 'control', data: { ... } }
    const wrapper = data as { msg: string; data: Record<string, string> }
    const payload = wrapper.data

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

  private handleTitleMessage(data: unknown): void {
    // CLI message format: { msg: 'title', data: { text: '...' } }
    const wrapper = data as { msg: string; data: { text: string } }

    const info: EventInfoData = {
      title: wrapper.data?.text || '',
      infoText: '',
      dayTime: '',
    }

    this.eventInfoCallbacks.forEach((cb) => cb(info))
  }

  private handleInfoTextMessage(data: unknown): void {
    // CLI message format: { msg: 'infotext', data: { text: '...' } }
    const wrapper = data as { msg: string; data: { text: string } }

    const info: EventInfoData = {
      title: '',
      infoText: wrapper.data?.text || '',
      dayTime: '',
    }

    this.eventInfoCallbacks.forEach((cb) => cb(info))
  }

  private handleDayTimeMessage(data: unknown): void {
    // CLI message format: { msg: 'daytime', data: { time: '...' } }
    const wrapper = data as { msg: string; data: { time: string } }

    const info: EventInfoData = {
      title: '',
      infoText: '',
      dayTime: wrapper.data?.time || '',
    }

    this.eventInfoCallbacks.forEach((cb) => cb(info))
  }
}
