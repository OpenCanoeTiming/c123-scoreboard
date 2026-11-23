import { useLayout } from '@/hooks/useLayout'
import type { TitleView } from '@/view/boardView'
import styles from './Title.module.css'

/**
 * Props for Title component
 */
interface TitleProps {
  /** Title line: event, category and run */
  title: TitleView
  /** Whether the component is visible */
  visible?: boolean
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
 *   title={view.title}
 *   visible={view.visibility.title}
 * />
 * ```
 */
export function Title({ title: titleView, visible = true }: TitleProps) {
  const { layoutMode } = useLayout()

  if (!visible) {
    return null
  }

  const { event: title, category, run: runNumber } = titleView

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
