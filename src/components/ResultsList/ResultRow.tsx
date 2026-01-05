import { forwardRef } from 'react'
import styles from './ResultsList.module.css'
import type { Result, ResultStatus, RunResult } from '@/types'
import { formatName } from '@/utils/formatName'

/**
 * Props for ResultRow component
 */
interface ResultRowProps {
  /** Result data for this row */
  result: Result
  /** Whether this row is highlighted (recently finished competitor) */
  isHighlighted?: boolean
  /** Whether to show the penalty column */
  showPenalty?: boolean
  /** Whether to show the behind column (hidden on ledwall) */
  showBehind?: boolean
  /** Layout mode for CSS grid adjustment */
  layoutMode?: 'vertical' | 'ledwall'
  /** Whether this is a BR2 race (merged BR1/BR2 display) */
  isBR2?: boolean
}

/**
 * Get CSS class for penalty value
 */
function getPenaltyClass(penalty: number): string {
  if (penalty === 0) return styles.penaltyClear
  if (penalty <= 4) return styles.penaltyTouch // 2s or 4s (double touch)
  return styles.penaltyMiss // 50s+
}

/**
 * Format behind time with + prefix
 */
function formatBehind(behind: string): string {
  if (!behind || behind === '0' || behind === '0.00') return ''
  if (behind.startsWith('+')) return behind
  return `+${behind}`
}

/**
 * Check if result has explicit invalid status (DNS, DNF, DSQ)
 */
function hasExplicitStatus(status?: ResultStatus): status is 'DNS' | 'DNF' | 'DSQ' {
  return status === 'DNS' || status === 'DNF' || status === 'DSQ'
}

/**
 * Check if result has missing/empty time (no explicit status but no valid time)
 */
function hasMissingTime(result: Result): boolean {
  if (hasExplicitStatus(result.status)) return false
  const total = result.total
  return !total || total === '' || total === '0' || total === '0.00'
}

/**
 * Check if run has invalid status
 */
function hasRunStatus(run?: RunResult): boolean {
  return run?.status === 'DNS' || run?.status === 'DNF' || run?.status === 'DSQ'
}

/**
 * Check if run has missing/empty time
 */
function hasRunMissingTime(run?: RunResult): boolean {
  if (!run) return true
  if (hasRunStatus(run)) return false
  const total = run.total
  return !total || total === '' || total === '0' || total === '0.00'
}

/**
 * RunTimeCell - displays penalty and time for a single run
 */
function RunTimeCell({
  run,
  isBetter,
  showPenalty = true,
}: {
  run?: RunResult
  isBetter: boolean
  showPenalty?: boolean
}) {
  const opacityClass = isBetter ? '' : styles.worseRun

  // No run data - show dash
  if (!run) {
    return (
      <div className={`${styles.runCell} ${opacityClass}`}>
        {showPenalty && <span className={styles.runPenalty}>-</span>}
        <span className={styles.runTime}>-</span>
      </div>
    )
  }

  // Invalid status
  if (hasRunStatus(run)) {
    return (
      <div className={`${styles.runCell} ${opacityClass}`}>
        {showPenalty && <span className={styles.runPenalty}>-</span>}
        <span className={`${styles.runTime} ${styles.statusIndicator}`}>{run.status}</span>
      </div>
    )
  }

  // Missing time
  if (hasRunMissingTime(run)) {
    return (
      <div className={`${styles.runCell} ${opacityClass}`}>
        {showPenalty && <span className={styles.runPenalty}>-</span>}
        <span className={styles.runTime}>-</span>
      </div>
    )
  }

  // Valid run
  return (
    <div className={`${styles.runCell} ${opacityClass}`}>
      {showPenalty && (
        <span className={`${styles.runPenalty} ${getPenaltyClass(run.pen ?? 0)}`}>
          {run.pen ?? 0}
        </span>
      )}
      <span className={styles.runTime}>{run.total}</span>
    </div>
  )
}

/**
 * ResultRow component
 *
 * Displays a single result in the results list with:
 * - Rank (position)
 * - Bib (start number)
 * - Name (competitor name)
 * - Penalty (always shown on both layouts)
 * - Time (total time) - or status for invalid results (DNS, DNF, DSQ)
 * - Behind (hidden on ledwall)
 *
 * For BR2 races on vertical layout, displays two run columns (BR1 and BR2)
 * with the better run highlighted and worse run dimmed.
 *
 * @example
 * ```tsx
 * <ResultRow
 *   result={result}
 *   isHighlighted={highlightBib === result.bib}
 *   showPenalty={layoutMode !== 'ledwall'}
 * />
 * ```
 */
export const ResultRow = forwardRef<HTMLDivElement, ResultRowProps>(
  function ResultRow(
    { result, isHighlighted = false, showPenalty = true, showBehind = true, layoutMode = 'vertical', isBR2 = false },
    ref
  ) {
    const explicitStatus = hasExplicitStatus(result.status)
    const missingTime = hasMissingTime(result)
    const showAsInvalid = explicitStatus || missingTime

    // Check if we have BR2 merged data (run1/run2 populated)
    const hasMergedData = isBR2 && (result.run1 || result.run2)
    const showBR2Columns = hasMergedData && layoutMode === 'vertical'

    // Build row classes
    let rowClasses = styles.row
    if (isHighlighted) rowClasses += ` ${styles.highlighted}`
    if (layoutMode === 'ledwall') rowClasses += ` ${styles.ledwall}`
    if (showBR2Columns) rowClasses += ` ${styles.br2Row}`

    // Determine what to show in time column:
    // - Explicit status (DNS/DNF/DSQ): show status text
    // - Missing time without status: show nothing
    // - Valid time: show total
    const timeDisplay = explicitStatus
      ? result.status
      : missingTime
        ? ''
        : result.total

    // For BR2 with merged data on vertical, show two run columns
    if (showBR2Columns) {
      const run1Better = result.bestRun === 1
      const run2Better = result.bestRun === 2

      return (
        <div ref={ref} className={rowClasses} data-bib={result.bib}>
          <div className={styles.rank}>{showAsInvalid ? '' : `${result.rank}.`}</div>
          <div className={styles.bib}>{result.bib}</div>
          <div className={styles.name}>{formatName(result.name)}</div>
          <RunTimeCell run={result.run1} isBetter={run1Better} showPenalty={true} />
          <RunTimeCell run={result.run2} isBetter={run2Better} showPenalty={true} />
          {showBehind && (
            <div className={styles.behind}>
              {showAsInvalid ? '' : formatBehind(result.behind)}
            </div>
          )}
        </div>
      )
    }

    // Standard single-time display (non-BR2 or ledwall)
    return (
      <div ref={ref} className={rowClasses} data-bib={result.bib}>
        <div className={styles.rank}>{showAsInvalid ? '' : `${result.rank}.`}</div>
        <div className={styles.bib}>{result.bib}</div>
        <div className={styles.name}>{formatName(result.name)}</div>
        {showPenalty && (
          <div className={`${styles.penalty} ${showAsInvalid ? styles.penaltyHidden : getPenaltyClass(result.pen)}`}>
            {showAsInvalid ? '' : result.pen}
          </div>
        )}
        <div className={`${styles.time} ${showAsInvalid ? styles.statusIndicator : ''}`}>
          {timeDisplay}
        </div>
        {showBehind && (
          <div className={styles.behind}>
            {showAsInvalid ? '' : formatBehind(result.behind)}
          </div>
        )}
      </div>
    )
  }
)

export default ResultRow
