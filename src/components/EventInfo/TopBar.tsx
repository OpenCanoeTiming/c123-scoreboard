import { useState, useCallback } from 'react'
import { useLayout } from '@/hooks'
import { DEFAULT_ASSETS } from '@/utils/assetStorage'
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

  // Track image load errors to fallback to defaults
  const [logoError, setLogoError] = useState(false)
  const [partnerLogoError, setPartnerLogoError] = useState(false)

  const handleLogoError = useCallback(() => {
    console.warn(`TopBar: Failed to load logo from ${logoUrl}, falling back to default`)
    setLogoError(true)
  }, [logoUrl])

  const handlePartnerLogoError = useCallback(() => {
    console.warn(`TopBar: Failed to load partner logo from ${partnerLogoUrl}, falling back to default`)
    setPartnerLogoError(true)
  }, [partnerLogoUrl])

  if (!visible) {
    return null
  }

  // Use fallback URL if error occurred or URL not provided
  const effectiveLogoUrl = logoError ? DEFAULT_ASSETS.logoUrl : (logoUrl || DEFAULT_ASSETS.logoUrl)
  const effectivePartnerLogoUrl = partnerLogoError ? DEFAULT_ASSETS.partnerLogoUrl : (partnerLogoUrl || DEFAULT_ASSETS.partnerLogoUrl)

  const layoutClass = layoutMode === 'ledwall' ? styles.ledwall : ''

  return (
    <div
      className={`${styles.topBar} ${layoutClass}`.trim()}
      data-testid="topbar"
      data-layout-mode={layoutMode}
    >
      <div className={styles.left}>
        <img
          src={effectiveLogoUrl}
          alt="Event logo"
          className={styles.logo}
          onError={handleLogoError}
        />
      </div>

      <div className={styles.right}>
        <img
          src={effectivePartnerLogoUrl}
          alt="Partner logo"
          className={styles.partnerLogo}
          onError={handlePartnerLogoError}
        />
      </div>
    </div>
  )
}

export default TopBar
