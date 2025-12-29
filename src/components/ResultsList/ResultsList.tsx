import styles from './ResultsList.module.css'
import { ResultRow } from './ResultRow'
import type { Result } from '@/types'
import { useHighlight } from '@/hooks/useHighlight'
import { useLayout } from '@/hooks/useLayout'
import { useAutoScroll } from '@/hooks/useAutoScroll'

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
  const { disableScroll, layoutMode } = useLayout()

  // Auto-scroll through results when no highlight is active
  // Disabled via URL parameter for stable screenshots
  const { containerRef } = useAutoScroll({
    enabled: results.length > 0 && !disableScroll,
  })

  // Whether to show optional columns based on layout
  // Original v1 shows penalty column on both layouts, but hides behind in ledwall
  const showPenalty = true
  const showBehind = layoutMode !== 'ledwall'

  // Container classes
  const containerClasses = [styles.container, !visible && styles.hidden]
    .filter(Boolean)
    .join(' ')

  // Empty state
  if (results.length === 0) {
    return (
      <div className={containerClasses} data-testid="results-list">
        <div className={styles.empty}>Zatím žádné výsledky</div>
      </div>
    )
  }

  return (
    <div className={containerClasses} ref={containerRef} data-testid="results-list">
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
          />
        )
      })}
    </div>
  )
}

export default ResultsList
