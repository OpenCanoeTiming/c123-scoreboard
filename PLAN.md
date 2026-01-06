# Implementační plán: Canoe Scoreboard V3

## Stav projektu

| Fáze | Status |
|------|--------|
| Fáze A-E: Základní funkčnost, testy, opravy | ✅ Hotovo |
| Fáze F: Vylepšení a integrace s C123 | ✅ Hotovo (2026-01-06) |
| Fáze G: BR1/BR2 merge zobrazení | ✅ Hotovo (2026-01-05/06) |
| Fáze H: OnCourse vylepšení a scrollToFinished | ✅ Hotovo (2026-01-06) |
| Fáze I: Server-assigned clientId persistence | ✅ Hotovo (2026-01-06) |

---

## Fáze F - Vylepšení a integrace s C123 serverem

### Cíl

Dokončení integrace s C123 serverem (remote config, force refresh), vizuální vylepšení a asset management.

---

### Blok F1: Vizuální opravy penalizací ✅

#### Problém
Barevné zvýraznění penalizací (0/2/50) je příliš výrazné - na ledwall může být nečitelné, na vertical působí "papouškovitě" vzhledem k celkovému designu.

#### F1.1 Analýza a návrh
- [x] Projít stávající CSS pro penalty colors
- [x] Navrhnout utilitární barevné schéma v duchu stávající grafiky
- [x] Možnosti: odstíny šedé s opacity, tlumené barvy, pouze ikonky

#### F1.2 Implementace
- [x] Upravit penalty CSS classes - tlumené barvy (#a08060, #a06060, #70a070)
- [x] Testovat na vertical i ledwall layoutu
- [x] Zajistit čitelnost na různých rozlišeních

---

### Blok F2: Client ID pro C123 server ✅

#### Popis
Scoreboard může poslat `clientId` v URL při WebSocket připojení. Server pak identifikuje klienta podle ID místo IP adresy. Užitečné pro více scoreboardů na jednom stroji.

**Viz:** `../c123-server/docs/CLIENT-CONFIG.md`

#### F2.1 URL parametr
- [x] Přidat podporu `?clientId=xxx` URL parametru
- [x] Předat clientId do C123ServerProvider

#### F2.2 WebSocket URL
- [x] Upravit WebSocket URL: `ws://server/ws?clientId=xxx`
- [x] Fallback na IP-based identifikaci když clientId chybí

#### F2.3 Testy
- [x] Unit test pro clientId parsing
- [x] Test WebSocket URL construction

---

### Blok F3: Force Refresh ✅

#### Popis
C123 server může poslat `ForceRefresh` zprávu. Scoreboard má provést reload jako Ctrl+F5.

**Zpráva:**
```json
{
  "type": "ForceRefresh",
  "data": { "reason": "Manual refresh" }
}
```

#### F3.1 Handler v C123ServerProvider
- [x] Přidat handler pro `ForceRefresh` message type
- [x] Implementovat `window.location.reload()` pro full refresh

#### F3.2 Logování
- [x] Log důvodu refreshe před reloadem
- [x] Možnost zobrazit krátkou notifikaci (optional) - logování do konzole

---

### Blok F4: ConfigPush - přejímání parametrů ze serveru ✅

#### Popis
C123 server může poslat `ConfigPush` zprávu s parametry `type`, `displayRows`, `customTitle` atd. Scoreboard má přebrat tato nastavení.

**Zpráva:**
```json
{
  "type": "ConfigPush",
  "data": {
    "type": "ledwall",
    "displayRows": 8,
    "customTitle": "Finish Line Display"
  }
}
```

#### F4.1 Definice ConfigPush typu
- [x] Přidat `ConfigPushData` interface
- [x] Přidat handler v C123ServerProvider

#### F4.2 Aplikace konfigurace
- [x] Propojit s existujícím URL param systémem
- [x] Priorita: ConfigPush > URL params > defaults
- [x] Re-render po změně konfigurace (přes URL reload)

#### F4.3 ClientState response
- [x] Po aplikaci ConfigPush poslat zpět `ClientState` zprávu
- [x] Reportovat current config a version

#### F4.4 Flow při startu
- [x] Inicializace z URL params / localStorage
- [x] Čekat na ConfigPush po připojení
- [x] Merge s existující konfigurací (přes URL params)

---

### Blok F5: Asset management ✅

#### Problém
Customizace log a obrázků bez rebuildů. Hardcoded cesty v App.tsx.

#### Řešení
ConfigPush přes WebSocket - server posílá URL nebo base64 data URI, scoreboard uloží do localStorage a použije. URL parametry jen pro jednoduché relativní cesty (ne pro base64 - ty mají stovky KB a URL má limit ~2KB).

**Podporované formáty hodnot:**
- Relativní URL: `/assets/custom-logo.png`
- Absolutní URL: `https://example.com/logo.png`
- Data URI: `data:image/png;base64,...` (pouze přes ConfigPush!)

**Fallback chain:**
```
ConfigPush (WebSocket) → localStorage (persistence) → URL params (jen relativní) → defaults
```

#### F5.1 Rozšíření ConfigPushData
- [x] Přidat `logoUrl?: string` - hlavní logo (levý horní roh)
- [x] Přidat `partnerLogoUrl?: string` - logo partnerů (pravý horní roh)
- [x] Přidat `footerImageUrl?: string` - sponzorský banner (footer)

#### F5.2 Asset storage
- [x] Vytvořit `src/utils/assetStorage.ts`
- [x] `saveAssets(assets)` - uloží do localStorage pod klíčem `csb-assets`
- [x] `loadAssets()` - načte z localStorage
- [x] `clearAssets()` - smaže (pro reset na defaults)
- [x] Uložit při přijetí ConfigPush s asset daty

#### F5.3 Asset hook
- [x] Vytvořit `useAssets()` hook v `src/hooks/`
- [x] Fallback chain: localStorage → URL params (jen relativní) → defaults
- [x] Vrací resolved URLs: `{ logoUrl, partnerLogoUrl, footerImageUrl }`
- [x] URL params validace: odmítnout `data:` prefix (příliš velké)

#### F5.4 Úprava App.tsx
- [x] Importovat a použít `useAssets()` v ScoreboardContent
- [x] Předat resolved URLs do TopBar a Footer
- [x] DiscoveryScreen a ErrorScreen používají default logo (hardcoded)

#### F5.5 Validace a error handling
- [x] Validace formátu v assetStorage (http/https/data:/relativní)
- [x] `<img onError>` fallback na default při broken URL
- [x] Console warning pro nevalidní hodnoty
- [x] Warning v konzoli když URL param obsahuje `data:` (ignorovat)

#### F5.6 Testy a dokumentace
- [x] Unit testy pro assetStorage (23 testů)
- [x] Unit testy pro useAssets hook (8 testů)
- [x] Dokumentace ConfigPush polí v docs/architecture.md
- [x] Celkem 708 testů prošlo

#### Soubory
```
src/types/c123server.ts           # ConfigPushData s asset fields
src/utils/assetStorage.ts         # localStorage persistence
src/hooks/useAssets.ts            # Hook pro resolved URLs
src/providers/C123ServerProvider.ts # Uložení assets při ConfigPush
src/components/EventInfo/TopBar.tsx # onError fallback
src/components/Footer/Footer.tsx   # onError fallback
src/App.tsx                       # Použití useAssets()
```

---

## Fáze G - BR1/BR2 merge zobrazení ✅

**Dokončeno:** 2026-01-05 až 2026-01-06

### Cíl
Při BR2 závodech zobrazit OBA časy (BR1 i BR2) s grafickým rozlišením lepší/horší jízdy.

### Implementováno

| Komponenta | Popis |
|------------|-------|
| **Typy** | `RunResult`, `Result.run1/run2/bestRun` |
| **Utility** | `isBR2Race()`, `getBR1RaceId()`, `getClassId()` v `raceUtils.ts` |
| **REST API** | `getMergedResults()` s debounce 500ms |
| **BR2Manager** | Cache BR1 dat, merge logika, priority zdroje |
| **Vertical UI** | Dva sloupce (BR1, BR2), `.worseRun` styling |
| **Ledwall** | Skryté penalizace (mohou být z jiné jízdy) |

### Klíčová zjištění

- **WebSocket `Total`** = best of both runs (NE BR2!)
- **WebSocket `pen`** = penalizace NEJLEPŠÍ jízdy (NE BR2!)
- **Priorita zdrojů BR2 penalizace:** OnCourse (live) → REST cache → WebSocket
- **10s grace period** pro OnCourse penalizace po opuštění trati

### Soubory

```
src/utils/raceUtils.ts              # BR1/BR2 utility funkce
src/providers/utils/br1br2Merger.ts # BR2Manager + merge logika
src/providers/utils/c123ServerApi.ts # REST API klient
src/components/ResultsList/ResultRow.tsx # RunTimeCell pro BR2
docs/SolvingBR1BR2.md               # Kompletní analýza problému
```

### Testy
672 testů celkem, včetně raceUtils (45) a br1br2Merger (12)

---

## Fáze H - OnCourse vylepšení a scrollToFinished ✅

**Dokončeno:** 2026-01-06

### Cíl
Zjednodušení vertical zobrazení OnCourse (jen jeden závodník) a konfigurovatelné scroll chování.

---

### Blok H1: Vertical OnCourse - jeden závodník ✅

#### Implementováno
- [x] Odstraněn `OnCourseDisplay` z App.tsx - oba layouty zobrazují pouze jednoho závodníka
- [x] `CurrentCompetitor` komponenta zůstává pro zobrazení aktuálního závodníka
- [x] Data flow zachován (onCourse array existuje pro interní logiku a highlight detection)

---

### Blok H2: Parametr scrollToFinished ✅

#### Implementováno
- [x] URL parametr `?scrollToFinished=false` - vypne scroll při dojetí
- [x] ConfigPush podpora - server může nastavit `scrollToFinished: boolean`
- [x] useLayout hook vrací `scrollToFinished` boolean
- [x] useAutoScroll respektuje parametr - highlight zůstává, scroll se podmínečně vypne
- [x] ClientState response obsahuje `scrollToFinished` v capabilities

**Použití:**
```
?scrollToFinished=false  # Pouze highlight, bez scroll
?scrollToFinished=true   # Výchozí - highlight + scroll na pozici
```

---

### Blok H3: Dokumentace ✅

- [x] Aktualizován docs/architecture.md - ConfigPush a ClientState
- [x] Aktualizován komentář v App.tsx s novým parametrem

---

### Blok H4: Testy ✅

- [x] Unit testy pro scrollToFinished v useLayout.test.ts (5 testů)
- [x] Celkem 677 testů prošlo

### Soubory

```
src/App.tsx                        # Odstraněn OnCourseDisplay
src/hooks/useLayout.ts             # scrollToFinished URL param
src/hooks/useAutoScroll.ts         # Podmíněný scroll
src/types/c123server.ts            # ConfigPushData.scrollToFinished
src/providers/C123ServerProvider.ts # ConfigPush handler
docs/architecture.md               # Dokumentace
```

---

## Fáze I - Server-assigned clientId persistence ✅

**Dokončeno:** 2026-01-06

### Cíl

Implementovat podporu pro server-assigned clientId - server může přiřadit klientovi identifikátor, který se uloží do localStorage a použije při dalších připojeních.

### Implementováno

| Funkce | Popis |
|--------|-------|
| **getStoredClientId()** | Načte clientId z localStorage |
| **saveClientId()** | Uloží server-assigned clientId do localStorage |
| **clearClientId()** | Smaže uložené clientId (reset na IP-based) |
| **getClientIdFromUrl()** | Rozšířeno o fallback: URL param → localStorage → null |
| **ConfigPush handler** | Ukládá nové clientId do localStorage |

### Flow

```
1. Klient se připojí bez clientId → server identifikuje podle IP
2. Admin v dashboard přiřadí clientId (např. "finish-main")
3. Server pošle ConfigPush s clientId: "finish-main"
4. Klient:
   - Uloží clientId do localStorage
   - Přidá clientId do URL parametrů
   - Reloadne stránku s novým clientId
5. Další připojení automaticky používá uložené clientId
```

### Priority (fallback chain)

```
URL param ?clientId=xxx → localStorage (c123-clientId) → null (IP-based)
```

### Soubory

```
src/providers/utils/discovery-client.ts    # getClientIdFromUrl, saveClientId, etc.
src/providers/C123ServerProvider.ts        # ConfigPush handler s ukládáním
src/providers/utils/__tests__/clientId.test.ts  # 17 unit testů
```

---

## Dokumentace

| Dokument | Popis |
|----------|-------|
| [docs/architecture.md](docs/architecture.md) | Architektura, data flow, klíčové soubory |
| [docs/timing.md](docs/timing.md) | Timing konstanty a flow diagramy |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Řešení běžných problémů |
| [docs/testing.md](docs/testing.md) | Testovací příkazy a pokrytí |
| [docs/DEVLOG.md](docs/DEVLOG.md) | Deníček vývoje |

---

## Externí reference

| Dokumentace | Cesta |
|-------------|-------|
| C123 Server docs | `../c123-server/docs/` |
| Analýza | `../analysis/` |
| Nahrávky | `../analysis/recordings/` |
| V2 (READONLY) | `../canoe-scoreboard-v2/` |
