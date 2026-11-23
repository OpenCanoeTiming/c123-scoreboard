import styles from './ConnectionStatus.module.css'
import type { ConnectionView } from '@/view/boardView'

/**
 * Props for ConnectionStatus component
 */
interface ConnectionStatusProps {
  /** State of the connection dot */
  connection: ConnectionView
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
export function ConnectionStatus({ connection }: ConnectionStatusProps) {
  // Determine the style class based on the connection state
  let statusClass: string

  if (connection === 'live') {
    statusClass = styles.connected
  } else if (connection === 'connecting') {
    statusClass = styles.connecting
  } else if (connection === 'reconnecting') {
    statusClass = styles.reconnecting
  } else if (connection === 'error') {
    statusClass = styles.error
  } else {
    statusClass = styles.disconnected
  }

  return <div className={`${styles.indicator} ${statusClass}`} />
}

export default ConnectionStatus
