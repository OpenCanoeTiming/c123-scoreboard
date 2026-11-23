import { useMemo } from 'react'
import styles from './OnCourseDisplay.module.css'
import type { GatePenaltyView, OnCourseRowView } from '@/view/boardView'
import { useLayout } from '@/hooks/useLayout'

/**
 * Props for OnCourseDisplay component
 */
interface OnCourseDisplayProps {
  /** Competitors currently on course */
  competitors: OnCourseRowView[]
  /** Whether the component is visible */
  visible?: boolean
  /** Bib of current competitor to exclude (already shown in CurrentCompetitor) */
  excludeBib?: string
}

function getGateClass(kind: GatePenaltyView['kind']): string {
  return kind === 'touch' ? styles.penalty2 : styles.penalty50
}

/**
 * OnCourseDisplay component
 *
 * Displays competitors currently on the course in a compact row format.
 * Each competitor shows:
 * - Running indicator (►)
 * - Bib number
 * - Name
 * - Gate penalties (only 2s and 50s shown with gate number)
 * - Total penalty
 * - Current time
 *
 * Note: This is different from CurrentCompetitor which shows more details
 * for the primary competitor. OnCourseDisplay shows a compact list of all
 * competitors on course (typically for interval start races).
 *
 * @example
 * ```tsx
 * <OnCourseDisplay
 *   competitors={onCourse}
 *   visible={visibility.displayOnCourse}
 *   excludeBib={currentCompetitor?.bib}
 * />
 * ```
 */
export function OnCourseDisplay({
  competitors,
  visible = true,
  excludeBib,
}: OnCourseDisplayProps) {
  const { layoutMode } = useLayout()

  // Filter out invalid competitors and exclude current competitor
  const filteredCompetitors = useMemo(() => {
    return competitors.filter((competitor) => {
      // Exclude the current competitor (shown separately)
      if (excludeBib && competitor.bib === excludeBib) return false
      // Must be actively racing (has started and has valid time)
      return competitor.racing
    })
  }, [competitors, excludeBib])

  // Don't render if not visible or no competitors
  if (!visible || filteredCompetitors.length === 0) {
    return null
  }

  return (
    <div className={`${styles.container} ${styles[layoutMode]}`} data-testid="oncourse-display">
      {filteredCompetitors.map((competitor) => (
        <OnCourseRow
          key={competitor.bib}
          competitor={competitor}
          layoutMode={layoutMode}
        />
      ))}
    </div>
  )
}

/**
 * Single competitor row
 */
interface OnCourseRowProps {
  competitor: OnCourseRowView
  layoutMode: 'vertical' | 'ledwall'
}

function OnCourseRow({ competitor, layoutMode }: OnCourseRowProps) {
  return (
    <div
      className={`${styles.row} ${styles[layoutMode]}`}
      data-testid="oncourse-row"
    >
      {/* Running indicator */}
      <span className={styles.runningIndicator}>&#9658;</span>

      {/* Bib */}
      <div className={styles.bib}>{competitor.bib}</div>

      {/* Name */}
      <div className={styles.name}>{competitor.name}</div>

      {/* Gate penalties - show gate numbers with penalties */}
      <div className={styles.gatesContainer}>
        {competitor.gatePenalties.map(({ gate, kind }) => (
          <span
            key={`gate-${gate}`}
            className={`${styles.gatePenalty} ${getGateClass(kind)}`}
          >
            {gate}
          </span>
        ))}

        {/* Total penalty */}
        <div
          className={`${styles.pen} ${competitor.hasPenalty ? styles.hasPenalty : styles.noPenalty}`}
        >
          {competitor.penalty}
        </div>
      </div>

      {/* Time */}
      <div className={styles.total}>{competitor.time}</div>
    </div>
  )
}

export default OnCourseDisplay
