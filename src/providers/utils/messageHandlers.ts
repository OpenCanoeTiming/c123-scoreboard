import type { VisibilityState } from '@/types'
import type { ResultsData, OnCourseData, EventInfoData } from '../types'
import { parseResults, parseCompetitor } from './parseMessages'
import { safeString, isObject } from './validation'

/**
 * Payload types for message handlers
 * These represent the normalized data structure after unwrapping
 * any protocol-specific wrappers.
 */
export type TopPayload = Record<string, unknown>
export type CompPayload = Record<string, unknown>
export type OnCoursePayload = unknown[]
export type ControlPayload = Record<string, unknown>
export type TextPayload = { text?: string; time?: string }

/**
 * Options for message transformation
 */
export interface TransformOptions {
  /** Skip validation for pre-validated data (e.g., replay data) */
  skipValidation?: boolean
}

/**
 * Transform a top message payload to ResultsData
 *
 * Note: CLI doesn't provide RaceId in top messages. The raceId field
 * will be undefined, which means Results filtering by race won't apply
 * to CLI provider (backwards compatible behavior).
 */
export function transformTopMessage(
  payload: TopPayload,
  options: TransformOptions = {}
): ResultsData {
  return {
    results: parseResults(payload, options.skipValidation),
    raceName: safeString(payload.RaceName),
    raceStatus: safeString(payload.RaceStatus),
    highlightBib: payload.HighlightBib ? safeString(payload.HighlightBib) : null,
    // CLI doesn't provide RaceId - filtering by race won't apply
    raceId: payload.RaceId ? safeString(payload.RaceId) : undefined,
  }
}

/**
 * Transform a comp message payload to OnCourseData
 * Note: comp messages only update currentCompetitor, not the full onCourse list.
 * The onCourse list comes from oncourse messages which contain all competitors.
 */
export function transformCompMessage(payload: CompPayload): OnCourseData {
  const current = parseCompetitor(payload)
  return {
    current,
    onCourse: [],
    updateOnCourse: false, // Don't overwrite onCourse list from comp message
  }
}

/**
 * Find the competitor who has been on course the longest (lowest dtStart).
 * This ensures consistent selection when multiple competitors are on course.
 */
function findOldestOnCourse(
  competitors: import('@/types').OnCourseCompetitor[]
): import('@/types').OnCourseCompetitor | null {
  if (competitors.length === 0) return null
  if (competitors.length === 1) return competitors[0]

  // Sort by dtStart ascending (oldest first)
  // Null dtStart goes last
  const sorted = [...competitors].sort((a, b) => {
    if (!a.dtStart && !b.dtStart) return 0
    if (!a.dtStart) return 1
    if (!b.dtStart) return -1
    return a.dtStart.localeCompare(b.dtStart)
  })

  return sorted[0]
}

/**
 * Transform an oncourse message payload to OnCourseData
 *
 * When multiple competitors are on course, the one who started earliest
 * (lowest dtStart) is selected as "current" to ensure stable selection
 * and prevent flickering between competitors.
 */
export function transformOnCourseMessage(competitors: OnCoursePayload): OnCourseData {
  const parsed = competitors
    .filter((c) => isObject(c))
    .map((c) => parseCompetitor(c as Record<string, unknown>))
    .filter((c) => c !== null)

  return {
    current: findOldestOnCourse(parsed),
    onCourse: parsed,
    updateOnCourse: true, // Full list from oncourse message
  }
}

/**
 * Transform a control message payload to VisibilityState
 */
export function transformControlMessage(payload: ControlPayload): VisibilityState {
  return {
    displayCurrent: safeString(payload.displayCurrent) === '1',
    displayTop: safeString(payload.displayTop) === '1',
    displayTitle: safeString(payload.displayTitle) === '1',
    displayTopBar: safeString(payload.displayTopBar) === '1',
    displayFooter: safeString(payload.displayFooter) === '1',
    displayDayTime: safeString(payload.displayDayTime) === '1',
    displayOnCourse: safeString(payload.displayOnCourse) === '1',
  }
}

/**
 * Transform a title message payload to EventInfoData
 */
export function transformTitleMessage(payload: TextPayload): EventInfoData {
  return {
    title: safeString(payload.text),
    infoText: '',
    dayTime: '',
  }
}

/**
 * Transform an infotext message payload to EventInfoData
 */
export function transformInfoTextMessage(payload: TextPayload): EventInfoData {
  return {
    title: '',
    infoText: safeString(payload.text),
    dayTime: '',
  }
}

/**
 * Transform a daytime message payload to EventInfoData
 */
export function transformDayTimeMessage(payload: TextPayload): EventInfoData {
  return {
    title: '',
    infoText: '',
    dayTime: safeString(payload.time),
  }
}
