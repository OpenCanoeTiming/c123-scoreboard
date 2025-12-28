import { useLayout } from '@/hooks'
import styles from './TopBar.module.css'

/**
 * Props for TopBar component
 */
interface TopBarProps {
  /** Whether the component is visible */
  visible?: boolean
  /** Optional event logo URL */
  logoUrl?: string
  /** Optional partner/sponsor logo URL */
  partnerLogoUrl?: string
}

/**
 * TopBar component
 *
 * Displays the top bar with logo on left, partners on right.
 * Height adapts based on layout mode (100px vertical, 60px ledwall).
 *
 * Based on extracted styles from prototype:
 * - Vertical: height 100px, logo max-height 80px
 * - Ledwall: height 60px, logo max-height 55px
 *
 * @example
 * ```tsx
 * <TopBar
 *   visible={visibility.displayTopBar}
 *   logoUrl="/images/event-logo.png"
 *   partnerLogoUrl="/images/csk-logo.png"
 * />
 * ```
 */
export function TopBar({
  visible = true,
  logoUrl,
  partnerLogoUrl,
}: TopBarProps) {
  const { layoutMode } = useLayout()

  if (!visible) {
    return null
  }

  const layoutClass = layoutMode === 'ledwall' ? styles.ledwall : ''

  return (
    <div
      className={`${styles.topBar} ${layoutClass}`.trim()}
      data-testid="top-bar"
      data-layout-mode={layoutMode}
    >
      <div className={styles.left}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Event logo"
            className={styles.logo}
          />
        ) : (
          <div className={styles.logoPlaceholder}>Logo</div>
        )}
      </div>

      <div className={styles.right}>
        {partnerLogoUrl ? (
          <img
            src={partnerLogoUrl}
            alt="Partner logo"
            className={styles.partnerLogo}
          />
        ) : (
          <div className={styles.logoPlaceholder}>Partners</div>
        )}
      </div>
    </div>
  )
}

export default TopBar
