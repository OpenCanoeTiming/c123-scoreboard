import { useMemo } from 'react'
import styles from './OnCourseDisplay.module.css'
import type { OnCourseCompetitor } from '@/types'
import { formatName } from '@/utils/formatName'
import { createGateClassGetter } from '@/utils/getGateClass'
import { getPenaltyGates } from '@/providers/utils/parseGates'
import { useLayout } from '@/hooks/useLayout'

/**
 * Props for OnCourseDisplay component
 */
interface OnCourseDisplayProps {
  /** Competitors currently on course */
  competitors: OnCourseCompetitor[]
  /** Whether the component is visible */
  visible?: boolean
  /** Bib of current competitor to exclude (already shown in CurrentCompetitor) */
  excludeBib?: string
}

const getGateClass = createGateClassGetter(styles)

/**
 * Check if competitor is actively racing (has started).
 * Filters out competitors who are in the oncourse list but haven't started yet.
 */
function isActivelyRacing(competitor: OnCourseCompetitor): boolean {
  // Must have a start time to be considered actively racing
  if (!competitor.dtStart) return false

  // Also check for valid running time
  const time = competitor.total || competitor.time
  if (!time) return false
  if (time === '0:00.00' || time === '0.00' || time === '0') return false
  return true
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
      return isActivelyRacing(competitor)
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
  competitor: OnCourseCompetitor
  layoutMode: 'vertical' | 'ledwall'
}

function OnCourseRow({ competitor, layoutMode }: OnCourseRowProps) {
  // Get gates with penalties (2s or 50s)
  const penaltyGates = useMemo(() => {
    return getPenaltyGates(competitor.gates)
  }, [competitor.gates])

  const hasPenalty = competitor.pen > 0
  const displayTime = competitor.total || competitor.time

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
      <div className={styles.name}>{formatName(competitor.name)}</div>

      {/* Gate penalties - show gate numbers with penalties */}
      <div className={styles.gatesContainer}>
        {penaltyGates.map(({ gateNumber, penalty }) => (
          <span
            key={`gate-${gateNumber}`}
            className={`${styles.gatePenalty} ${getGateClass(penalty)}`}
          >
            {gateNumber}
          </span>
        ))}

        {/* Total penalty */}
        <div
          className={`${styles.pen} ${hasPenalty ? styles.hasPenalty : styles.noPenalty}`}
        >
          {competitor.pen}
        </div>
      </div>

      {/* Time */}
      <div className={styles.total}>{displayTime}</div>
    </div>
  )
}

export default OnCourseDisplay
