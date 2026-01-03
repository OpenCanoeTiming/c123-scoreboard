# Implementační plán: Integrace C123 Server do Scoreboardu V3

## Shrnutí

Zjednodušení architektury - **zahodit starý C123Provider a proxy**, nový C123ServerProvider bude primární. CLI jako fallback.

---

## Nová logika připojení

```
1. URL parametr ?server=host:port zadán?
   └── ANO: Probe /api/discover
       └── service="c123-server"? → C123ServerProvider
       └── NE → fallback na CLIProvider (port 8081)
   └── NE: Auto-discovery C123 Server na síti
       └── Nalezen? → C123ServerProvider
       └── NE → zobrazit manuální konfiguraci

2. Zahodit:
   - source parametr (source=replay|cli|c123)
   - C123Provider.ts (raw TCP proxy)
   - scripts/c123-proxy.js
```

---

## Změny oproti V2

| Aspect | V2 | V3 |
|--------|-----|-----|
| Primární zdroj | CLI (port 8081) | **C123 Server (port 27123)** |
| Parametry | `?source=cli&host=...` | `?server=host:port` (volitelné) |
| Fallback | - | CLI provider |
| Raw C123 proxy | Ano (`c123-proxy.js`) | **SMAZAT** |
| Discovery | Ne | **Automaticky** |

---

## Nové soubory

### 1. `src/providers/utils/discovery-client.ts` (ZKOPÍROVAT)
**Zkopírovat z:** `../c123-server/docs/discovery-client.ts` (~500 řádků, hotová implementace!)

Obsahuje:
- `discoverC123Server()` - hlavní discovery funkce s caching
- `getWebSocketUrl()` - konverze HTTP → WS URL
- `isServerAlive()` - ověření dostupnosti serveru
- `getServerInfo()` - získání info (verze, event name)
- `normalizeServerUrl()` - normalizace URL

Discovery priorita:
1. URL param `?server=host:port`
2. localStorage cache (`c123-server-url`)
3. Subnet scan (200ms timeout, batch 20 IPs)

### 2. `src/types/c123server.ts` (~80 řádků)
Typy pro C123 Server zprávy:
```typescript
// Message envelope
interface C123ServerMessage { type: string; timestamp: string; data: unknown }

// Message types
interface C123OnCourseMessage { type: 'OnCourse'; data: { total: number; competitors: C123Competitor[] } }
interface C123ResultsMessage { type: 'Results'; data: { raceId: string; isCurrent: boolean; rows: C123Row[] } }
interface C123TimeOfDayMessage { type: 'TimeOfDay'; data: { time: string } }
interface C123ConnectedMessage { type: 'Connected'; data: { version: string; c123Connected: boolean } }
```

### 3. `src/providers/utils/c123ServerMapper.ts` (~120 řádků)
Mapovací funkce C123 Server → scoreboard typy:
- `mapOnCourse(data) → OnCourseData`
- `mapResults(data) → ResultsData`
- `mapTimeOfDay(data) → EventInfoData`
- `mapRaceConfig(data) → RaceConfig`

### 4. `src/providers/utils/c123ServerApi.ts` (~100 řádků)
REST API klient:
```typescript
class C123ServerApi {
  getMergedResults(raceId: string): Promise<MergedResults>
  getSchedule(): Promise<Schedule>
  getStatus(): Promise<ServerStatus>
}
```

### 5. `src/providers/C123ServerProvider.ts` (~280 řádků)
Hlavní provider implementující `DataProvider` interface:
- WebSocket připojení k `/ws`
- JSON message routing
- REST API sync po reconnect
- XmlChange handling

---

## Modifikace existujících souborů

### `src/App.tsx` - PŘEPSAT
Nová logika:
```typescript
// URL params - ZJEDNODUŠENÍ
const serverParam = params.get('server')  // volitelné: host:port

// Provider logic
async function createProvider(): Promise<DataProvider> {
  if (serverParam) {
    // Probe zadaný server
    const url = normalizeServerUrl(serverParam)
    if (await isC123Server(url)) {
      return new C123ServerProvider(url)
    }
    // Fallback na CLI
    return new CLIProvider(serverParam)
  }

  // Auto-discovery
  const discovered = await discoverC123Server()
  if (discovered) {
    return new C123ServerProvider(discovered)
  }

  // Žádný server nenalezen - zobrazit konfiguraci
  throw new Error('No server found')
}
```

---

## Soubory ke smazání

- `src/providers/C123Provider.ts` - starý raw TCP proxy provider
- `scripts/c123-proxy.js` - TCP→WS proxy script

---

## Klíčové rozdíly v datech

### OnCourse
| C123 Server | Scoreboard typ |
|-------------|----------------|
| `time: "81.15"` (string, sekundy) | `time: string` ✓ |
| `dtFinish: null \| "16:14:51.200"` | `dtFinish: string \| null` ✓ |
| `position: 1` (closest to finish) | (nepoužíváno - máme dtStart) |
| `pen: 54` (number) | `pen: number` ✓ |

### Results
| C123 Server | Scoreboard typ |
|-------------|----------------|
| `isCurrent: true/false` | `raceStatus: "3"/"5"` (mapovat) |
| `rows: [...]` | `results: [...]` |
| **Bez highlightBib** | `highlightBib: null` (detekce přes dtFinish) |

---

## Implementační bloky

### Blok 1: Discovery + Typy (~35% kontextu) ✅ HOTOVO
**Soubory:**
- ✅ ZKOPÍROVÁNO: `../c123-server/docs/discovery-client.ts` → `src/providers/utils/discovery-client.ts`
- ✅ NOVÝ: `src/types/c123server.ts`
- ✅ UPRAVEN: `src/types/index.ts` (přidány exporty)
**Commit:** `feat: add C123 Server discovery client and message types` (NECOMMITOVÁNO)

### Blok 2: Mapper + REST API klient (~40% kontextu)
**Soubory:**
- NOVÝ: `src/providers/utils/c123ServerMapper.ts`
- NOVÝ: `src/providers/utils/c123ServerApi.ts`
**Commit:** `feat: add C123 Server mappers and REST API client`

### Blok 3: C123ServerProvider + App.tsx (~60% kontextu)
**Soubory:**
- NOVÝ: `src/providers/C123ServerProvider.ts`
- PŘEPSAT: `src/App.tsx` (nová logika: discovery → C123Server / fallback CLI)
- SMAZAT: `src/providers/C123Provider.ts`
- SMAZAT: `scripts/c123-proxy.js`
**Commit:** `feat: add C123ServerProvider, refactor App.tsx, remove old C123Provider`

### Blok 4: Manuální testování
**Akce:**
- Spustit c123-server na stejných datech jako V2
- Porovnat chování (results, scroll, highlight) s V2
- Opravit případné rozdíly
**Commit:** `fix: align C123ServerProvider behavior with V2`

### Blok 5: REST sync a XmlChange (PO OVĚŘENÍ)
**Soubory:** `src/providers/C123ServerProvider.ts` (update)
**Commit:** `feat: add REST API sync and XmlChange handling`

### Blok 6: Testy (~30% kontextu)
**Soubory:**
- `src/providers/__tests__/C123ServerProvider.test.ts`
- `src/providers/__tests__/c123ServerMapper.test.ts`
- SMAZAT: `src/providers/__tests__/C123Provider.test.ts`
**Commit:** `test: add C123 Server integration tests`

---

## Reconnect a Error handling

```typescript
// Exponential backoff (stejné jako CLIProvider)
initialDelay: 1000ms → 2s → 4s → 8s → 16s → 30s (max)

// Po reconnect:
1. Reset finish detector state
2. Volat REST API pro sync (schedule, current race results)
```

---

## Testování

1. Unit testy pro mapper funkce
2. Unit testy pro REST API klient (mock fetch)
3. Integration testy pro provider (mock WebSocket)
4. **Manuální testování proti c123-server:**
   ```bash
   # Terminal 1: Spustit c123-server
   cd ../c123-server && npm start

   # Terminal 2: Spustit scoreboard
   npm run dev
   # Otevřít: http://localhost:5173/?server=localhost:27123
   ```

---

## Reference soubory

| Soubor | Účel |
|--------|------|
| `c123-server/docs/discovery-client.ts` | **ZKOPÍROVAT** - hotová discovery implementace |
| `c123-server/docs/INTEGRATION.md` | Kompletní integrace guide |
| `c123-server/docs/C123-PROTOCOL.md` | JSON formát zpráv |
| `c123-server/docs/REST-API.md` | REST API reference |
| `src/providers/CLIProvider.ts` | Vzor struktury, reconnect, CallbackManager |
| `src/providers/utils/CallbackManager.ts` | Callback management |
| `src/context/ScoreboardContext.tsx:158-185` | Finish detection logika |

---

## Rozhodnutí

1. **Zahodit source parametr** - místo toho jen `?server=host:port` (volitelné)
2. **Zahodit C123Provider** a `c123-proxy.js` - nepotřebné
3. **Primární:** C123ServerProvider, **Fallback:** CLIProvider
4. **BR1/BR2 merge:** Implementovat AŽ PO ověření základního chování (results, scroll, highlight)

---

## Fáze implementace

### Fáze A: Základní funkčnost (priority)
- WebSocket připojení k C123 Server
- Zpracování OnCourse, Results, TimeOfDay zpráv
- Správné zobrazení results, scroll, highlight dojetého závodníka
- Auto-discovery + fallback na CLI
- **Manuální ověření uživatelem** proti V2 na stejných datech

### Fáze B: Rozšíření (po ověření Fáze A)
- REST API pro merged BR1/BR2 (ujasníme detaily)
- XmlChange handling
- Sync po reconnect

---

## Poznámky

- Finish detection funguje stejně (dtFinish tracking v ScoreboardContext)
- ReplayProvider **jen pro unit/e2e testy**, ne pro běžné použití (odebrat z App.tsx)
- CLI provider jako fallback když server není c123-server
