import { forwardRef } from 'react'
import styles from './ResultsList.module.css'
import type { Result } from '@/types'
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
 * ResultRow component
 *
 * Displays a single result in the results list with:
 * - Rank (position)
 * - Bib (start number)
 * - Name (competitor name)
 * - Penalty (optional, hidden on ledwall)
 * - Time (total time)
 * - Behind (optional, time behind leader)
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
    const rowClasses = [
      styles.row,
      isHighlighted && styles.highlighted,
      layoutMode === 'ledwall' && styles.ledwall,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div ref={ref} className={rowClasses}>
        <div className={styles.rank}>{result.rank}.</div>
        <div className={styles.bib}>{result.bib}</div>
        <div className={styles.name}>{formatName(result.name)}</div>
        {showPenalty && (
          <div className={`${styles.penalty} ${getPenaltyClass(result.pen)}`}>
            {result.pen}
          </div>
        )}
        <div className={styles.time}>{result.total}</div>
        {showBehind && (
          <div className={styles.behind}>{formatBehind(result.behind)}</div>
        )}
      </div>
    )
  }
)

export default ResultRow
