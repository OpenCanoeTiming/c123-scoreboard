import styles from './Footer.module.css'

/**
 * Props for Footer component
 */
interface FooterProps {
  /** Whether the footer is visible */
  visible?: boolean
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
export function Footer({ visible = true }: FooterProps) {
  if (!visible) {
    return null
  }

  return (
    <div className={styles.footer}>
      <div className={styles.sponsorBanner}>
        {/* Sponsor logo/text placeholder */}
        <span className={styles.sponsorText}>Sponsor Banner</span>
      </div>
    </div>
  )
}

export default Footer
