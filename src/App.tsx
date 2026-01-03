import { useMemo, useState, useEffect } from 'react'
import { ScoreboardProvider, useScoreboard } from '@/context'
import { ReplayProvider } from '@/providers/ReplayProvider'
import { CLIProvider } from '@/providers/CLIProvider'
import { C123ServerProvider } from '@/providers/C123ServerProvider'
import type { DataProvider } from '@/providers/types'
import { useLayout } from '@/hooks'
import {
  discoverC123Server,
  isC123Server,
  normalizeServerUrl,
} from '@/providers/utils/discovery-client'
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
 * - server: string (C123 Server address, e.g., "192.168.1.50:27123")
 * - source: 'replay' (only for development/testing)
 * - speed: number (replay speed multiplier, default: 10)
 * - loop: 'true' | 'false' (replay loop, default: 'true')
 * - pauseAfter: number (pause playback after N messages, for testing)
 * - disableScroll: 'true' (disable auto-scroll, for screenshots)
 * - type: 'vertical' | 'ledwall' (layout mode, default: auto-detect)
 * - displayRows: number (fixed row count for ledwall scaling, min: 3, max: 20)
 */
function getUrlParams(): {
  server: string | null
  source: 'replay' | null
  speed: number
  loop: boolean
  pauseAfter: number | null
  disableScroll: boolean
} {
  const params = new URLSearchParams(window.location.search)

  const server = params.get('server')
  const sourceParam = params.get('source')
  const source: 'replay' | null = sourceParam === 'replay' ? 'replay' : null
  const speedParam = params.get('speed')
  const speed = speedParam ? parseFloat(speedParam) : 10.0
  const loop = params.get('loop') !== 'false'
  const pauseAfterParam = params.get('pauseAfter')
  const pauseAfter = pauseAfterParam ? parseInt(pauseAfterParam, 10) : null
  const disableScroll = params.get('disableScroll') === 'true'

  return { server, source, speed, loop, pauseAfter, disableScroll }
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
    initialDataReceived,
    title,
    raceName,
    dayTime,
    currentCompetitor,
    departingCompetitor,
    onCourse,
    results,
    visibility,
  } = useScoreboard()

  const { layoutMode } = useLayout()

  // Ledwall shows only one competitor, vertical shows all
  const showOnCourseDisplay = layoutMode === 'vertical'

  return (
    <>
      {/* Connection status overlay */}
      <ConnectionStatus
        status={status}
        initialDataReceived={initialDataReceived}
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

/**
 * Provider discovery states
 */
type DiscoveryState =
  | { status: 'discovering' }
  | { status: 'ready'; provider: DataProvider }
  | { status: 'error'; message: string }

/**
 * Create provider based on URL params and discovery
 *
 * Priority:
 * 1. source=replay -> ReplayProvider (development only)
 * 2. server=host:port -> probe, use C123ServerProvider if c123-server, else CLIProvider
 * 3. Auto-discovery -> scan network for C123 Server
 * 4. Error -> show manual configuration
 */
async function createProvider(urlParams: ReturnType<typeof getUrlParams>): Promise<DataProvider> {
  // 1. Replay mode (development/testing)
  if (urlParams.source === 'replay') {
    return new ReplayProvider('/recordings/rec-2025-12-28T09-34-10.jsonl', {
      speed: urlParams.speed,
      sources: ['ws', 'tcp'],
      autoPlay: true,
      loop: urlParams.loop,
      pauseAfter: urlParams.pauseAfter,
    })
  }

  // 2. Explicit server parameter
  if (urlParams.server) {
    const serverUrl = normalizeServerUrl(urlParams.server)

    // Probe to check if it's C123 Server
    if (await isC123Server(serverUrl)) {
      console.log('Using C123ServerProvider:', serverUrl)
      return new C123ServerProvider(serverUrl, {
        autoReconnect: true,
        initialReconnectDelay: 1000,
        maxReconnectDelay: 30000,
      })
    }

    // Fallback to CLI provider (server is not C123 Server)
    console.log('Falling back to CLIProvider:', urlParams.server)
    return new CLIProvider(urlParams.server, {
      autoReconnect: true,
      initialReconnectDelay: 1000,
      maxReconnectDelay: 30000,
    })
  }

  // 3. Auto-discovery
  console.log('Starting C123 Server discovery...')
  const discovered = await discoverC123Server({ ignoreUrlParam: true })

  if (discovered) {
    console.log('Discovered C123 Server:', discovered)
    return new C123ServerProvider(discovered, {
      autoReconnect: true,
      initialReconnectDelay: 1000,
      maxReconnectDelay: 30000,
    })
  }

  // 4. No server found
  throw new Error('No C123 Server found. Use ?server=host:port or ?source=replay')
}

/**
 * Hook for provider discovery with loading state
 */
function useProviderDiscovery(urlParams: ReturnType<typeof getUrlParams>): DiscoveryState {
  const [state, setState] = useState<DiscoveryState>({ status: 'discovering' })

  useEffect(() => {
    let cancelled = false

    async function discover() {
      try {
        const provider = await createProvider(urlParams)
        if (!cancelled) {
          setState({ status: 'ready', provider })
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          setState({ status: 'error', message })
        }
      }
    }

    discover()

    return () => {
      cancelled = true
    }
  }, [urlParams])

  return state
}

/**
 * Discovery loading screen
 */
function DiscoveryScreen() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#1a1a2e',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>
        Canoe Scoreboard
      </div>
      <div style={{ fontSize: '1rem', opacity: 0.7 }}>
        Searching for C123 Server...
      </div>
    </div>
  )
}

/**
 * Error screen when no server found
 */
function ErrorScreen({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#1a1a2e',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '1rem', color: '#ff6b6b' }}>
        Connection Error
      </div>
      <div style={{ fontSize: '1rem', opacity: 0.9, marginBottom: '2rem' }}>
        {message}
      </div>
      <div style={{ fontSize: '0.9rem', opacity: 0.6 }}>
        <p>Options:</p>
        <ul style={{ textAlign: 'left', listStyle: 'none', padding: 0 }}>
          <li>?server=192.168.1.50:27123 - Connect to C123 Server</li>
          <li>?server=192.168.1.50:8081 - Connect to CLI tool</li>
          <li>?source=replay - Use recorded data (development)</li>
        </ul>
      </div>
    </div>
  )
}

function App() {
  // Parse URL parameters for configuration
  const urlParams = useMemo(() => getUrlParams(), [])

  // Discover and create provider
  const discoveryState = useProviderDiscovery(urlParams)

  // Show loading screen during discovery
  if (discoveryState.status === 'discovering') {
    return <DiscoveryScreen />
  }

  // Show error screen if no server found
  if (discoveryState.status === 'error') {
    return <ErrorScreen message={discoveryState.message} />
  }

  return (
    <ScoreboardProvider provider={discoveryState.provider}>
      <ScoreboardContent />
    </ScoreboardProvider>
  )
}

export default App
