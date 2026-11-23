/**
 * Legacy adapter: today's reducer output -> BoardView.
 *
 * Temporary. It is the only place where the legacy state reaches the
 * components, so the components already render what the new producer will
 * fill. Deleted with the legacy reducer (#168).
 */
import { useMemo } from 'react'
import { useScoreboard, type ScoreboardState } from '@/context'
import { useHighlight } from '@/hooks/useHighlight'
import type {
  ConnectionStatus,
  OnCourseCompetitor,
  Result,
  ResultStatus,
  RunResult,
  VisibilityState,
} from '@/types'
import { getPenaltyGates } from '@/providers/utils/parseGates'
import { getRunNumber, isBR2Race } from '@/utils/raceUtils'
import { formatName } from '@/utils/formatName'
import type {
  BoardView,
  BoardVisibility,
  ConnectionView,
  FeaturedRowView,
  OnCourseRowView,
  PenaltyKind,
  ResultRowView,
  TimeCellView,
  TitleView,
} from './boardView'

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

export function toConnectionView(status: ConnectionStatus, initialDataReceived: boolean): ConnectionView {
  if (status === 'connected' && initialDataReceived) return 'live'
  if (status === 'connected' || status === 'connecting') return 'connecting'
  if (status === 'reconnecting') return 'reconnecting'
  if (status === 'error') return 'error'
  return 'disconnected'
}

// ---------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------

/** "K1m - střední trať" -> "K1M" */
function extractCategory(raceName: string): string {
  if (!raceName) return ''
  const parts = raceName.split(' - ')
  if (parts.length === 0) return ''
  const category = parts[0].trim()
  if (!category) return ''
  return category.toUpperCase()
}

export function toTitleView(title: string, raceName = '', raceId = ''): TitleView {
  const runNumber = raceId ? getRunNumber(raceId) : null
  return {
    event: title,
    category: extractCategory(raceName),
    run: runNumber ? String(runNumber) : null,
  }
}

// ---------------------------------------------------------------------------
// Result rows
// ---------------------------------------------------------------------------

function penaltyKind(pen: number): PenaltyKind {
  if (pen === 0) return 'clear'
  if (pen <= 4) return 'touch'
  return 'miss'
}

function formatBehind(behind: string): string {
  if (!behind || behind === '0' || behind === '0.00') return ''
  if (behind.startsWith('+')) return behind
  return `+${behind}`
}

function hasExplicitStatus(status?: ResultStatus): status is 'DNS' | 'DNF' | 'DSQ' {
  return status === 'DNS' || status === 'DNF' || status === 'DSQ'
}

function isZeroTime(total?: string): boolean {
  return !total || total === '0' || total === '0.00'
}

function emptyCell(kind: 'missing' | 'none', text: string): TimeCellView {
  return { kind, text, penalty: '', penaltyKind: 'clear', penaltyLarge: false, underReview: false }
}

function statusCell(status: string): TimeCellView {
  return { kind: 'status', text: status, penalty: '', penaltyKind: 'clear', penaltyLarge: false, underReview: false }
}

function timeCell(total: string, pen: number, underReview: boolean): TimeCellView {
  return {
    kind: 'time',
    text: total,
    penalty: String(pen),
    penaltyKind: penaltyKind(pen),
    penaltyLarge: pen >= 100,
    underReview,
  }
}

function toRunCell(run?: RunResult): TimeCellView {
  if (!run) return emptyCell('none', '')
  if (hasExplicitStatus(run.status)) return statusCell(run.status)
  if (isZeroTime(run.total)) return emptyCell('missing', '-')
  return timeCell(run.total ?? '', run.pen ?? 0, !!run.underInvestigation)
}

export interface ResultRowOptions {
  /** The race shows both runs (best-run second run) */
  bestRun?: boolean
  highlighted?: boolean
}

export function toResultRowView(result: Result, options: ResultRowOptions = {}): ResultRowView {
  const explicitStatus = hasExplicitStatus(result.status)
  const missingTime = !explicitStatus && isZeroTime(result.total)
  const invalid = explicitStatus || missingTime
  const underReview = !!(
    result.underInvestigation ||
    result.run1?.underInvestigation ||
    result.run2?.underInvestigation
  )

  const resultCell = explicitStatus
    ? statusCell(result.status as string)
    : missingTime
      ? emptyCell('none', '')
      : timeCell(result.total, result.pen, underReview)

  const runs =
    options.bestRun && (result.run1 || result.run2)
      ? {
          first: toRunCell(result.run1),
          second: toRunCell(result.run2),
          better: result.bestRun === 1 || result.bestRun === 2 ? result.bestRun : null,
        }
      : null

  return {
    bib: result.bib,
    rank: invalid ? '' : `${result.rank}.`,
    name: formatName(result.name),
    result: resultCell,
    behind: invalid ? '' : formatBehind(result.behind),
    runs,
    highlighted: !!options.highlighted,
    provisional: false,
  }
}

// ---------------------------------------------------------------------------
// On course
// ---------------------------------------------------------------------------

function isActivelyRacing(competitor: OnCourseCompetitor): boolean {
  if (!competitor.dtStart) return false
  const time = competitor.total || competitor.time
  if (!time) return false
  if (time === '0:00.00' || time === '0.00' || time === '0') return false
  return true
}

export function toOnCourseRowView(competitor: OnCourseCompetitor): OnCourseRowView {
  return {
    bib: competitor.bib,
    name: formatName(competitor.name),
    gatePenalties: getPenaltyGates(competitor.gates).map(({ gateNumber, penalty }) => ({
      gate: gateNumber,
      kind: penalty === 2 ? 'touch' : 'miss',
    })),
    penalty: String(competitor.pen),
    hasPenalty: competitor.pen > 0,
    time: (competitor.total || competitor.time || '').trim(),
    racing: isActivelyRacing(competitor),
  }
}

/**
 * The featured row, or null when nobody is shown.
 * An athlete who has not started is not shown unless departing.
 */
export function toFeaturedRowView(
  competitor: OnCourseCompetitor | null,
  departing: boolean
): FeaturedRowView | null {
  if (!competitor) return null
  if (!departing && !competitor.dtStart) return null
  return { ...toOnCourseRowView(competitor), departing }
}

/**
 * Pick the featured athlete. A finisher (departing with a finish time) takes
 * precedence over the next athlete on course, so the final time stays visible;
 * a departing athlete without a finish only fills in when nobody is on course.
 */
function selectFeatured(
  current: OnCourseCompetitor | null,
  departing: OnCourseCompetitor | null
): FeaturedRowView | null {
  const finishingDeparture = departing?.dtFinish ? departing : null
  const competitor = finishingDeparture ?? current ?? departing
  const isDeparting = !!finishingDeparture || (!current && !!departing)
  return toFeaturedRowView(competitor, isDeparting)
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

function toVisibility(visibility: VisibilityState): BoardVisibility {
  return {
    topBar: visibility.displayTopBar,
    title: visibility.displayTitle,
    dayTime: visibility.displayDayTime,
    featured: visibility.displayCurrent,
    results: visibility.displayTop,
    footer: visibility.displayFooter,
  }
}

type LegacyState = Pick<
  ScoreboardState,
  | 'status'
  | 'initialDataReceived'
  | 'title'
  | 'raceName'
  | 'raceId'
  | 'dayTime'
  | 'currentCompetitor'
  | 'departingCompetitor'
  | 'results'
  | 'visibility'
>

/**
 * Map the legacy state to a BoardView.
 * @param highlightBib bib of the active highlight, or null
 */
export function toBoardView(state: LegacyState, highlightBib: string | null): BoardView {
  const bestRun = isBR2Race(state.raceId)
  return {
    connection: toConnectionView(state.status, state.initialDataReceived),
    title: toTitleView(state.title, state.raceName, state.raceId),
    dayTime: state.dayTime,
    visibility: toVisibility(state.visibility),
    featured: selectFeatured(state.currentCompetitor, state.departingCompetitor),
    rows: state.results.map((result) =>
      toResultRowView(result, {
        bestRun,
        highlighted: highlightBib !== null && result.bib === highlightBib,
      })
    ),
  }
}

/** BoardView from the legacy scoreboard context. */
export function useLegacyBoardView(): BoardView {
  const state = useScoreboard()
  const { highlightBib, isActive } = useHighlight()
  const activeBib = isActive ? highlightBib : null
  return useMemo(() => toBoardView(state, activeBib), [state, activeBib])
}
