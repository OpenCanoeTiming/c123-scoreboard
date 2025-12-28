import { useMemo } from 'react'
import { ScoreboardProvider } from '@/context'
import { ReplayProvider } from '@/providers/ReplayProvider'
import { DebugView } from '@/components/DebugView'

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
      <div
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-family-primary)',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 'var(--spacing-lg)',
        }}
      >
        <h1 style={{ fontWeight: 700, marginBottom: 'var(--spacing-md)' }}>
          Canoe Scoreboard v2
        </h1>
        <DebugView />
      </div>
    </ScoreboardProvider>
  )
}

export default App
