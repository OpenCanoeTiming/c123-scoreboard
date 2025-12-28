/**
 * CLI message types
 */
export const MessageType = {
  TOP: 'top',
  COMP: 'comp',
  ONCOURSE: 'oncourse',
  CONTROL: 'control',
  TITLE: 'title',
  INFOTEXT: 'infotext',
  DAYTIME: 'daytime',
} as const

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType]

/**
 * CLI 'top' message payload - results list
 */
export interface TopMessage {
  Rows: TopRow[]
  HighlightBib: number
  RaceName: string
  RaceStatus: string
}

export interface TopRow {
  Rank: number
  Bib: string
  FamilyName: string
  GivenName: string
  Club: string
  Nat: string
  Total: string
  Pen: number
  Behind: string
}

/**
 * CLI 'comp' message payload - current competitor
 */
export interface CompMessage {
  Bib: string
  Name: string
  Club: string
  Nat: string
  RaceId: string
  Time: string
  TotalTime: string
  Pen: number
  Gates: string
  DTStart: string
  DTFinish: string
  TTBDiff: string
  TTBName: string
  Rank: number
}

/**
 * CLI 'oncourse' message payload - competitors on course
 */
export interface OnCourseMessage {
  Competitors: CompMessage[]
}

/**
 * CLI 'control' message payload - visibility controls
 */
export interface ControlMessage {
  displayCurrent: boolean
  displayTop: boolean
  displayTitle: boolean
  displayTopBar: boolean
  displayFooter: boolean
  displayDayTime: boolean
  displayOnCourse: boolean
}

/**
 * CLI 'title' message payload
 */
export interface TitleMessage {
  Title: string
}

/**
 * CLI 'infotext' message payload
 */
export interface InfoTextMessage {
  Text: string
}

/**
 * CLI 'daytime' message payload
 */
export interface DayTimeMessage {
  Time: string
}
