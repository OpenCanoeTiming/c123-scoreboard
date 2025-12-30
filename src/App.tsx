import { useMemo } from 'react'
import { ScoreboardProvider, useScoreboard } from '@/context'
import { ReplayProvider } from '@/providers/ReplayProvider'
import { CLIProvider } from '@/providers/CLIProvider'
import type { DataProvider } from '@/providers/types'
import { useLayout } from '@/hooks'
import {
  ScoreboardLayout,
  TopBar,
  Title,
  CurrentCompetitor,
  OnCourseDisplay,
  ResultsList,
  TimeDisplay,
  Footer,
  ConnectionStatus,
  ErrorBoundary,
} from '@/components'

/**
 * Parse URL parameters for app configuration
 *
 * Supported parameters:
 * - source: 'replay' | 'cli' (default: 'replay')
 * - speed: number (replay speed multiplier, default: 10)
 * - host: string (CLI server address, default: '192.168.68.108:8081')
 * - loop: 'true' | 'false' (replay loop, default: 'true')
 * - pauseAfter: number (pause playback after N messages, for testing)
 * - disableScroll: 'true' (disable auto-scroll, for screenshots)
 * - type: 'vertical' | 'ledwall' (layout mode, default: auto-detect)
 * - displayRows: number (fixed row count for ledwall scaling, min: 3, max: 20)
 */
function getUrlParams(): {
  source: 'replay' | 'cli'
  speed: number
  host: string
  loop: boolean
  pauseAfter: number | null
  disableScroll: boolean
} {
  const params = new URLSearchParams(window.location.search)

  const source = params.get('source') === 'cli' ? 'cli' : 'replay'
  const speedParam = params.get('speed')
  const speed = speedParam ? parseFloat(speedParam) : 10.0
  const host = params.get('host') ?? '192.168.68.108:8081'
  const loop = params.get('loop') !== 'false'
  const pauseAfterParam = params.get('pauseAfter')
  const pauseAfter = pauseAfterParam ? parseInt(pauseAfterParam, 10) : null
  const disableScroll = params.get('disableScroll') === 'true'

  return { source, speed, host, loop, pauseAfter, disableScroll }
}

/**
 * Main scoreboard content - uses context for data
 *
 * Layout-specific behavior for multiple competitors on course:
 * - Ledwall: Shows only the primary competitor (highest time = current, or departing if just finished)
 * - Vertical: Shows all competitors on course (CurrentCompetitor + OnCourseDisplay for others)
 */
function ScoreboardContent() {
  const {
    status,
    error,
    initialDataReceived,
    title,
    raceName,
    dayTime,
    currentCompetitor,
    departingCompetitor,
    onCourse,
    results,
    visibility,
    reconnect,
  } = useScoreboard()

  const { layoutMode } = useLayout()

  // Ledwall shows only one competitor, vertical shows all
  const showOnCourseDisplay = layoutMode === 'vertical'

  return (
    <>
      {/* Connection status overlay */}
      <ConnectionStatus
        status={status}
        error={error}
        initialDataReceived={initialDataReceived}
        onRetry={reconnect}
      />

      <ScoreboardLayout
        header={
          <>
            <TopBar
              visible={visibility.displayTopBar}
              logoUrl="/assets/logo.svg"
              partnerLogoUrl="/assets/partners.png"
            />
            <TimeDisplay time={dayTime} visible={visibility.displayDayTime} />
            <Title title={title} raceName={raceName} visible={visibility.displayTitle} />
          </>
        }
        footer={<Footer visible={visibility.displayFooter} imageUrl="/assets/footer.png" />}
      >
        {/* Current competitor - shows departing if no current */}
        <ErrorBoundary componentName="CurrentCompetitor">
          <CurrentCompetitor
            competitor={currentCompetitor ?? departingCompetitor}
            visible={visibility.displayCurrent}
            isDeparting={!currentCompetitor && !!departingCompetitor}
          />
        </ErrorBoundary>

        {/* On-course competitors (excluding current) - only shown in vertical layout */}
        {showOnCourseDisplay && (
          <ErrorBoundary componentName="OnCourseDisplay">
            <OnCourseDisplay
              competitors={onCourse}
              visible={visibility.displayOnCourse}
              excludeBib={currentCompetitor?.bib}
            />
          </ErrorBoundary>
        )}

        {/* Results list */}
        <ErrorBoundary componentName="ResultsList">
          <ResultsList results={results} visible={visibility.displayTop} />
        </ErrorBoundary>
      </ScoreboardLayout>
    </>
  )
}

function App() {
  // Parse URL parameters for configuration
  const urlParams = useMemo(() => getUrlParams(), [])

  // Create DataProvider instance based on source parameter
  const provider = useMemo((): DataProvider => {
    if (urlParams.source === 'cli') {
      return new CLIProvider(urlParams.host, {
        autoReconnect: true,
        initialReconnectDelay: 1000,
        maxReconnectDelay: 30000,
      })
    }

    return new ReplayProvider('/recordings/rec-2025-12-28T09-34-10.jsonl', {
      speed: urlParams.speed,
      sources: ['ws', 'tcp'],
      autoPlay: true,
      loop: urlParams.loop,
      pauseAfter: urlParams.pauseAfter,
    })
  }, [urlParams])

  return (
    <ScoreboardProvider provider={provider}>
      <ScoreboardContent />
    </ScoreboardProvider>
  )
}

export default App
