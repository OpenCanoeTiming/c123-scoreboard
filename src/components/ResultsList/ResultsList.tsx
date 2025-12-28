import { useRef, useEffect } from 'react'
import styles from './ResultsList.module.css'
import { ResultRow } from './ResultRow'
import type { Result } from '@/types'
import { useHighlight } from '@/hooks/useHighlight'
import { useLayout } from '@/hooks/useLayout'

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
 * - Column headers (Rank, Bib, Name, Penalty, Time, Behind)
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
  const containerRef = useRef<HTMLDivElement>(null)
  const highlightedRowRef = useRef<HTMLDivElement>(null)

  const { highlightBib, isActive } = useHighlight()
  const { layoutMode } = useLayout()

  // Whether to show optional columns based on layout
  const showPenalty = layoutMode !== 'ledwall'
  const showBehind = layoutMode !== 'ledwall'

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
      <div className={containerClasses}>
        <div className={styles.empty}>Zatím žádné výsledky</div>
      </div>
    )
  }

  return (
    <div className={containerClasses} ref={containerRef}>
      {/* Header row */}
      <div className={`${styles.row} ${styles.header}`}>
        <div className={styles.rank}>#</div>
        <div className={styles.bib}>St.</div>
        <div className={styles.name}>Jméno</div>
        {showPenalty && <div className={styles.penalty}>Pen</div>}
        <div className={styles.time}>Čas</div>
        {showBehind && <div className={styles.behind}>Ztráta</div>}
      </div>

      {/* Result rows */}
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
