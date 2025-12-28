import { useLayout } from '@/hooks'
import styles from './Title.module.css'

/**
 * Props for Title component
 */
interface TitleProps {
  /** Event/race title to display */
  title: string
  /** Whether the component is visible */
  visible?: boolean
}

/**
 * Title component
 *
 * Displays the event/race title. Font size adapts based on layout mode.
 *
 * @example
 * ```tsx
 * <Title
 *   title={title}
 *   visible={visibility.displayTitle}
 * />
 * ```
 */
export function Title({ title, visible = true }: TitleProps) {
  const { layoutMode } = useLayout()

  if (!visible || !title) {
    return null
  }

  const layoutClass = layoutMode === 'ledwall' ? styles.ledwall : ''

  return (
    <div
      className={`${styles.title} ${layoutClass}`.trim()}
      data-testid="event-title"
      data-layout-mode={layoutMode}
    >
      <span className={styles.text}>{title}</span>
    </div>
  )
}

export default Title
