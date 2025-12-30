import type { ReactNode, CSSProperties } from 'react'
import { useLayout } from '@/hooks'
import styles from './ScoreboardLayout.module.css'

/**
 * Props for ScoreboardLayout component
 */
interface ScoreboardLayoutProps {
  /** Header section (TopBar, Title) */
  header?: ReactNode
  /** Main content (CurrentCompetitor, ResultsList) */
  children: ReactNode
  /** Footer section (sponsors) - hidden on ledwall */
  footer?: ReactNode
}

/**
 * ScoreboardLayout component
 *
 * Provides the main layout structure for the scoreboard with responsive
 * handling for vertical and ledwall modes.
 *
 * Structure:
 * - Header: TopBar and Title (height from CSS variable)
 * - Main: CurrentCompetitor and ResultsList (fills remaining space)
 * - Footer: Sponsors (hidden on ledwall)
 *
 * When displayRows URL parameter is used, the layout is scaled using
 * CSS transform to fill the viewport height with the specified number
 * of result rows.
 *
 * @example
 * ```tsx
 * <ScoreboardLayout
 *   header={<><TopBar /><Title /></>}
 *   footer={<Footer />}
 * >
 *   <CurrentCompetitor />
 *   <ResultsList />
 * </ScoreboardLayout>
 * ```
 */
export function ScoreboardLayout({
  header,
  children,
  footer,
}: ScoreboardLayoutProps) {
  const { layoutMode, showFooter, scaleFactor, displayRows, viewportWidth } = useLayout()

  // Apply scaling when displayRows is set
  const isScaled = displayRows !== null && scaleFactor !== 1.0
  const layoutStyle: CSSProperties = isScaled
    ? {
        transform: `scale(${scaleFactor})`,
        transformOrigin: 'top left',
        width: `${viewportWidth / scaleFactor}px`,
        height: 'auto',
        minHeight: 'auto',
        maxHeight: 'none',
      }
    : {}

  return (
    <div
      className={`${styles.layout} ${isScaled ? styles.scaled : ''}`}
      data-layout-mode={layoutMode}
      style={layoutStyle}
    >
      {header && (
        <header className={styles.header}>
          {header}
        </header>
      )}

      <main className={styles.main}>
        {children}
      </main>

      {showFooter && footer && (
        <footer className={styles.footer}>
          {footer}
        </footer>
      )}
    </div>
  )
}

export default ScoreboardLayout
