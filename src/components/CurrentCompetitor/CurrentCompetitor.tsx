import styles from './CurrentCompetitor.module.css'
import type { FeaturedRowView, GatePenaltyView } from '@/view/boardView'
import { useLayout } from '@/hooks/useLayout'

/**
 * Props for CurrentCompetitor component
 */
interface CurrentCompetitorProps {
  /** The featured on-course row, or null when nobody is shown */
  competitor: FeaturedRowView | null
  /** Whether the component is visible */
  visible?: boolean
}

function getGateClass(kind: GatePenaltyView['kind']): string {
  return kind === 'touch' ? styles.penalty2 : styles.penalty50
}

/**
 * CurrentCompetitor component
 *
 * Displays the competitor currently on course with single-row layout matching original v1:
 * - Running indicator (►) - pulsing yellow
 * - Bib number
 * - Name
 * - Gate penalties (only gates with 2s/50s penalties shown)
 * - Total penalty badge
 * - Current time (yellow)
 *
 * @example
 * ```tsx
 * <CurrentCompetitor
 *   competitor={view.featured}
 *   visible={view.visibility.featured}
 * />
 * ```
 */
export function CurrentCompetitor({
  competitor,
  visible = true,
}: CurrentCompetitorProps) {
  const { layoutMode } = useLayout()

  // If no competitor, render nothing
  if (!competitor) {
    return null
  }

  const isDeparting = competitor.departing

  // Container classes
  const containerClasses = `${styles.container} ${styles[layoutMode]}${!visible ? ` ${styles.hidden}` : ''}${isDeparting ? ` ${styles.departing}` : ''}`


  return (
    <div className={containerClasses} data-testid="oncourse">
      {/* Single row layout matching original v1 */}
      <div className={`${styles.row} ${styles[layoutMode]}`}>
        {/* Running indicator - pulsing yellow triangle */}
        <span className={styles.runningIndicator}>&#9658;</span>

        {/* Bib */}
        <div className={styles.bib}>{competitor.bib}</div>

        {/* Name */}
        <div className={styles.name}>{competitor.name}</div>

        {/* Gate penalties + total penalty */}
        <div className={styles.gatesContainer}>
          {competitor.gatePenalties.map(({ gate, kind }) => (
            <span
              key={`gate-${gate}`}
              className={`${styles.gatePenalty} ${getGateClass(kind)}`}
            >
              {gate}
            </span>
          ))}

          {/* Total penalty badge */}
          <div
            className={`${styles.pen} ${competitor.hasPenalty ? styles.hasPenalty : styles.noPenalty}`}
          >
            {competitor.penalty}
          </div>
        </div>

        {/* Time - yellow color */}
        <div className={styles.total}>{competitor.time}</div>
      </div>
    </div>
  )
}

export default CurrentCompetitor
