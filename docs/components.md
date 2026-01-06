# React Components Reference

Dokumentace klíčových React komponent pro budoucí úpravy.

---

## Přehled architektury

```
src/
├── App.tsx                    # Entry point, provider discovery
├── context/
│   └── ScoreboardContext.tsx  # Global state management
├── components/
│   ├── ResultsList/           # Results display + auto-scroll
│   ├── CurrentCompetitor/     # On-course competitor
│   ├── EventInfo/             # TopBar, Title
│   ├── Footer/                # Sponsor banner
│   ├── Layout/                # ScoreboardLayout wrapper
│   └── ...
└── hooks/
    ├── useLayout.ts           # Responsive layout detection
    ├── useAutoScroll.ts       # Auto-scroll state machine
    ├── useHighlight.ts        # Highlight timing
    └── useAssets.ts           # Asset URL resolution
```

---

## App.tsx

Entry point aplikace. Zodpovědný za:

1. **URL parametry** - parsování konfigurace (`getUrlParams()`)
2. **Provider discovery** - auto-discovery C123 serveru nebo fallback
3. **Render** - ScoreboardProvider + ScoreboardContent

### Provider discovery flow

```
1. source=replay? → ReplayProvider
2. server=host:port? → probe for C123 → C123ServerProvider or CLIProvider
3. Auto-discovery → scan network for C123 Server
4. Error screen
```

### Klíčové funkce

| Funkce | Účel |
|--------|------|
| `getUrlParams()` | Parsuje URL parametry |
| `createProvider()` | Vytváří provider podle konfigurace |
| `useProviderDiscovery()` | Hook pro discovery s loading state |
| `DiscoveryScreen` | Loading screen během discovery |
| `ErrorScreen` | Error screen při selhání |

### Použití

```tsx
// App automaticky detekuje a vytvoří provider
function App() {
  const urlParams = useMemo(() => getUrlParams(), [])
  const discoveryState = useProviderDiscovery(urlParams)

  if (discoveryState.status === 'discovering') {
    return <DiscoveryScreen />
  }

  return (
    <ScoreboardProvider provider={discoveryState.provider}>
      <ScoreboardContent />
    </ScoreboardProvider>
  )
}
```

---

## ScoreboardContext

Centrální state management pomocí React Context + useReducer.

### State interface

```typescript
interface ScoreboardState {
  // Connection
  status: ConnectionStatus  // 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  error: string | null
  initialDataReceived: boolean

  // Results
  results: Result[]
  raceName: string
  raceId: string

  // Active race tracking
  activeRaceId: string | null     // From on-course competitors
  lastActiveRaceId: string | null // For when no one is on course

  // Highlight
  highlightBib: string | null
  highlightTimestamp: number | null

  // On-course competitors
  currentCompetitor: OnCourseCompetitor | null
  onCourse: OnCourseCompetitor[]
  departingCompetitor: OnCourseCompetitor | null

  // Pending highlight (waits for results update)
  pendingHighlightBib: string | null
  pendingHighlightTimestamp: number | null

  // Visibility & Event info
  visibility: VisibilityState
  title: string
  dayTime: string
}
```

### Reducer actions

| Action | Účel |
|--------|------|
| `SET_STATUS` | Změna connection status |
| `SET_RESULTS` | Update výsledků + trigger highlight |
| `SET_ON_COURSE` | Update on-course + departing detection |
| `SET_VISIBILITY` | Visibility flags (always overridden to true) |
| `SET_EVENT_INFO` | Title, infoText, dayTime |
| `CLEAR_DEPARTING` | Clear departing competitor |
| `RESET_STATE` | Reset při reconnect |

### Race filtering logic

Context obsahuje důležitou logiku pro filtrování výsledků podle aktivní kategorie:

```typescript
// SET_RESULTS reducer
const targetRaceId = state.activeRaceId || state.lastActiveRaceId
if (targetRaceId && action.raceId && action.raceId !== targetRaceId) {
  // Ignore results for different race
  return state
}
```

Toto zajišťuje, že se nezobrazí výsledky jiné kategorie, když C123 rotuje všechny kategorie.

### Highlight trigger logic

Highlight se nespouští okamžitě při `dtFinish`, ale čeká na aktualizaci výsledků:

```typescript
// SET_ON_COURSE: detekuje dtFinish → nastaví pendingHighlightBib
// SET_RESULTS: pokud results obsahují pendingHighlightBib → trigger highlight
```

Toto řeší problém, kdy výsledky ještě neobsahují aktuální čas dojetí.

### Použití

```tsx
// V komponentách
function MyComponent() {
  const { results, currentCompetitor, status } = useScoreboard()
  // ...
}
```

---

## ResultsList

Zobrazuje scrollovatelný seznam výsledků.

### Props

```typescript
interface ResultsListProps {
  results: Result[]
  visible?: boolean
}
```

### Funkce

- **Alternating row colors** - sudé/liché řádky
- **Highlight styling** - yellow border pro dojetého závodníka
- **Auto-scroll** - via `useAutoScroll` hook
- **BR2 columns** - dva sloupce pro BR1/BR2 v vertical layout
- **Fixed height** - při použití `displayRows` URL parametru

### Layout differences

| Layout | Penalty | Behind | BR2 columns |
|--------|---------|--------|-------------|
| Vertical | Součást času | Viditelné | Ano |
| Ledwall | Samostatný sloupec | Skryté | Ne |
| Ledwall BR2 | Skryté | Skryté | Ne |

---

## ResultRow

Jednotlivý řádek ve výsledcích.

### Props

```typescript
interface ResultRowProps {
  result: Result
  isHighlighted?: boolean
  showPenalty?: boolean
  showBehind?: boolean
  layoutMode?: 'vertical' | 'ledwall'
  isBR2?: boolean
}
```

### BR2 merged display

Pro BR2 závody zobrazuje dva sloupce (BR1 a BR2):
- Lepší jízda je normální
- Horší jízda má `.worseRun` třídu (50% opacity)
- Penalizace za časem v malém badge

```tsx
// RunTimeCell komponenta
<span className={styles.runTime}>{run.total}</span>
{pen > 0 && <span className={styles.runPenaltyBadge}>+{pen}</span>}
```

### Status handling

```typescript
// DNS/DNF/DSQ zobrazení
if (hasExplicitStatus(result.status)) {
  return <div className={styles.statusIndicator}>{result.status}</div>
}
```

---

## CurrentCompetitor

Zobrazuje závodníka aktuálně na trati.

### Props

```typescript
interface CurrentCompetitorProps {
  competitor: OnCourseCompetitor | null
  visible?: boolean
  isDeparting?: boolean  // Visual distinction for departing
}
```

### Layout

Single-row layout:
```
► [BIB] [NAME] [GATE PENALTIES...] [TOTAL PEN] [TIME]
```

### Gate penalties

Pouze brány s penalizací (2s nebo 50s):
```tsx
const penaltyGates = getPenaltyGates(competitor.gates)
// Returns: [{ gateNumber: 5, penalty: 2 }, { gateNumber: 12, penalty: 50 }, ...]
```

### Visibility logic

```typescript
// Don't show if no competitor
if (!competitor) return null

// Don't show if not started (unless departing)
if (!isDeparting && !competitor.dtStart) return null
```

---

## TopBar

Horní lišta s logy.

### Props

```typescript
interface TopBarProps {
  visible?: boolean
  logoUrl?: string        // Event logo (left)
  partnerLogoUrl?: string // Partner logo (right)
}
```

### Fallback handling

```typescript
const [logoError, setLogoError] = useState(false)

const handleLogoError = useCallback(() => {
  console.warn(`TopBar: Failed to load logo from ${logoUrl}`)
  setLogoError(true)
}, [logoUrl])

const effectiveLogoUrl = logoError
  ? DEFAULT_ASSETS.logoUrl
  : (logoUrl || DEFAULT_ASSETS.logoUrl)
```

### Layout heights

| Layout | Height | Logo max-height |
|--------|--------|-----------------|
| Vertical | 100px | 80px |
| Ledwall | 60px | 55px |

---

## Footer

Spodní lišta se sponzorským bannerem.

### Props

```typescript
interface FooterProps {
  visible?: boolean
  imageUrl?: string
}
```

### Notes

- Automaticky skrytý na ledwall layout (handled by ScoreboardLayout)
- Fallback na default asset při chybě načtení

---

## Hooks

### useLayout

Responsive layout detection a konfigurace.

```typescript
interface LayoutConfig {
  layoutMode: 'vertical' | 'ledwall'
  viewportWidth: number
  viewportHeight: number
  visibleRows: number
  rowHeight: number
  showFooter: boolean
  disableScroll: boolean
  displayRows: number | null
  scaleFactor: number
  scrollToFinished: boolean
}
```

**Auto-detection:**
- `aspectRatio >= 1.5` → ledwall
- else → vertical

**URL overrides:** `?type=`, `?displayRows=`, `?disableScroll=`, `?scrollToFinished=`

### useAutoScroll

State machine pro auto-scroll výsledků.

**Phases:**
```
IDLE → WAITING → SCROLLING → PAUSED_AT_BOTTOM → RETURNING_TO_TOP → WAITING
                    ↓
              HIGHLIGHT_VIEW (when competitor finishes)
```

**Layout-specific timing:**

| Layout | Initial delay | Page interval | Bottom pause |
|--------|---------------|---------------|--------------|
| Vertical | 3s | 12s | 8s |
| Ledwall | 3s | 3s | 1.5s |

**Ledwall special:** Scroll pauses when competitor is actively running (has dtStart).

### useHighlight

Timestamp-based highlight expiration.

```typescript
interface UseHighlightReturn {
  highlightBib: string | null
  isActive: boolean
  timeRemaining: number
  progress: number  // 0-1
}
```

**Duration:** 5 seconds (from `HIGHLIGHT_DURATION` constant)

### useAssets

Asset URL resolution s fallback chain.

**Priority:**
1. localStorage (from ConfigPush)
2. URL params
3. Default assets (`/assets/logo.svg`, etc.)

```typescript
const assets = useAssets()
// { logoUrl, partnerLogoUrl, footerImageUrl }
```

---

## CSS Modules

Každá komponenta používá CSS module:
- `ResultsList.module.css`
- `CurrentCompetitor.module.css`
- `TopBar.module.css`
- `Footer.module.css`

### CSS Variables

Nastavované v `useLayout`:
```css
--row-height: 48px;        /* or 56px for ledwall */
--visible-rows: 10;
--header-height: 100px;    /* or 60px for ledwall */
--footer-height: 60px;     /* or 0 for ledwall */
--layout-mode: vertical;   /* or ledwall */

/* Font sizes per layout */
--result-rank-size: 32px;
--result-name-size: 32px;
--result-time-size: 32px;
/* etc. */
```

---

## Testing

Komponenty mají unit testy v `__tests__/` podadresářích:
- `ResultsList.test.tsx`
- `CurrentCompetitor.test.tsx`
- `ErrorBoundary.test.tsx`
- Snapshot testy v `__tests__/snapshots/`

### Test utilities

```typescript
import { render } from '@/test-utils'

// Wraps component with necessary providers
render(<ResultsList results={mockResults} />)
```

---

## Přidání nové komponenty

1. Vytvořit adresář `src/components/MyComponent/`
2. Přidat soubory:
   - `MyComponent.tsx`
   - `MyComponent.module.css`
   - `index.ts` (re-export)
   - `__tests__/MyComponent.test.tsx`
3. Export z `src/components/index.ts`
4. Použít v `App.tsx` nebo `ScoreboardContent`
