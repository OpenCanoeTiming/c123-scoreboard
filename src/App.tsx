import { useMemo } from 'react'
import { ScoreboardProvider, useScoreboard } from '@/context'
import { ReplayProvider } from '@/providers/ReplayProvider'
import { CLIProvider } from '@/providers/CLIProvider'
import type { DataProvider } from '@/providers/types'
import {
  ScoreboardLayout,
  TopBar,
  Title,
  CurrentCompetitor,
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
 */
function ScoreboardContent() {
  const {
    status,
    error,
    initialDataReceived,
    title,
    dayTime,
    currentCompetitor,
    departingCompetitor,
    results,
    visibility,
    reconnect,
  } = useScoreboard()

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
            <TopBar visible={visibility.displayTopBar} />
            <Title title={title} visible={visibility.displayTitle} />
          </>
        }
        footer={<Footer visible={visibility.displayFooter} />}
      >
        {/* Current competitor - shows departing if no current */}
        <ErrorBoundary componentName="CurrentCompetitor">
          <CurrentCompetitor
            competitor={currentCompetitor ?? departingCompetitor}
            visible={visibility.displayCurrent}
            isDeparting={!currentCompetitor && !!departingCompetitor}
          />
        </ErrorBoundary>

        {/* Results list */}
        <ErrorBoundary componentName="ResultsList">
          <ResultsList results={results} visible={visibility.displayTop} />
        </ErrorBoundary>

        {/* Day time display */}
        <TimeDisplay time={dayTime} visible={visibility.displayDayTime} />
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
      sources: ['ws'],
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
