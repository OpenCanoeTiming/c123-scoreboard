import { formatTime } from '@/utils/formatTime'
import { useLayout } from '@/hooks'
import styles from './TimeDisplay.module.css'

interface TimeDisplayProps {
  /** Time value to display (seconds or formatted string) */
  time: string | number | null | undefined
  /** Whether the component is visible */
  visible?: boolean
  /** Optional CSS class name */
  className?: string
}

/**
 * TimeDisplay component for showing time in the scoreboard.
 * Uses JetBrains Mono font for consistent digit width.
 * Styling adapts based on layout mode (vertical/ledwall).
 */
export function TimeDisplay({
  time,
  visible = true,
  className,
}: TimeDisplayProps) {
  const { layoutMode } = useLayout()

  if (!visible) {
    return null
  }

  const formattedTime = formatTime(time)

  const layoutClass = layoutMode === 'ledwall' ? styles.ledwall : ''

  return (
    <div
      className={`${styles.timeDisplay} ${layoutClass} ${className ?? ''}`.trim()}
      data-testid="time-display"
      data-layout-mode={layoutMode}
    >
      {formattedTime}
    </div>
  )
}
