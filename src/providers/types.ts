import type { ConnectionStatus, OnCourseCompetitor, Result, RaceConfig, VisibilityState } from '@/types'

/**
 * Unsubscribe function returned by callbacks
 */
export type Unsubscribe = () => void

/**
 * Results data from top message
 */
export interface ResultsData {
  results: Result[]
  raceName: string
  raceStatus: string
  highlightBib: string | null
  /** Race ID for tracking active category (e.g., "K1M_ST_BR2_6") */
  raceId?: string
}

/**
 * On-course data
 */
export interface OnCourseData {
  current: OnCourseCompetitor | null
  onCourse: OnCourseCompetitor[]
  /**
   * Whether onCourse list should update.
   * - true: Update from oncourse message (full list)
   * - false: Comp message (current only, preserve existing onCourse)
   */
  updateOnCourse?: boolean
}

/**
 * Event info data
 *
 * All fields are optional to allow partial updates.
 * Each provider may only send a subset of fields depending on the message type:
 * - TimeOfDay messages: only dayTime
 * - Title messages: only title
 * - InfoText messages: only infoText
 */
export interface EventInfoData {
  title?: string
  infoText?: string
  dayTime?: string
}

/**
 * Provider error data
 */
export interface ProviderError {
  /** Error code for programmatic handling */
  code: 'PARSE_ERROR' | 'VALIDATION_ERROR' | 'CONNECTION_ERROR' | 'UNKNOWN_ERROR'
  /** Human-readable error message */
  message: string
  /** Original error or data that caused the error */
  cause?: unknown
  /** Timestamp when the error occurred */
  timestamp: number
}

/**
 * DataProvider interface - abstraction over different data sources
 *
 * Implementations:
 * - CLIProvider: WebSocket connection to CLI tool (port 8081)
 * - C123Provider: Direct TCP connection to timing system (future)
 * - ReplayProvider: Replay recorded sessions for development
 */
export interface DataProvider {
  /**
   * Connect to the data source
   * @returns Promise that resolves when connected
   */
  connect(): Promise<void>

  /**
   * Disconnect from the data source
   */
  disconnect(): void

  /**
   * Current connection status
   */
  readonly status: ConnectionStatus

  /**
   * Whether currently connected
   */
  readonly connected: boolean

  /**
   * Subscribe to results updates (top messages)
   */
  onResults(callback: (data: ResultsData) => void): Unsubscribe

  /**
   * Subscribe to on-course updates (comp/oncourse messages)
   */
  onOnCourse(callback: (data: OnCourseData) => void): Unsubscribe

  /**
   * Subscribe to config updates
   */
  onConfig(callback: (config: RaceConfig) => void): Unsubscribe

  /**
   * Subscribe to visibility updates (control messages)
   */
  onVisibility(callback: (visibility: VisibilityState) => void): Unsubscribe

  /**
   * Subscribe to event info updates (title, infoText, dayTime)
   */
  onEventInfo(callback: (info: EventInfoData) => void): Unsubscribe

  /**
   * Subscribe to connection status changes
   */
  onConnectionChange(callback: (status: ConnectionStatus) => void): Unsubscribe

  /**
   * Subscribe to provider errors (parse errors, validation errors, etc.)
   * These errors don't necessarily break the connection but should be logged/displayed
   */
  onError(callback: (error: ProviderError) => void): Unsubscribe
}
