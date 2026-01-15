import { useMemo, useState, useEffect } from 'react'
import { ScoreboardProvider, useScoreboard } from '@/context'
import { ReplayProvider } from '@/providers/ReplayProvider'
import { CLIProvider } from '@/providers/CLIProvider'
import { C123ServerProvider } from '@/providers/C123ServerProvider'
import type { DataProvider } from '@/providers/types'
import { useLayout } from '@/hooks/useLayout'
import { useAssets } from '@/hooks/useAssets'
import {
  discoverC123Server,
  isC123Server,
  normalizeServerUrl,
  PROBE_TIMEOUT,
} from '@/providers/utils/discovery-client'
import { ScoreboardLayout } from '@/components/Layout'
import { TopBar, Title } from '@/components/EventInfo'
import { CurrentCompetitor } from '@/components/CurrentCompetitor'
import { ResultsList } from '@/components/ResultsList'
import { TimeDisplay } from '@/components/TimeDisplay'
import { Footer } from '@/components/Footer'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import styles from './App.module.css'

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
 * - scrollToFinished: 'true' | 'false' (scroll to finished competitor, default: 'true')
 * - logoUrl: string (main logo URL, relative or absolute - no data URIs via URL)
 * - partnerLogoUrl: string (partner logo URL, relative or absolute)
 * - footerImageUrl: string (footer banner URL, relative or absolute)
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
 * - Both layouts now show only the primary competitor (highest time = current, or departing if just finished)
 * - OnCourseDisplay is no longer shown (simplified display)
 */
function ScoreboardContent() {
  const {
    status,
    initialDataReceived,
    title,
    raceName,
    raceId,
    dayTime,
    currentCompetitor,
    departingCompetitor,
    results,
    visibility,
  } = useScoreboard()

  const { layoutMode } = useLayout()
  const assets = useAssets()

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
              logoUrl={assets.logoUrl}
              partnerLogoUrl={assets.partnerLogoUrl}
            />
            {/* TimeDisplay only in vertical layout */}
            {layoutMode !== 'ledwall' && (
              <TimeDisplay time={dayTime} visible={visibility.displayDayTime} />
            )}
            <Title title={title} raceName={raceName} raceId={raceId} visible={visibility.displayTitle} />
          </>
        }
        footer={<Footer visible={visibility.displayFooter} imageUrl={assets.footerImageUrl} />}
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

  // 2. Explicit server parameter (URL has highest priority)
  if (urlParams.server) {
    const serverUrl = normalizeServerUrl(urlParams.server)

    // Probe to check if it's C123 Server (with longer timeout)
    if (await isC123Server(serverUrl, PROBE_TIMEOUT)) {
      console.log('Using C123ServerProvider:', serverUrl)
      return new C123ServerProvider(serverUrl, {
        autoReconnect: true,
        initialReconnectDelay: 1000,
        maxReconnectDelay: 30000,
      })
    }

    // Check if server responds at all (any HTTP response)
    // If not, throw error - don't fallback to CLI for unreachable server
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT)
      const response = await fetch(`${serverUrl}/api/discover`, {
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit',
      }).catch(() => null)
      clearTimeout(timeoutId)

      if (!response) {
        // Server doesn't respond at all - throw error
        throw new Error(`Server ${serverUrl} is not reachable`)
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('not reachable')) {
        throw err
      }
      // Other error - server might be reachable but not C123 server
    }

    // Fallback to CLI provider (server responds but is not C123 Server)
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
 * Discovery loading screen - styled as basic scoreboard layout
 */
function DiscoveryScreen() {
  return (
    <div className={styles.screenContainer}>
      <header className={styles.header}>
        <img
          src="/assets/logo.svg"
          alt="Logo"
          className={styles.headerLogo}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      </header>

      <main className={styles.main}>
        <div className={styles.spinner} />
        <div className={styles.discoveryTitle}>
          Hledám výsledkový systém...
        </div>
        <div className={styles.discoverySubtitle}>
          Prohledávám síť pro C123 Server
        </div>
      </main>

      <footer className={styles.footer} />
    </div>
  )
}

/**
 * Error screen when no server found - styled as basic scoreboard layout
 */
function ErrorScreen({ message }: { message: string }) {
  return (
    <div className={styles.screenContainer}>
      <header className={styles.header}>
        <img
          src="/assets/logo.svg"
          alt="Logo"
          className={styles.headerLogo}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      </header>

      <main className={styles.errorMain}>
        <div className={styles.errorIcon}>⚠</div>
        <div className={styles.errorTitle}>Chyba připojení</div>
        <div className={styles.errorMessage}>{message}</div>

        <div className={styles.helpBox}>
          <div className={styles.helpTitle}>Možnosti:</div>
          <div className={styles.helpItem}>• ?server=192.168.1.50:27123 - C123 Server</div>
          <div className={styles.helpItem}>• ?server=192.168.1.50:8081 - CLI nástroj</div>
          <div className={styles.helpItem}>• ?source=replay - Testovací data</div>
        </div>
      </main>

      <footer className={styles.footer} />
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
