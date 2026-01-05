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
- Zpracování zpráv: `results`, `onCourse`, `xmlChange`
- REST API sync při reconnectu

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
