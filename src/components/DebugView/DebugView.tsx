import { useScoreboard } from '@/context'

/**
 * Debug component showing raw scoreboard state
 * Used for development and testing ScoreboardContext
 */
export function DebugView() {
  const state = useScoreboard()

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
        <Row label="Status" value={state.status} />
        <Row label="Error" value={state.error || 'none'} />
        <Row label="Initial Data" value={state.initialDataReceived ? 'yes' : 'no'} />
      </Section>

      <Section title="Race Info">
        <Row label="Race Name" value={state.raceName || 'N/A'} />
        <Row label="Status" value={state.raceStatus || 'N/A'} />
        <Row label="Highlight Bib" value={state.highlightBib || 'none'} />
        <Row label="Results Count" value={String(state.results.length)} />
      </Section>

      <Section title="Current Competitor">
        {state.currentCompetitor ? (
          <>
            <Row label="Bib" value={state.currentCompetitor.bib} />
            <Row label="Name" value={state.currentCompetitor.name} />
            <Row label="Club" value={state.currentCompetitor.club} />
            <Row label="Time" value={state.currentCompetitor.time} />
            <Row label="Total" value={state.currentCompetitor.total} />
            <Row label="Pen" value={String(state.currentCompetitor.pen)} />
            <Row label="TTB Diff" value={state.currentCompetitor.ttbDiff || 'N/A'} />
            <Row label="Gates" value={state.currentCompetitor.gates || 'N/A'} />
          </>
        ) : (
          <div style={{ color: 'var(--color-text-secondary)' }}>No competitor on course</div>
        )}
      </Section>

      <Section title="On Course">
        <Row label="Count" value={String(state.onCourse.length)} />
        {state.onCourse.map((c, i) => (
          <div key={c.bib} style={{ marginLeft: '12px' }}>
            [{i}] Bib {c.bib}: {c.name}
          </div>
        ))}
      </Section>

      <Section title="Event Info">
        <Row label="Title" value={state.title || 'N/A'} />
        <Row label="Info Text" value={state.infoText || 'N/A'} />
        <Row label="Day Time" value={state.dayTime || 'N/A'} />
      </Section>

      <Section title="Visibility">
        <Row label="Current" value={state.visibility.displayCurrent ? 'ON' : 'OFF'} />
        <Row label="Top" value={state.visibility.displayTop ? 'ON' : 'OFF'} />
        <Row label="Title" value={state.visibility.displayTitle ? 'ON' : 'OFF'} />
        <Row label="TopBar" value={state.visibility.displayTopBar ? 'ON' : 'OFF'} />
        <Row label="Footer" value={state.visibility.displayFooter ? 'ON' : 'OFF'} />
        <Row label="DayTime" value={state.visibility.displayDayTime ? 'ON' : 'OFF'} />
        <Row label="OnCourse" value={state.visibility.displayOnCourse ? 'ON' : 'OFF'} />
      </Section>

      <Section title="Results (first 5)">
        {state.results.slice(0, 5).map((r) => (
          <div key={r.bib} style={{ marginBottom: '4px' }}>
            {r.rank}. [{r.bib}] {r.name} - {r.total}
          </div>
        ))}
        {state.results.length === 0 && (
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
