import styles from './ConnectionStatus.module.css'
import type { ConnectionStatus as ConnectionStatusType } from '@/types'

/**
 * Props for ConnectionStatus component
 */
interface ConnectionStatusProps {
  /** Current connection status */
  status: ConnectionStatusType
  /** Error message if any */
  error: string | null
  /** Whether initial data has been received */
  initialDataReceived: boolean
  /** Callback for manual retry (unused in dot indicator) */
  onRetry?: () => void
}

/**
 * ConnectionStatus component
 *
 * Small dot indicator in top-right corner:
 * - green: connected and receiving data
 * - yellow (pulsing): connecting or reconnecting
 * - red: disconnected or error
 *
 * Always visible as a small, unobtrusive indicator.
 */
export function ConnectionStatus({
  status,
  initialDataReceived,
}: ConnectionStatusProps) {
  // Determine the style class based on status
  let statusClass: string

  if (status === 'connected' && initialDataReceived) {
    statusClass = styles.connected
  } else if (status === 'connected' || status === 'connecting') {
    statusClass = styles.connecting
  } else if (status === 'reconnecting') {
    statusClass = styles.reconnecting
  } else if (status === 'error') {
    statusClass = styles.error
  } else {
    statusClass = styles.disconnected
  }

  return <div className={`${styles.indicator} ${statusClass}`} />
}

export default ConnectionStatus
