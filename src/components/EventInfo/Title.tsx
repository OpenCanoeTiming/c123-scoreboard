import { useLayout } from '@/hooks'
import styles from './Title.module.css'

/**
 * Props for Title component
 */
interface TitleProps {
  /** Event/race title to display */
  title: string
  /** Race name from results data (e.g. "K1m - střední trať - 2. jízda") */
  raceName?: string
  /** Whether the component is visible */
  visible?: boolean
}

/**
 * Extract category code from race name
 * e.g. "K1m - střední trať - 2. jízda" -> "K1M"
 * e.g. "C1ž - horní trať - 1. jízda" -> "C1Ž"
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
 * Displays the event/race title with category. Font size adapts based on layout mode.
 * Format depends on available data:
 * - Title + category: "TITLE: CATEGORY"
 * - Title only: "TITLE"
 * - Category only (no title): "CATEGORY"
 * - Neither: nothing displayed
 *
 * @example
 * ```tsx
 * <Title
 *   title={title}
 *   raceName={raceName}
 *   visible={visibility.displayTitle}
 * />
 * ```
 */
export function Title({ title, raceName = '', visible = true }: TitleProps) {
  const { layoutMode } = useLayout()

  if (!visible) {
    return null
  }

  const category = extractCategory(raceName)

  // Build display text based on available data:
  // - Title + category: "TITLE: CATEGORY"
  // - Title only: "TITLE"
  // - Category only: "CATEGORY" (fallback when no title/eventName)
  // - Neither: return null
  let displayTitle: string
  if (title && category) {
    displayTitle = `${title.toUpperCase()}: ${category}`
  } else if (title) {
    displayTitle = title.toUpperCase()
  } else if (category) {
    // Fallback: show just category when no event title is available
    displayTitle = category
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
