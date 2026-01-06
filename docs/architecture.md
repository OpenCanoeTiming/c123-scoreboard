# Architektura - Canoe Scoreboard V3

## Provider systém

Scoreboard používá abstraktní `DataProvider` interface s automatickým výběrem:

```
URL ?server=host:port
         │
         ▼
1. Probe server → /api/discover
    ├── ANO (C123 Server): C123ServerProvider (primární)
    └── NE: CLIProvider (fallback)

2. Pokud URL nezadáno:
    ├── localStorage cache
    ├── Autodiscover na síti
    └── Manuální konfigurace
```

---

## Data flow

```
C123 Server (WebSocket)          CLI (WebSocket)
         │                              │
         ▼                              ▼
  c123ServerMapper.ts            cliMapper.ts
         │                              │
         └──────────┬──────────────────┘
                    ▼
          ScoreboardContext (reducer)
                    │
                    ▼
         React komponenty (Results, OnCourse, Title...)
```

---

## Klíčové soubory

| Soubor | Účel |
|--------|------|
| `src/providers/C123ServerProvider.ts` | Primární provider - WebSocket k C123 Server |
| `src/providers/CLIProvider.ts` | Fallback provider - CLI |
| `src/providers/utils/c123ServerMapper.ts` | Mapování C123 → scoreboard typy |
| `src/providers/utils/discovery-client.ts` | Auto-discovery C123 serveru |
| `src/context/ScoreboardContext.tsx` | State management, flow logika |

---

## Detailní popis komponent

### C123ServerProvider

- Připojení přes WebSocket k C123 serveru
- Automatický reconnect s exponential backoff
- Zpracování zpráv: `Results`, `OnCourse`, `XmlChange`, `ConfigPush`, `ForceRefresh`
- REST API sync při reconnectu

### ConfigPush (server → client)

Server může pushovat konfiguraci klientovi:

```typescript
interface ConfigPushData {
  clientId?: string      // Přiřazení/změna identity klienta
  type?: 'vertical' | 'ledwall'
  displayRows?: number
  customTitle?: string
  scrollToFinished?: boolean  // Scroll na pozici závodníka po dojetí (default: true)
  logoUrl?: string       // Hlavní logo (relativní, absolutní, nebo data URI)
  partnerLogoUrl?: string // Partner logo (relativní, absolutní, nebo data URI)
  footerImageUrl?: string // Footer banner (relativní, absolutní, nebo data URI)
  // ...
}
```

**clientId flow:**
1. Server pošle `ConfigPush` s novým `clientId`
2. Klient aktualizuje URL param `?clientId=xxx`
3. Klient provede reload → připojí se s novým ID
4. Server uloží config pod novým klíčem

**Asset management flow:**
1. Server pošle `ConfigPush` s asset URL(s)
2. Klient validuje URL (musí být relativní, http/https, nebo data:image/...)
3. Klient uloží do localStorage (`csb-assets`)
4. Klient provede reload → `useAssets()` hook načte z localStorage

**Fallback chain pro assets:**
```
ConfigPush → localStorage → URL params (jen relativní/absolutní) → defaults
```

**Podporované formáty:**
- Relativní URL: `/assets/custom-logo.png`
- Absolutní URL: `https://example.com/logo.png`
- Data URI: `data:image/png;base64,...` (pouze přes ConfigPush, ne URL params!)

**Použití:**
- Pojmenování nového klienta (místo IP adresy)
- Přejmenování stávajícího klienta
- Přesun konfigurace mezi zařízeními
- Customizace log a bannerů bez rebuildů

**ClientState response:**
```typescript
{
  type: 'ClientState',
  data: {
    current: { clientId, type, displayRows, customTitle, scrollToFinished, logoUrl, partnerLogoUrl, footerImageUrl },
    version: '3.0.0',
    capabilities: ['configPush', 'forceRefresh', 'clientIdPush', 'scrollToFinished', 'assetManagement']
  }
}
```

### CLIProvider

- Fallback pro starší CLI protokol
- WebSocket komunikace
- Kompletní zpětná kompatibilita s V2

### ScoreboardContext

- Centrální state management (React Context + useReducer)
- Reducer akce: `SET_RESULTS`, `SET_ON_COURSE`, `SET_TITLE`, `SET_HIGHLIGHT`
- Grace period logika pro závodníky s dtFinish
- Filtrování Results podle activeRaceId

### Mappery

- **c123ServerMapper.ts**: Převod C123 zpráv na interní typy
  - Partial message detection (`total > competitors.length`)
  - Status mapping (DNS/DNF/DSQ)
  - Race name building

- **cliMapper.ts**: Převod CLI zpráv na interní typy

---

## BR1/BR2 merge systém

Zobrazení výsledků z obou jízd při Best Run závodech.

### raceUtils.ts

Utility funkce pro práci s race ID:

```typescript
// Detekce typu závodu
isBR2Race("K1M_ST_BR2_6")  // true - druhá jízda
isBR1Race("K1M_ST_BR1_6")  // true - první jízda
isBestRunRace(raceId)      // true pro BR1 i BR2

// Extrakce classId pro REST API
getClassId("K1M_ST_BR2_6") // "K1M_ST"

// Číslo jízdy
getRunNumber("K1M_ST_BR2_6") // 2

// Přepnutí mezi jízdami
getOtherRunRaceId("K1M_ST_BR1_6") // "K1M_ST_BR2_6"
```

**Race ID formát:** `{CLASS}_{COURSE}_{RUN}_{VERSION}`
- `K1M_ST_BR1_6` = K1 Men, Short Track, Best Run 1, verze 6
- `C2M_LT_BR2_3` = C2 Men, Long Track, Best Run 2, verze 3

### BR2Manager (br1br2Merger.ts)

Třída spravující merge BR1/BR2 dat:

```
┌─────────────────────┐
│    BR2Manager       │
├─────────────────────┤
│ - state: BR2MergeState
│ - api: C123ServerApi
├─────────────────────┤
│ processResults()    │ ← WebSocket Results
│ updateOnCoursePenalties() │ ← OnCourse data
│ dispose()           │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│   REST API fetch    │
│ /api/xml/races/:id  │
│   /results?merged   │
└─────────────────────┘
```

**Data flow:**

1. **Detekce BR2 závodu** - při změně `raceId` kontroluje `isBR2Race()`
2. **Fetch BR1 dat** - REST API volání s delay 500ms, pak refresh každých 30s
3. **Cache** - `Map<bib, {run1, run2}>` - ukládá data z REST API
4. **OnCourse penalties** - live penalizace s 10s grace period po dojetí
5. **Merge** - `mergeBR1CacheIntoBR2Results()` kombinuje cache + WebSocket

**Klíčový insight:**

```
WebSocket posílá:
- time = BR2 čas (bez penalizace)
- pen = penalizace LEPŠÍ jízdy (ne BR2!)
- total = NEJLEPŠÍ čas z obou jízd

Proto BR2 total = time + pen (z OnCourse nebo REST cache)
```

**Konstanty:**
- `INITIAL_FETCH_DELAY_MS = 500` - delay před prvním fetchem
- `DEBOUNCE_FETCH_MS = 1000` - debounce při Results zprávách
- `BR1_REFRESH_INTERVAL_MS = 30000` - periodický refresh cache
- `ONCOURSE_PENALTY_GRACE_MS = 10000` - grace period pro penalizace

---

## Interní typy

```typescript
// Závodník na trati
interface OnCourseCompetitor {
  bib: number;
  name: string;
  country?: string;
  club?: string;
  dtStart?: string;
  dtFinish?: string;
  raceId: string;
}

// Výsledek
interface Result {
  rank: number;
  bib: number;
  name: string;
  country?: string;
  club?: string;
  total: string;
  penalty: number;
  status?: 'DNS' | 'DNF' | 'DSQ';
}

// Scoreboard state
interface ScoreboardState {
  results: Result[];
  onCourse: OnCourseCompetitor[];
  current?: OnCourseCompetitor;
  highlightBib?: number;
  highlightTimestamp?: number;
  activeRaceId?: string;
  title?: string;
  raceName?: string;
  raceStatus?: string;
}
```
