import { useMemo } from 'react'
import styles from './CurrentCompetitor.module.css'
import type { OnCourseCompetitor } from '@/types'
import { formatName, formatClub } from '@/utils/formatName'
import { formatTime, formatTTBDiff } from '@/utils/formatTime'
import { parseGates, type GatePenalty } from '@/providers/utils/parseGates'

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

/**
 * Get CSS class for penalty value
 */
function getPenaltyClass(penalty: number): string {
  if (penalty === 0) return styles.clear
  if (penalty <= 4) return styles.touch // 2s or 4s (double touch)
  return styles.miss // 50s
}

/**
 * Get CSS class for gate penalty
 */
function getGateClass(penalty: GatePenalty): string {
  if (penalty === null) return styles.pending
  if (penalty === 0) return styles.clear
  if (penalty === 2) return styles.touch
  return styles.miss // 50
}

/**
 * Get gate display value
 */
function getGateDisplay(penalty: GatePenalty): string {
  if (penalty === null) return '-'
  return penalty.toString()
}

/**
 * Get aria label for gate penalty (accessibility)
 */
function getGateAriaLabel(penalty: GatePenalty, gateNumber: number): string {
  if (penalty === null) return `Brána ${gateNumber}: neprojeta`
  if (penalty === 0) return `Brána ${gateNumber}: čistě`
  if (penalty === 2) return `Brána ${gateNumber}: dotyk, 2 sekundy`
  return `Brána ${gateNumber}: neprojetí, 50 sekund`
}

/**
 * Get aria label for TTB diff (accessibility)
 */
function getTTBAriaLabel(ttbDiff: string): string {
  if (!ttbDiff) return ''
  if (ttbDiff.startsWith('-')) {
    return `Vpředu o ${ttbDiff.substring(1)}`
  }
  return `Pozadu o ${ttbDiff.startsWith('+') ? ttbDiff.substring(1) : ttbDiff}`
}

/**
 * Get TTB diff class (ahead/behind)
 */
function getTTBClass(ttbDiff: string): string {
  if (!ttbDiff) return ''
  if (ttbDiff.startsWith('-')) return styles.ahead
  return styles.behind
}

/**
 * Check if competitor is still running (not finished)
 */
function isRunning(competitor: OnCourseCompetitor): boolean {
  return !competitor.dtFinish
}

/**
 * CurrentCompetitor component
 *
 * Displays the competitor currently on course with:
 * - Bib number (large, prominent)
 * - Name and club
 * - Running or final time
 * - TTB (Time To Beat) difference
 * - Gate penalties visualization
 * - Pulsing indicator for running competitor
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
  // Parse gates into penalty array
  const gates = useMemo(() => {
    if (!competitor) return []
    return parseGates(competitor.gates)
  }, [competitor])

  // Container classes
  const containerClasses = [
    styles.container,
    !visible && styles.hidden,
    isDeparting && styles.departing,
  ]
    .filter(Boolean)
    .join(' ')

  // If no competitor, render hidden container (for animation purposes)
  if (!competitor) {
    return <div className={`${styles.container} ${styles.hidden}`} />
  }

  const running = isRunning(competitor)
  const formattedTime = formatTime(competitor.time)
  const formattedTTBDiff = formatTTBDiff(competitor.ttbDiff)
  const ttbClass = getTTBClass(competitor.ttbDiff)

  return (
    <div className={containerClasses} data-testid="oncourse">
      {/* Main info row: bib, name, club, time */}
      <div className={styles.mainRow}>
        <div className={styles.bib}>{competitor.bib}</div>

        <div className={styles.competitorInfo}>
          <div className={styles.name}>{formatName(competitor.name)}</div>
          <div className={styles.club}>{formatClub(competitor.club)}</div>
        </div>

        <div className={styles.timeContainer}>
          {running && <span className={styles.runningIndicator}>&#9658;</span>}
          <div className={styles.time}>{formattedTime}</div>
        </div>

        {isDeparting && (
          <span className={styles.departingLabel}>Odchod</span>
        )}
      </div>

      {/* TTB info row */}
      {(formattedTTBDiff || competitor.ttbName) && (
        <div className={styles.ttbRow}>
          <span className={styles.ttbLabel}>TTB</span>
          {formattedTTBDiff && (
            <span
              className={`${styles.ttbDiff} ${ttbClass}`}
              aria-label={getTTBAriaLabel(competitor.ttbDiff)}
            >
              {formattedTTBDiff}
            </span>
          )}
          {competitor.ttbName && (
            <span className={styles.ttbName}>{competitor.ttbName}</span>
          )}
          {competitor.rank > 0 && (
            <span className={styles.rank}>#{competitor.rank}</span>
          )}
        </div>
      )}

      {/* Penalties row */}
      <div className={styles.penaltiesRow}>
        <div className={styles.penaltyTotal}>
          <span className={styles.penaltyLabel}>Pen</span>
          <span
            className={`${styles.penaltyValue} ${getPenaltyClass(competitor.pen)}`}
          >
            {competitor.pen}s
          </span>
        </div>

        {/* Gate penalties visualization */}
        <div className={styles.gatesContainer} role="list" aria-label="Penalizace na branách">
          {gates.map((penalty, index) => {
            // Use stable gate number as key - gates have fixed positions
            const gateNumber = index + 1
            return (
              <div
                key={`gate-${gateNumber}`}
                className={`${styles.gate} ${getGateClass(penalty)}`}
                role="listitem"
                aria-label={getGateAriaLabel(penalty, gateNumber)}
                title={`Brána ${gateNumber}`}
              >
                {getGateDisplay(penalty)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default CurrentCompetitor
