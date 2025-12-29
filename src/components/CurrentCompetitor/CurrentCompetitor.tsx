import { useMemo } from 'react'
import styles from './CurrentCompetitor.module.css'
import type { OnCourseCompetitor } from '@/types'
import { formatName } from '@/utils/formatName'
import { createGateClassGetter } from '@/utils/getGateClass'
import { parseGates } from '@/providers/utils/parseGates'
import { useLayout } from '@/hooks'

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

  // Parse gates into penalty array and filter only gates with penalties
  const penaltyGates = useMemo(() => {
    if (!competitor) return []
    const gates = parseGates(competitor.gates)
    return gates
      .map((penalty, index) => ({ gateNumber: index + 1, penalty }))
      .filter(
        (g) => g.penalty !== null && g.penalty !== 0
      ) as { gateNumber: number; penalty: 2 | 50 }[]
  }, [competitor])

  // If no competitor, render hidden container (for animation purposes)
  if (!competitor) {
    return <div className={`${styles.container} ${styles.hidden}`} />
  }

  // Container classes
  const containerClasses = [
    styles.container,
    !visible && styles.hidden,
    isDeparting && styles.departing,
  ]
    .filter(Boolean)
    .join(' ')

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
