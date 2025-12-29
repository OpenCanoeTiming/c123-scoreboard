import { useLayout } from '@/hooks'
import styles from './TimeDisplay.module.css'

interface TimeDisplayProps {
  /** Time value to display (e.g., "10:34:08" for day time) */
  time: string | null | undefined
  /** Whether the component is visible */
  visible?: boolean
  /** Optional CSS class name */
  className?: string
}

/**
 * TimeDisplay component for showing the day time in the scoreboard header.
 * Uses JetBrains Mono font for consistent digit width.
 * Styling adapts based on layout mode (vertical/ledwall).
 */
export function TimeDisplay({
  time,
  visible = true,
  className,
}: TimeDisplayProps) {
  const { layoutMode } = useLayout()

  if (!visible || !time) {
    return null
  }

  const layoutClass = layoutMode === 'ledwall' ? styles.ledwall : ''

  return (
    <div
      className={`${styles.timeDisplay} ${layoutClass} ${className ?? ''}`.trim()}
      data-testid="time-display"
      data-layout-mode={layoutMode}
    >
      {time}
    </div>
  )
}
