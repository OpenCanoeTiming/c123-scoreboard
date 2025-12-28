function App() {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-family-primary)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--spacing-lg)',
      }}
    >
      <h1 style={{ fontWeight: 700 }}>Canoe Scoreboard v2</h1>
      <p style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-secondary)' }}>
        1:23.45
      </p>
    </div>
  )
}

export default App
