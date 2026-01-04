import { forwardRef } from 'react'
import styles from './ResultsList.module.css'
import type { Result, ResultStatus } from '@/types'
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
    { result, isHighlighted = false, showPenalty = true, showBehind = true, layoutMode = 'vertical' },
    ref
  ) {
    const rowClasses = `${styles.row}${isHighlighted ? ` ${styles.highlighted}` : ''}${layoutMode === 'ledwall' ? ` ${styles.ledwall}` : ''}`
    const explicitStatus = hasExplicitStatus(result.status)
    const missingTime = hasMissingTime(result)
    const showAsInvalid = explicitStatus || missingTime

    // Determine what to show in time column:
    // - Explicit status (DNS/DNF/DSQ): show status text
    // - Missing time without status: show nothing
    // - Valid time: show total
    const timeDisplay = explicitStatus
      ? result.status
      : missingTime
        ? ''
        : result.total

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
