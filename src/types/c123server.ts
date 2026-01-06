/**
 * C123 Server Message Types
 *
 * Types for messages received from C123 Server WebSocket endpoint (ws://server:27123/ws).
 * These are JSON envelope messages wrapping C123 timing data.
 */

// =============================================================================
// Message Envelope
// =============================================================================

/**
 * Base envelope for all C123 Server messages
 */
export interface C123ServerMessage<T = unknown> {
  type: string
  timestamp: string
  data: T
}

// =============================================================================
// Message Types
// =============================================================================

export type C123MessageType =
  | 'Connected'
  | 'TimeOfDay'
  | 'OnCourse'
  | 'Results'
  | 'RaceConfig'
  | 'Schedule'
  | 'XmlChange'
  | 'Error'
  | 'ForceRefresh'
  | 'ConfigPush'

// =============================================================================
// Connected Message (sent on WebSocket connect)
// =============================================================================

export interface C123ConnectedData {
  version: string
  c123Connected: boolean
  xmlLoaded: boolean
}

export interface C123ConnectedMessage extends C123ServerMessage<C123ConnectedData> {
  type: 'Connected'
}

// =============================================================================
// TimeOfDay Message
// =============================================================================

export interface C123TimeOfDayData {
  time: string // "19:04:20"
}

export interface C123TimeOfDayMessage extends C123ServerMessage<C123TimeOfDayData> {
  type: 'TimeOfDay'
}

// =============================================================================
// OnCourse Message
// =============================================================================

export interface C123OnCourseCompetitor {
  bib: string
  name: string
  club: string
  nat: string
  raceId: string
  raceName: string
  startOrder: number
  warning: string
  gates: string // "0,0,0,2,0,0,2,0,50,,,,,,,,,,,,,,,"
  completed: boolean
  dtStart: string // "16:14:00.000"
  dtFinish: string | null // null while on course, timestamp when finished
  pen: number // penalty in seconds
  time: string // running time in seconds: "81.15"
  total: string // time + penalty: "81.69"
  ttbDiff: string // difference to leader: "+12.79"
  ttbName: string // leader's name
  rank: number
  position: number // 1 = closest to finish
}

export interface C123OnCourseData {
  total: number
  competitors: C123OnCourseCompetitor[]
}

export interface C123OnCourseMessage extends C123ServerMessage<C123OnCourseData> {
  type: 'OnCourse'
}

// =============================================================================
// Results Message
// =============================================================================

export interface C123ResultRow {
  rank: number
  bib: string
  name: string
  givenName: string
  familyName: string
  club: string
  nat: string
  startOrder: number
  startTime: string
  gates: string // "0 0 0 0 0 0 0 0 0 0 0 0 2 0 2 0 2 0 0 0 0 0 0 0"
  pen: number // penalty in seconds
  time: string // time in seconds: "79.99"
  total: string // time + penalty: "78.99"
  behind: string // difference to first: "" for winner, "+1.50" for others
  status?: string // IRM field: "DNS", "DNF", "DSQ", or empty for valid results
  // BR2 fields - data from first run
  prevTime?: number // 1st run time in centiseconds
  prevPen?: number // 1st run penalty
  prevTotal?: number // 1st run total in centiseconds
  prevRank?: number // 1st run rank
  totalTotal?: number // Best of both runs in centiseconds
  totalRank?: number // Overall rank
  betterRun?: number // Which run was better: 1 or 2
}

export interface C123ResultsData {
  raceId: string // "K1M_ST_BR2_6"
  classId: string // "K1M_ST"
  isCurrent: boolean // true if this is the currently active race
  mainTitle: string // "K1m - střední trať"
  subTitle: string // "1st and 2nd Run"
  rows: C123ResultRow[]
}

export interface C123ResultsMessage extends C123ServerMessage<C123ResultsData> {
  type: 'Results'
}

// =============================================================================
// RaceConfig Message
// =============================================================================

export interface C123RaceConfigData {
  nrSplits: number
  nrGates: number
  gateConfig: string // "NNRNNRNRNNNRNNRNRNNRNNRN" (N=normal, R=reverse)
  gateCaptions: string // "1,2,3,4,5,..."
}

export interface C123RaceConfigMessage extends C123ServerMessage<C123RaceConfigData> {
  type: 'RaceConfig'
}

// =============================================================================
// Schedule Message
// =============================================================================

export interface C123ScheduleRace {
  order: number
  raceId: string
  race: string
  mainTitle: string
  subTitle: string
  shortTitle: string
  raceStatus: number // 3 = running, 5 = finished
  startTime: string
}

export interface C123ScheduleData {
  races: C123ScheduleRace[]
}

export interface C123ScheduleMessage extends C123ServerMessage<C123ScheduleData> {
  type: 'Schedule'
}

// =============================================================================
// XmlChange Message
// =============================================================================

export interface C123XmlChangeData {
  sections: string[] // ["Results", "StartList"]
  checksum: string
}

export interface C123XmlChangeMessage extends C123ServerMessage<C123XmlChangeData> {
  type: 'XmlChange'
}

// =============================================================================
// Error Message
// =============================================================================

export interface C123ErrorData {
  code: string
  message: string
}

export interface C123ErrorMessage extends C123ServerMessage<C123ErrorData> {
  type: 'Error'
}

// =============================================================================
// ForceRefresh Message
// =============================================================================

export interface C123ForceRefreshData {
  reason?: string
}

export interface C123ForceRefreshMessage extends C123ServerMessage<C123ForceRefreshData> {
  type: 'ForceRefresh'
}

// =============================================================================
// ConfigPush Message
// =============================================================================

export interface C123ConfigPushData {
  /** Client ID - if changed, client will reconnect with new ID */
  clientId?: string
  type?: 'vertical' | 'ledwall'
  displayRows?: number
  customTitle?: string
  raceFilter?: string[]
  showOnCourse?: boolean
  showResults?: boolean
  /** Whether to scroll to finished competitor (default: true). When false, only highlights without scrolling. */
  scrollToFinished?: boolean
  custom?: Record<string, string | number | boolean>
  label?: string
}

export interface C123ConfigPushMessage extends C123ServerMessage<C123ConfigPushData> {
  type: 'ConfigPush'
}

// =============================================================================
// Union Type for All Messages
// =============================================================================

export type C123Message =
  | C123ConnectedMessage
  | C123TimeOfDayMessage
  | C123OnCourseMessage
  | C123ResultsMessage
  | C123RaceConfigMessage
  | C123ScheduleMessage
  | C123XmlChangeMessage
  | C123ErrorMessage
  | C123ForceRefreshMessage
  | C123ConfigPushMessage

// =============================================================================
// Type Guards
// =============================================================================

export function isConnectedMessage(msg: C123ServerMessage): msg is C123ConnectedMessage {
  return msg.type === 'Connected'
}

export function isTimeOfDayMessage(msg: C123ServerMessage): msg is C123TimeOfDayMessage {
  return msg.type === 'TimeOfDay'
}

export function isOnCourseMessage(msg: C123ServerMessage): msg is C123OnCourseMessage {
  return msg.type === 'OnCourse'
}

export function isResultsMessage(msg: C123ServerMessage): msg is C123ResultsMessage {
  return msg.type === 'Results'
}

export function isRaceConfigMessage(msg: C123ServerMessage): msg is C123RaceConfigMessage {
  return msg.type === 'RaceConfig'
}

export function isScheduleMessage(msg: C123ServerMessage): msg is C123ScheduleMessage {
  return msg.type === 'Schedule'
}

export function isXmlChangeMessage(msg: C123ServerMessage): msg is C123XmlChangeMessage {
  return msg.type === 'XmlChange'
}

export function isErrorMessage(msg: C123ServerMessage): msg is C123ErrorMessage {
  return msg.type === 'Error'
}

export function isForceRefreshMessage(msg: C123ServerMessage): msg is C123ForceRefreshMessage {
  return msg.type === 'ForceRefresh'
}

export function isConfigPushMessage(msg: C123ServerMessage): msg is C123ConfigPushMessage {
  return msg.type === 'ConfigPush'
}
