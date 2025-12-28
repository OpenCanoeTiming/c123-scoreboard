import type { ReactNode } from 'react'
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
  const { layoutMode, showFooter } = useLayout()

  return (
    <div
      className={styles.layout}
      data-layout-mode={layoutMode}
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
