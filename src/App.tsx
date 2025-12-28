import { useMemo } from 'react'
import { ScoreboardProvider, useScoreboard } from '@/context'
import { ReplayProvider } from '@/providers/ReplayProvider'
import {
  ScoreboardLayout,
  TopBar,
  Title,
  CurrentCompetitor,
  ResultsList,
  TimeDisplay,
  Footer,
  ConnectionStatus,
} from '@/components'

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
        <CurrentCompetitor
          competitor={currentCompetitor ?? departingCompetitor}
          visible={visibility.displayCurrent}
          isDeparting={!currentCompetitor && !!departingCompetitor}
        />

        {/* Results list */}
        <ResultsList results={results} visible={visibility.displayTop} />

        {/* Day time display */}
        <TimeDisplay time={dayTime} visible={visibility.displayDayTime} />
      </ScoreboardLayout>
    </>
  )
}

function App() {
  // Create ReplayProvider instance - in development, use recording
  const provider = useMemo(() => {
    return new ReplayProvider('/recordings/rec-2025-12-28T09-34-10.jsonl', {
      speed: 10.0, // 10x speed for faster testing
      sources: ['ws'],
      autoPlay: true,
      loop: true,
    })
  }, [])

  return (
    <ScoreboardProvider provider={provider}>
      <ScoreboardContent />
    </ScoreboardProvider>
  )
}

export default App
