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
 * Transform an oncourse message payload to OnCourseData
 */
export function transformOnCourseMessage(competitors: OnCoursePayload): OnCourseData {
  const parsed = competitors
    .filter((c) => isObject(c))
    .map((c) => parseCompetitor(c as Record<string, unknown>))
    .filter((c) => c !== null)

  return {
    current: parsed[0] || null,
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
