import { useState, useCallback } from 'react'
import { DEFAULT_ASSETS } from '@/utils/assetStorage'
import styles from './Footer.module.css'

/**
 * Props for Footer component
 */
interface FooterProps {
  /** Whether the footer is visible */
  visible?: boolean
  /** Optional sponsor banner image URL */
  imageUrl?: string
}

/**
 * Footer component
 *
 * Displays sponsor banner at the bottom of the scoreboard.
 * Automatically hidden on ledwall layout (handled by ScoreboardLayout).
 *
 * @example
 * ```tsx
 * <Footer visible={visibility.displayFooter} />
 * ```
 */
export function Footer({ visible = true, imageUrl }: FooterProps) {
  // Track image load error to fallback to default
  const [imageError, setImageError] = useState(false)

  const handleImageError = useCallback(() => {
    console.warn(`Footer: Failed to load image from ${imageUrl}, falling back to default`)
    setImageError(true)
  }, [imageUrl])

  if (!visible) {
    return null
  }

  // Use fallback URL if error occurred or URL not provided
  const effectiveImageUrl = imageError ? DEFAULT_ASSETS.footerImageUrl : (imageUrl || DEFAULT_ASSETS.footerImageUrl)

  return (
    <div className={styles.footer} data-testid="footer">
      <div className={styles.sponsorBanner}>
        <img
          src={effectiveImageUrl}
          alt="Sponsor banner"
          className={styles.sponsorImage}
          onError={handleImageError}
        />
      </div>
    </div>
  )
}

export default Footer
