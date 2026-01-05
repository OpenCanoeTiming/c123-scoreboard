import { useMemo, type CSSProperties } from 'react'
import styles from './ResultsList.module.css'
import { ResultRow } from './ResultRow'
import type { Result } from '@/types'
import { useHighlight } from '@/hooks/useHighlight'
import { useLayout } from '@/hooks/useLayout'
import { useAutoScroll } from '@/hooks/useAutoScroll'
import { useScoreboard } from '@/context/ScoreboardContext'
import { isBR2Race } from '@/utils/raceUtils'

/**
 * Props for ResultsList component
 */
interface ResultsListProps {
  /** Array of results to display */
  results: Result[]
  /** Whether the component is visible */
  visible?: boolean
}

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
 *   results={results}
 *   visible={visibility.displayTop}
 * />
 * ```
 */
export function ResultsList({ results, visible = true }: ResultsListProps) {
  const { highlightBib, isActive } = useHighlight()
  const { disableScroll, layoutMode, displayRows, rowHeight } = useLayout()
  const { raceId } = useScoreboard()

  // Detect BR2 race for merged display
  const isBR2 = isBR2Race(raceId)

  // Auto-scroll through results when no highlight is active
  // Disabled via URL parameter for stable screenshots
  const { containerRef } = useAutoScroll({
    enabled: results.length > 0 && !disableScroll,
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
  // Note: Penalty column is always shown on both layouts (matches original v1)
  // Exception: BR2 ledwall hides penalty because it may be from a different run than the displayed time
  const showBehind = layoutMode !== 'ledwall'
  const showPenalty = !(layoutMode === 'ledwall' && isBR2)

  // Container classes
  const containerClasses = `${styles.container}${!visible ? ` ${styles.hidden}` : ''}`

  // Empty state
  if (results.length === 0) {
    return (
      <div className={containerClasses} data-testid="results-list">
        <div className={styles.empty}>Zatím žádné výsledky</div>
      </div>
    )
  }

  return (
    <div className={containerClasses} ref={containerRef} style={containerStyle} data-testid="results-list">
      {/* Result rows - no header row to match original v1 */}
      {results.map((result) => {
        const isHighlighted = isActive && result.bib === highlightBib
        return (
          <ResultRow
            key={result.bib}
            result={result}
            isHighlighted={isHighlighted}
            showPenalty={showPenalty}
            showBehind={showBehind}
            layoutMode={layoutMode}
            isBR2={isBR2}
          />
        )
      })}
    </div>
  )
}

export default ResultsList
