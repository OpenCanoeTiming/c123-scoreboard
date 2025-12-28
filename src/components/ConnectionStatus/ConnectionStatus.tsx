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
  /** Callback for manual retry */
  onRetry?: () => void
}

/**
 * ConnectionStatus component
 *
 * Displays overlay for non-connected states:
 * - connecting: "Připojování..."
 * - waiting: "Čekání na data..." (connected but no data yet)
 * - reconnecting: "Obnovování spojení..."
 * - disconnected: "Odpojeno" with retry button
 * - error: Error message with retry button
 *
 * Hidden when connected and data received.
 */
export function ConnectionStatus({
  status,
  error,
  initialDataReceived,
  onRetry,
}: ConnectionStatusProps) {
  // Hide when connected and data received
  if (status === 'connected' && initialDataReceived) {
    return null
  }

  // Determine message and show retry button
  let message: string
  let showRetry = false
  let showSpinner = true

  switch (status) {
    case 'connecting':
      message = 'Připojování...'
      break
    case 'connected':
      // Connected but no data yet
      message = 'Čekání na data...'
      break
    case 'reconnecting':
      message = 'Obnovování spojení...'
      break
    case 'disconnected':
      message = 'Odpojeno'
      showRetry = true
      showSpinner = false
      break
    case 'error':
      message = error || 'Chyba připojení'
      showRetry = true
      showSpinner = false
      break
    default:
      message = 'Neznámý stav'
      showSpinner = false
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        {showSpinner && <div className={styles.spinner} />}
        <div className={styles.message}>{message}</div>
        {showRetry && onRetry && (
          <button className={styles.retryButton} onClick={onRetry}>
            Zkusit znovu
          </button>
        )}
      </div>
    </div>
  )
}

export default ConnectionStatus
