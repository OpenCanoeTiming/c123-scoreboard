// Re-export all types
export type { OnCourseCompetitor } from './competitor'
export type { Result } from './result'
export type { RaceConfig } from './config'
export type { VisibilityState } from './visibility'
export { defaultVisibility } from './visibility'
export type { ConnectionStatus } from './connection'
export {
  MessageType,
  type MessageTypeValue,
  type TopMessage,
  type TopRow,
  type CompMessage,
  type OnCourseMessage,
  type ControlMessage,
  type TitleMessage,
  type InfoTextMessage,
  type DayTimeMessage,
} from './messages'

// C123 Server types
export type {
  C123ServerMessage,
  C123MessageType,
  C123ConnectedData,
  C123ConnectedMessage,
  C123TimeOfDayData,
  C123TimeOfDayMessage,
  C123OnCourseCompetitor,
  C123OnCourseData,
  C123OnCourseMessage,
  C123ResultRow,
  C123ResultsData,
  C123ResultsMessage,
  C123RaceConfigData,
  C123RaceConfigMessage,
  C123ScheduleRace,
  C123ScheduleData,
  C123ScheduleMessage,
  C123XmlChangeData,
  C123XmlChangeMessage,
  C123ErrorData,
  C123ErrorMessage,
  C123Message,
} from './c123server'
export {
  isConnectedMessage,
  isTimeOfDayMessage,
  isOnCourseMessage,
  isResultsMessage,
  isRaceConfigMessage,
  isScheduleMessage,
  isXmlChangeMessage,
  isErrorMessage,
} from './c123server'
