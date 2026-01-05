import { useLayout } from '@/hooks'
import { getRunNumber } from '@/utils/raceUtils'
import styles from './Title.module.css'

/**
 * Props for Title component
 */
interface TitleProps {
  /** Event name (from discover endpoint or customTitle) */
  title: string
  /** Race name from results data (e.g. "K1m - střední trať") */
  raceName?: string
  /** Race ID for extracting run number (e.g. "K1M_ST_BR1_6") */
  raceId?: string
  /** Whether the component is visible */
  visible?: boolean
}

/**
 * Extract category code from race name
 * e.g. "K1m - střední trať" -> "K1M"
 * e.g. "C1ž - horní trať" -> "C1Ž"
 */
function extractCategory(raceName: string): string {
  if (!raceName) return ''

  // Split by " - " and take first part (category)
  const parts = raceName.split(' - ')
  if (parts.length === 0) return ''

  // Get category code (e.g. "K1m", "C1ž", "C2m")
  const category = parts[0].trim()
  if (!category) return ''

  // Return uppercase version
  return category.toUpperCase()
}

/**
 * Build race identification string (category + run number)
 * e.g. "K1M/1." or "K1M/2." or just "K1M" if no run number
 */
function buildRaceIdentification(category: string, raceId: string): string {
  if (!category) return ''

  const runNumber = raceId ? getRunNumber(raceId) : null
  if (runNumber) {
    return `${category}/${runNumber}.`
  }
  return category
}

/**
 * Title component
 *
 * Displays event name and race identification. Font size adapts based on layout mode.
 * Format: "Event Name CATEGORY/RUN."
 *
 * Examples:
 * - "Jarní slalomy K1M/1." (event name + category + 1st run)
 * - "Jarní slalomy K1M/2." (event name + category + 2nd run)
 * - "Jarní slalomy K1M" (event name + category, no run number)
 * - "K1M/1." (no event name, just race identification)
 *
 * @example
 * ```tsx
 * <Title
 *   title={title}
 *   raceName={raceName}
 *   raceId={raceId}
 *   visible={visibility.displayTitle}
 * />
 * ```
 */
export function Title({ title, raceName = '', raceId = '', visible = true }: TitleProps) {
  const { layoutMode } = useLayout()

  if (!visible) {
    return null
  }

  const category = extractCategory(raceName)
  const raceIdentification = buildRaceIdentification(category, raceId)

  // Build display text:
  // - Event name + race identification: "Event Name CATEGORY/RUN."
  // - Event name only: "Event Name"
  // - Race identification only: "CATEGORY/RUN." (fallback)
  // - Neither: return null
  let displayTitle: string
  if (title && raceIdentification) {
    displayTitle = `${title} ${raceIdentification}`
  } else if (title) {
    displayTitle = title
  } else if (raceIdentification) {
    // Fallback: show just race identification when no event name
    displayTitle = raceIdentification
  } else {
    // Nothing to display
    return null
  }

  const layoutClass = layoutMode === 'ledwall' ? styles.ledwall : ''

  return (
    <div
      className={`${styles.title} ${layoutClass}`.trim()}
      data-testid="title"
      data-layout-mode={layoutMode}
    >
      <span className={styles.text}>{displayTitle}</span>
    </div>
  )
}

export default Title
