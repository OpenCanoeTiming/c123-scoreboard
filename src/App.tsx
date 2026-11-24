import { useMemo, useState, useEffect, type ReactNode } from 'react'
import { ScoreboardProvider } from '@/context'
import { ReplayProvider } from '@/providers/ReplayProvider'
import { useLayout } from '@/hooks/useLayout'
import { useAssets } from '@/hooks/useAssets'
import { discoverC123Server, normalizeServerUrl } from '@/providers/utils/discovery-client'
import { ScoreboardLayout } from '@/components/Layout'
import { TopBar, Title } from '@/components/EventInfo'
import { CurrentCompetitor } from '@/components/CurrentCompetitor'
import { ResultsList } from '@/components/ResultsList'
import { TimeDisplay } from '@/components/TimeDisplay'
import { Footer } from '@/components/Footer'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { BoardViewContext, useBoardView } from '@/view/useBoardView'
import { useLegacyBoardView } from '@/view/legacyAdapter'
import { BoardProvider, LiveBoardProvider } from '@/view/BoardProvider'
import { useFixtureStore } from '@/fixture/FixtureSource'
import { productionClock } from '@/clock/productionClock'
import { ClockProvider, useClock } from '@/clock/clockContext'
import { browserSocket, type FetchLike } from '@/transport/transport'
import { browserClientSocket, browserPage, startClientChannel } from '@/config/clientChannel'
import { APP_VERSION } from '@/version'
import styles from './App.module.css'

/**
 * Parse URL parameters for app configuration
 *
 * Supported parameters:
 * - server: string (C123 Server address, e.g., "192.168.1.50:27123"); without it the board discovers the server
 * - source: 'replay' (the legacy recording; only the feed of the CI e2e job until #167)
 * - source: 'fixture' with fixture: <id> (a synthetic fixture through the store; development/testing)
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
 * - category: string (fix scoreboard to specific class, e.g., "K1M")
 */
function getUrlParams(): {
  server: string | null
  source: 'replay' | 'fixture' | null
  fixture: string | null
  speed: number
  loop: boolean
  pauseAfter: number | null
  disableScroll: boolean
  category: string | null
} {
  const params = new URLSearchParams(window.location.search)

  const server = params.get('server')
  const sourceParam = params.get('source')
  const source: 'replay' | 'fixture' | null =
    sourceParam === 'replay' || sourceParam === 'fixture' ? sourceParam : null
  const fixture = params.get('fixture')
  const speedParam = params.get('speed')
  const speed = speedParam ? parseFloat(speedParam) : 10.0
  const loop = params.get('loop') !== 'false'
  const pauseAfterParam = params.get('pauseAfter')
  const pauseAfter = pauseAfterParam ? parseInt(pauseAfterParam, 10) : null
  const disableScroll = params.get('disableScroll') === 'true'
  const category = params.get('category')

  return { server, source, fixture, speed, loop, pauseAfter, disableScroll, category }
}

/**
 * Provides the BoardView built from the legacy scoreboard context.
 * Temporary bridge until the new producer replaces it (#158, #168).
 */
function LegacyBoardViewBridge({ children }: { children: ReactNode }) {
  const view = useLegacyBoardView()
  return <BoardViewContext.Provider value={view}>{children}</BoardViewContext.Provider>
}

/**
 * Main scoreboard content - renders the BoardView
 *
 * Layout-specific behavior for multiple competitors on course:
 * - Both layouts now show only the primary competitor (highest time = current, or departing if just finished)
 * - OnCourseDisplay is no longer shown (simplified display)
 */
export function ScoreboardContent() {
  const view = useBoardView()
  const { visibility } = view

  const { layoutMode } = useLayout()
  const assets = useAssets()

  return (
    <>
      {/* Connection status overlay */}
      <ConnectionStatus connection={view.connection} />

      <ScoreboardLayout
        header={
          <>
            <TopBar
              visible={visibility.topBar}
              logoUrl={assets.logoUrl}
              partnerLogoUrl={assets.partnerLogoUrl}
            />
            {/* TimeDisplay only in vertical layout */}
            {layoutMode !== 'ledwall' && (
              <TimeDisplay time={view.dayTime} visible={visibility.dayTime} />
            )}
            <Title title={view.title} visible={visibility.title} />
          </>
        }
        footer={<Footer visible={visibility.footer} imageUrl={assets.footerImageUrl} />}
      >
        {/* Featured on-course row (the producer picks who is featured) */}
        <ErrorBoundary componentName="CurrentCompetitor">
          <CurrentCompetitor competitor={view.featured} visible={visibility.featured} />
        </ErrorBoundary>


        {/* Results list */}
        <ErrorBoundary componentName="ResultsList">
          <ResultsList rows={view.rows} visible={visibility.results} scroll={view.resultsScroll} />
        </ErrorBoundary>
      </ScoreboardLayout>
    </>
  )
}

/** Where the live board finds the server: `?server=` as given, else discovery. */
type ServerState =
  | { status: 'discovering' }
  | { status: 'ready'; url: string }
  | { status: 'error'; message: string }

function useServerUrl(server: string | null): ServerState {
  const [discovered, setDiscovered] = useState<ServerState>({ status: 'discovering' })

  useEffect(() => {
    if (server) return
    let cancelled = false
    discoverC123Server({ ignoreUrlParam: true }).then((url) => {
      if (cancelled) return
      setDiscovered(
        url
          ? { status: 'ready', url }
          : { status: 'error', message: 'No C123 Server found. Use ?server=host:port' }
      )
    })
    return () => {
      cancelled = true
    }
  }, [server])

  return server ? { status: 'ready', url: normalizeServerUrl(server) } : discovered
}

/**
 * Discovery loading screen - styled as basic scoreboard layout
 */
function DiscoveryScreen() {
  return (
    <div className={styles.screenContainer}>
      <header className={styles.header}>
        <img
          src="assets/logo.svg"
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
          src="assets/logo.svg"
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
          <div className={styles.helpItem}>• ?source=replay - Testovací data</div>
        </div>
      </main>

      <footer className={styles.footer} />
    </div>
  )
}

/**
 * `?source=fixture&fixture=<id>`: the fixture through the store and the view-model (#158)
 */
function FixtureApp({ id, category }: { id: string; category: string | null }) {
  const clock = useClock()
  const fixture = useFixtureStore(id, clock)

  if (fixture.status === 'loading') {
    return <DiscoveryScreen />
  }
  if (fixture.status === 'error') {
    return <ErrorScreen message={fixture.message} />
  }
  return (
    <BoardProvider store={fixture.state} clock={clock} connection="live" category={category}>
      <ScoreboardContent />
    </BoardProvider>
  )
}

function App() {
  return (
    <ClockProvider clock={productionClock}>
      <AppRoot />
    </ClockProvider>
  )
}

function AppRoot() {
  // Parse URL parameters for configuration
  const urlParams = useMemo(() => getUrlParams(), [])

  if (urlParams.source === 'fixture') {
    return <FixtureApp id={urlParams.fixture ?? ''} category={urlParams.category} />
  }
  if (urlParams.source === 'replay') {
    return <ReplayApp urlParams={urlParams} />
  }
  return <LiveApp urlParams={urlParams} />
}

const browserFetch: FetchLike = (url) => fetch(url)

/** The board on the new server: transport -> store -> view-model, and the client channel on `/ws/client`. */
function LiveApp({ urlParams }: { urlParams: ReturnType<typeof getUrlParams> }) {
  const clock = useClock()
  const server = useServerUrl(urlParams.server)
  const serverUrl = server.status === 'ready' ? server.url : null

  useEffect(() => {
    if (!serverUrl) return
    return startClientChannel({ serverUrl, openSocket: browserClientSocket, clock, page: browserPage, version: APP_VERSION })
  }, [serverUrl, clock])

  if (server.status === 'discovering') {
    return <DiscoveryScreen />
  }
  if (server.status === 'error') {
    return <ErrorScreen message={server.message} />
  }
  return (
    <LiveBoardProvider
      serverUrl={server.url}
      fetch={browserFetch}
      openSocket={browserSocket}
      clock={clock}
      category={urlParams.category}
    >
      <ScoreboardContent />
    </LiveBoardProvider>
  )
}

/** `?source=replay`: the legacy recording through the legacy reducer, kept only as the CI e2e feed (#152). */
function ReplayApp({ urlParams }: { urlParams: ReturnType<typeof getUrlParams> }) {
  const [provider] = useState(
    () =>
      new ReplayProvider('recordings/rec-2025-12-28T09-34-10.jsonl', {
        speed: urlParams.speed,
        sources: ['ws', 'tcp'],
        autoPlay: true,
        loop: urlParams.loop,
        pauseAfter: urlParams.pauseAfter,
      })
  )

  return (
    <ScoreboardProvider provider={provider} fixedCategory={urlParams.category ?? undefined}>
      <LegacyBoardViewBridge>
        <ScoreboardContent />
      </LegacyBoardViewBridge>
    </ScoreboardProvider>
  )
}

export default App
