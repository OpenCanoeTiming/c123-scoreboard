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
 * Title component
 *
 * Displays event name and race identification. Font size adapts based on layout mode.
 * Run number is displayed as a smaller superscript for elegance.
 *
 * Examples:
 * - "Jarní slalomy K1M" with superscript "1" (event + category + 1st run)
 * - "Jarní slalomy K1M" with superscript "2" (event + category + 2nd run)
 * - "Jarní slalomy K1M" (event name + category, no run number)
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
  const runNumber = raceId ? getRunNumber(raceId) : null

  // Need at least title or category to display
  if (!title && !category) {
    return null
  }

  const layoutClass = layoutMode === 'ledwall' ? styles.ledwall : ''

  return (
    <div
      className={`${styles.title} ${layoutClass}`.trim()}
      data-testid="title"
      data-layout-mode={layoutMode}
    >
      <span className={styles.text}>
        {title}
        {title && category && ' '}
        {category && (
          <span className={styles.category}>
            {category}
            {runNumber && <sub className={styles.runNumber}>/{runNumber}.</sub>}
          </span>
        )}
      </span>
    </div>
  )
}

export default Title
