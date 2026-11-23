import { useBoardView } from '@/view/useBoardView'

/**
 * Debug component showing the BoardView the components render
 */
export function DebugView() {
  const view = useBoardView()
  const featured = view.featured

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-family-mono)',
        fontSize: '12px',
        padding: 'var(--spacing-md)',
        margin: 'var(--spacing-md)',
        borderRadius: '8px',
        maxHeight: '80vh',
        overflow: 'auto',
      }}
    >
      <h2 style={{ margin: '0 0 12px 0', fontFamily: 'var(--font-family-primary)' }}>
        Scoreboard Debug View
      </h2>

      <Section title="Connection">
        <Row label="Connection" value={view.connection} />
      </Section>

      <Section title="Title">
        <Row label="Event" value={view.title.event || 'N/A'} />
        <Row label="Category" value={view.title.category || 'N/A'} />
        <Row label="Run" value={view.title.run ?? 'N/A'} />
        <Row label="Day Time" value={view.dayTime || 'N/A'} />
      </Section>

      <Section title="Featured">
        {featured ? (
          <>
            <Row label="Bib" value={featured.bib} />
            <Row label="Name" value={featured.name} />
            <Row label="Time" value={featured.time} />
            <Row label="Pen" value={featured.penalty} />
            <Row
              label="Gates"
              value={featured.gatePenalties.map((g) => `${g.gate}:${g.kind}`).join(' ') || 'N/A'}
            />
            <Row label="Departing" value={featured.departing ? 'yes' : 'no'} />
          </>
        ) : (
          <div style={{ color: 'var(--color-text-secondary)' }}>No competitor on course</div>
        )}
      </Section>

      <Section title="Visibility">
        <Row label="Featured" value={view.visibility.featured ? 'ON' : 'OFF'} />
        <Row label="Results" value={view.visibility.results ? 'ON' : 'OFF'} />
        <Row label="Title" value={view.visibility.title ? 'ON' : 'OFF'} />
        <Row label="TopBar" value={view.visibility.topBar ? 'ON' : 'OFF'} />
        <Row label="Footer" value={view.visibility.footer ? 'ON' : 'OFF'} />
        <Row label="DayTime" value={view.visibility.dayTime ? 'ON' : 'OFF'} />
      </Section>

      <Section title={`Results (first 5 of ${view.rows.length})`}>
        {view.rows.slice(0, 5).map((r) => (
          <div key={r.bib} style={{ marginBottom: '4px' }}>
            {r.rank} [{r.bib}] {r.name} - {r.result.text}
            {r.highlighted ? ' (highlighted)' : ''}
            {r.provisional ? ' (provisional)' : ''}
          </div>
        ))}
        {view.rows.length === 0 && (
          <div style={{ color: 'var(--color-text-secondary)' }}>No results</div>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <h3
        style={{
          margin: '0 0 8px 0',
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--color-accent)',
          fontFamily: 'var(--font-family-primary)',
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '2px' }}>
      <span style={{ color: 'var(--color-text-secondary)', minWidth: '120px' }}>{label}:</span>
      <span>{value}</span>
    </div>
  )
}
