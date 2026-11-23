import { useMemo, type CSSProperties } from 'react'
import styles from './ResultsList.module.css'
import { ResultRow } from './ResultRow'
import type { ResultRowView, ResultsScrollView } from '@/view/boardView'
import { useLayout } from '@/hooks/useLayout'
import { useAutoScroll } from '@/hooks/useAutoScroll'

/**
 * Props for ResultsList component
 */
interface ResultsListProps {
  /** Result rows to display */
  rows: ResultRowView[]
  /** Whether the component is visible */
  visible?: boolean
  /** What paces the auto-scroll; default: no highlight, nobody racing */
  scroll?: ResultsScrollView
}

const NO_SCROLL_INPUTS: ResultsScrollView = { highlightBib: null, someoneRacing: false }

/**
 * ResultsList component
 *
 * Displays a scrollable list of race results with:
 * - Alternating row colors
 * - Highlight styling for recently finished competitors
 * - Auto-scroll to highlighted row
 * - Scroll back to top after highlight expires
 *
 * Responsive behavior:
 * - Vertical layout: all columns visible
 * - Ledwall layout: behind column hidden (matches original v1)
 *
 * When displayRows is set (ledwall scaling mode), the container has a fixed
 * height to enable scrolling within the scaled layout.
 *
 * @example
 * ```tsx
 * <ResultsList
 *   rows={view.rows}
 *   visible={view.visibility.results}
 * />
 * ```
 */
export function ResultsList({ rows, visible = true, scroll = NO_SCROLL_INPUTS }: ResultsListProps) {
  const { disableScroll, layoutMode, displayRows, rowHeight } = useLayout()

  // Auto-scroll through results when no highlight is active
  // Disabled via URL parameter for stable screenshots
  const { containerRef } = useAutoScroll({
    enabled: rows.length > 0 && !disableScroll,
    highlightBib: scroll.highlightBib,
    someoneRacing: scroll.someoneRacing,
  })

  // When displayRows is set, fix the container height to enable scrolling
  // within the scaled layout (otherwise content expands and no scroll is needed)
  const containerStyle = useMemo((): CSSProperties => {
    if (displayRows === null) return {}
    // Row margin is 2px top + 2px bottom = 4px per row (from ResultsList.module.css)
    const ROW_MARGIN = 4
    const rowWithMargin = rowHeight + ROW_MARGIN
    return {
      height: `${displayRows * rowWithMargin}px`,
      maxHeight: `${displayRows * rowWithMargin}px`,
      overflow: 'hidden auto', // hidden horizontal, auto vertical
    }
  }, [displayRows, rowHeight])

  // Whether to show behind column (hidden on ledwall, shown on vertical)
  // Penalty column hidden on ledwall - saves space and avoids confusion in BR2
  // where displayed time may be from different run than the penalty
  const showBehind = layoutMode !== 'ledwall'
  const showPenalty = layoutMode !== 'ledwall'

  // Container classes
  const containerClasses = `${styles.container}${!visible ? ` ${styles.hidden}` : ''}`

  // Empty state
  if (rows.length === 0) {
    return (
      <div className={containerClasses} data-testid="results-list">
        <div className={styles.empty}>Zatím žádné výsledky</div>
      </div>
    )
  }

  return (
    <div className={containerClasses} ref={containerRef} style={containerStyle} data-testid="results-list">
      {/* Result rows - no header row to match original v1 */}
      {rows.map((row) => (
        <ResultRow
          key={row.bib}
          row={row}
          isHighlighted={row.highlighted}
          showPenalty={showPenalty}
          showBehind={showBehind}
          layoutMode={layoutMode}
        />
      ))}
    </div>
  )
}

export default ResultsList
