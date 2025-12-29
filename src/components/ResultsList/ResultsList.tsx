import { useRef, useEffect } from 'react'
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
 * - Ledwall layout: penalty and behind columns hidden
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
  const highlightedRowRef = useRef<HTMLDivElement>(null)

  const { highlightBib, isActive } = useHighlight()
  const { disableScroll } = useLayout()

  // Auto-scroll through results when no highlight is active
  // Disabled via URL parameter for stable screenshots
  const { containerRef } = useAutoScroll({
    scrollSpeed: 50,
    pauseAtBottom: 2000,
    enabled: results.length > 0 && !disableScroll,
  })

  // Whether to show optional columns based on layout
  // Original v1 shows penalty and behind columns on BOTH vertical and ledwall
  const showPenalty = true
  const showBehind = true

  // Container classes
  const containerClasses = [styles.container, !visible && styles.hidden]
    .filter(Boolean)
    .join(' ')

  /**
   * Scroll to highlighted row when highlight becomes active
   */
  useEffect(() => {
    if (isActive && highlightedRowRef.current && containerRef.current) {
      highlightedRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [isActive, highlightBib])

  /**
   * Scroll back to top when highlight expires
   */
  useEffect(() => {
    if (!isActive && containerRef.current) {
      // Small delay to let the highlight fade out
      const timeoutId = setTimeout(() => {
        containerRef.current?.scrollTo({
          top: 0,
          behavior: 'smooth',
        })
      }, 500)

      return () => clearTimeout(timeoutId)
    }
  }, [isActive])

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
            ref={isHighlighted ? highlightedRowRef : undefined}
            result={result}
            isHighlighted={isHighlighted}
            showPenalty={showPenalty}
            showBehind={showBehind}
          />
        )
      })}
    </div>
  )
}

export default ResultsList
