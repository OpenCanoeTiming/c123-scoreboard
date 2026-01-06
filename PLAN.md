# Implementační plán: Canoe Scoreboard V3

## Stav projektu

| Fáze | Status |
|------|--------|
| Fáze A-E: Základní funkčnost, testy, opravy | ✅ Hotovo |
| Fáze F: Vylepšení a integrace s C123 | ✅ Hotovo (F5 odloženo) |
| Fáze G: BR1/BR2 merge zobrazení | ✅ Hotovo (2026-01-05/06) |

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

### Blok F5: Asset management

#### Problém
Customizace log a obrázků bez rebuildů. Hardcoded cesty v App.tsx.

#### Řešení
ConfigPush override - server posílá URL nebo base64 data URI, scoreboard použije nebo fallback na default.

**Podporované formáty hodnot:**
- URL: `http://...`, `https://...`
- Data URI: `data:image/png;base64,...`, `data:image/svg+xml;base64,...`

#### F5.1 Rozšíření ConfigPushData
- [ ] Přidat `logoUrl?: string` - hlavní logo (levý horní roh)
- [ ] Přidat `partnerLogoUrl?: string` - logo partnerů (pravý horní roh)
- [ ] Přidat `footerImageUrl?: string` - sponzorský banner (footer)

#### F5.2 Asset hook
- [ ] Vytvořit `useAssets()` hook v `src/hooks/`
- [ ] Čte ConfigPush data z kontextu (nebo URL params jako fallback)
- [ ] Vrací resolved URLs: `{ logoUrl, partnerLogoUrl, footerImageUrl }`
- [ ] Fallback chain: ConfigPush → URL params → defaults (`/assets/...`)

#### F5.3 Úprava App.tsx
- [ ] Importovat a použít `useAssets()` v ScoreboardContent
- [ ] Předat resolved URLs do TopBar a Footer
- [ ] Aktualizovat DiscoveryScreen a ErrorScreen (použít default logo)

#### F5.4 Validace a error handling
- [ ] Validace formátu (http/https/data:)
- [ ] `<img onError>` fallback na default při broken URL
- [ ] Console warning pro nevalidní hodnoty

#### F5.5 Testy a dokumentace
- [ ] Unit testy pro useAssets hook
- [ ] Dokumentace URL parametrů a ConfigPush polí
- [ ] Příklady v docs/

---

### C123 Server - Asset management (související změny)

> **Poznámka:** Tyto změny patří do `../c123-server/`, zde jen pro referenci.

#### Centrální assets
- [ ] Konfigurace default assets v server config (logo, partners, footer)
- [ ] Automatické posílání v ConfigPush všem klientům při připojení
- [ ] Per-client override v client config (přepíše default)

#### Admin UI - Asset helper
- [ ] Upload/paste obrázku → automatická konverze do base64
- [ ] URL input → fetch a převod do base64 (pro offline použití)
- [ ] Automatický resize na přiměřené rozlišení:
  - Logo: max 200x80px
  - Partners: max 300x80px
  - Footer: max 1920x200px
- [ ] Preview před uložením
- [ ] Validace velikosti (varování při >100KB base64)

#### Priorita zdrojů (server-side)
```
Per-client config > Global default config > Neposlat (scoreboard default)
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
