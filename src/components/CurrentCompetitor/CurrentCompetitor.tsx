import { useMemo } from 'react'
import styles from './CurrentCompetitor.module.css'
import type { OnCourseCompetitor } from '@/types'
import { formatName } from '@/utils/formatName'
import { createGateClassGetter } from '@/utils/getGateClass'
import { getPenaltyGates } from '@/providers/utils/parseGates'
import { useLayout } from '@/hooks/useLayout'

/**
 * Props for CurrentCompetitor component
 */
interface CurrentCompetitorProps {
  /** The competitor currently on course */
  competitor: OnCourseCompetitor | null
  /** Whether the component is visible */
  visible?: boolean
  /** Whether this is the departing competitor (visual distinction) */
  isDeparting?: boolean
}

const getGateClass = createGateClassGetter(styles)

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
 *   competitor={currentCompetitor}
 *   visible={visibility.displayCurrent}
 * />
 * ```
 */
export function CurrentCompetitor({
  competitor,
  visible = true,
  isDeparting = false,
}: CurrentCompetitorProps) {
  const { layoutMode } = useLayout()

  // Get gates with penalties (2s or 50s)
  const penaltyGates = useMemo(() => {
    if (!competitor) return []
    return getPenaltyGates(competitor.gates)
  }, [competitor])

  // If no competitor, render nothing
  if (!competitor) {
    return null
  }

  // Don't show competitor who hasn't started yet (unless departing)
  // Competitors with dtStart=null and no valid time shouldn't be displayed
  if (!isDeparting && !competitor.dtStart) {
    return null
  }

  // Container classes
  const containerClasses = `${styles.container}${!visible ? ` ${styles.hidden}` : ''}${isDeparting ? ` ${styles.departing}` : ''}`

  // Display raw total time (not formatted) to match original v1 style
  const displayTime = (competitor.total || competitor.time || '').trim()
  const hasPenalty = competitor.pen > 0

  return (
    <div className={containerClasses} data-testid="oncourse">
      {/* Single row layout matching original v1 */}
      <div className={`${styles.row} ${styles[layoutMode]}`}>
        {/* Running indicator - pulsing yellow triangle */}
        <span className={styles.runningIndicator}>&#9658;</span>

        {/* Bib */}
        <div className={styles.bib}>{competitor.bib}</div>

        {/* Name */}
        <div className={styles.name}>{formatName(competitor.name)}</div>

        {/* Gate penalties + total penalty */}
        <div className={styles.gatesContainer}>
          {penaltyGates.map(({ gateNumber, penalty }) => (
            <span
              key={`gate-${gateNumber}`}
              className={`${styles.gatePenalty} ${getGateClass(penalty)}`}
            >
              {gateNumber}
            </span>
          ))}

          {/* Total penalty badge */}
          <div
            className={`${styles.pen} ${hasPenalty ? styles.hasPenalty : styles.noPenalty}`}
          >
            {competitor.pen}
          </div>
        </div>

        {/* Time - yellow color */}
        <div className={styles.total}>{displayTime}</div>
      </div>
    </div>
  )
}

export default CurrentCompetitor
