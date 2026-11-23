import { forwardRef } from 'react'
import styles from './ResultsList.module.css'
import type { ResultRowView, TimeCellView } from '@/view/boardView'

/**
 * Props for ResultRow component
 */
interface ResultRowProps {
  /** Row to display */
  row: ResultRowView
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
function getPenaltyClass(cell: TimeCellView): string {
  if (cell.penaltyKind === 'clear') return styles.penaltyClear
  if (cell.penaltyKind === 'touch') return styles.penaltyTouch // 2s or 4s (double touch)
  return styles.penaltyMiss // 50s+
}

/**
 * RunTimeCell - displays time with optional penalty prefix
 * Format: "(+2) 85.00" - penalty before time, only shown when > 0
 * Times stay right-aligned, penalty is small and muted
 */
function RunTimeCell({
  cell,
  isBetter,
}: {
  cell: TimeCellView
  isBetter: boolean
}) {
  const opacityClass = isBetter ? '' : styles.worseRun

  // No run data - show empty
  if (cell.kind === 'none') {
    return (
      <div className={`${styles.runCell} ${opacityClass}`}>
        <span className={styles.runTime}></span>
      </div>
    )
  }

  // Invalid status
  if (cell.kind === 'status') {
    return (
      <div className={`${styles.runCell} ${opacityClass}`}>
        <span className={`${styles.runTime} ${styles.statusIndicator}`}>{cell.text}</span>
      </div>
    )
  }

  // Missing time
  if (cell.kind === 'missing') {
    return (
      <div className={`${styles.runCell} ${opacityClass}`}>
        <span className={styles.runTime}>{cell.text}</span>
      </div>
    )
  }

  // Valid run - time with penalty badge (always shown for alignment)
  // Build badge classes
  let badgeClass = styles.runPenaltyBadge
  if (cell.penaltyLarge) badgeClass += ` ${styles.runPenaltyBadgeLarge}`
  if (cell.penaltyKind === 'clear') {
    // Invisible spacer for alignment
    badgeClass += ` ${styles.runPenaltyBadgeSpacer}`
  } else if (isBetter) {
    // Subtle gray for better run - doesn't compete for attention
    badgeClass += ` ${styles.runPenaltyBadgeBetter}`
  }

  return (
    <div className={`${styles.runCell} ${opacityClass}`}>
      <span className={styles.runTime}>
        {cell.underReview && <sup className={styles.investigationStar}>*</sup>}
        {cell.text}
      </span>
      <span className={badgeClass}>{cell.penalty}</span>
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
 *   row={row}
 *   isHighlighted={row.highlighted}
 *   showPenalty={layoutMode !== 'ledwall'}
 * />
 * ```
 */
export const ResultRow = forwardRef<HTMLDivElement, ResultRowProps>(
  function ResultRow(
    { row, isHighlighted = false, showPenalty = true, showBehind = true, layoutMode = 'vertical' },
    ref
  ) {
    const cell = row.result
    const showAsInvalid = cell.kind !== 'time'

    // Both runs of a best-run race are shown on vertical only
    const showBR2Columns = row.runs !== null && layoutMode === 'vertical'

    // Build row classes
    let rowClasses = styles.row
    if (isHighlighted) rowClasses += ` ${styles.highlighted}`
    if (layoutMode === 'ledwall') {
      // Use ledwallNoPenalty when penalty column is hidden (more space for names)
      rowClasses += showPenalty ? ` ${styles.ledwall}` : ` ${styles.ledwallNoPenalty}`
    }
    if (showBR2Columns) rowClasses += ` ${styles.br2Row}`

    // For BR2 with merged data on vertical, show two run columns
    if (showBR2Columns && row.runs) {
      return (
        <div ref={ref} className={rowClasses} data-bib={row.bib}>
          <div className={styles.rank}>{row.rank}</div>
          <div className={styles.bib}>{row.bib}</div>
          <div className={styles.name}>{row.name}</div>
          <RunTimeCell cell={row.runs.first} isBetter={row.runs.better === 1} />
          <RunTimeCell cell={row.runs.second} isBetter={row.runs.better === 2} />
          {showBehind && (
            <div className={styles.behind}>
              {row.behind}
            </div>
          )}
        </div>
      )
    }

    // Single-run vertical layout - use same style as BR2 but with one time column
    if (layoutMode === 'vertical') {
      // Build classes for single-run vertical (without br2Row)
      let singleRunClasses = styles.row
      if (isHighlighted) singleRunClasses += ` ${styles.highlighted}`
      singleRunClasses += ` ${styles.singleRunVertical}`

      return (
        <div ref={ref} className={singleRunClasses} data-bib={row.bib}>
          <div className={styles.rank}>{row.rank}</div>
          <div className={styles.bib}>{row.bib}</div>
          <div className={styles.name}>{row.name}</div>
          <RunTimeCell cell={cell} isBetter={true} />
          {showBehind && (
            <div className={styles.behind}>
              {row.behind}
            </div>
          )}
        </div>
      )
    }

    // Ledwall layout - separate penalty and time columns
    return (
      <div ref={ref} className={rowClasses} data-bib={row.bib}>
        <div className={styles.rank}>{row.rank}</div>
        <div className={styles.bib}>{row.bib}</div>
        <div className={styles.name}>{row.name}</div>
        {showPenalty && (
          <div className={`${styles.penalty} ${showAsInvalid ? styles.penaltyHidden : getPenaltyClass(cell)}`}>
            {showAsInvalid ? '' : cell.penalty}
          </div>
        )}
        <div className={`${styles.time} ${showAsInvalid ? styles.statusIndicator : ''}`}>
          {cell.underReview && !showAsInvalid && <sup className={styles.investigationStar}>*</sup>}
          {cell.text}
        </div>
        {showBehind && (
          <div className={styles.behind}>
            {row.behind}
          </div>
        )}
      </div>
    )
  }
)

export default ResultRow
