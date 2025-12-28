import { formatTime } from '@/utils/formatTime'
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
 */
export function TimeDisplay({
  time,
  visible = true,
  className,
}: TimeDisplayProps) {
  if (!visible) {
    return null
  }

  const formattedTime = formatTime(time)

  return (
    <div
      className={`${styles.timeDisplay} ${className ?? ''}`}
      data-testid="time-display"
    >
      {formattedTime}
    </div>
  )
}
