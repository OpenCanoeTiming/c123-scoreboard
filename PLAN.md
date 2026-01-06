# Implementační plán: Canoe Scoreboard V3

## Stav projektu

| Fáze | Status |
|------|--------|
| Fáze A-E: Základní funkčnost, testy, opravy | ✅ Hotovo |
| Fáze F: Vylepšení a integrace s C123 | ✅ Hotovo |
| Fáze G: BR1/BR2 merge zobrazení | ✅ Hotovo |
| Fáze H: OnCourse vylepšení a scrollToFinished | ✅ Hotovo |
| Fáze I: Server-assigned clientId persistence | ✅ Hotovo |
| **Fáze J: Dokumentace** | 🔄 Probíhá |

---

## Fáze J - Dokumentace

### Cíl

Vytvořit kompletní dokumentaci pro budoucí návrat k projektu. Dva typy:
1. **README.md** - uživatelská příručka (instalace, použití, deployment)
2. **docs/** - vývojářská dokumentace (architektura, implementace, konvence)

---

### Stávající dokumentace

| Soubor | Stav | Poznámka |
|--------|------|----------|
| README.md | ✅ Hotovo | V3 kompletní přepis (J1) |
| docs/url-parameters.md | ✅ Hotovo | URL parametry reference (J2) |
| docs/configuration.md | ✅ Hotovo | Remote konfigurace (J3) |
| docs/data-providers.md | ✅ Hotovo | DataProvider interface (J4) |
| docs/components.md | ✅ Hotovo | React komponenty (J5) |
| docs/development.md | ✅ Hotovo | Vývojářský průvodce (J6) |
| docs/architecture.md | ✅ OK | ConfigPush, typy |
| docs/timing.md | ✅ OK | Konstanty, flow |
| docs/troubleshooting.md | ✅ OK | Běžné problémy |
| docs/testing.md | ⚠️ Základní | Rozšířit o coverage, CI |
| docs/SolvingBR1BR2.md | ✅ OK | Analytický dokument |

---

### Blok J1: README.md - kompletní přepis

Uživatelská příručka pro operátory a správce.

#### Obsah ✅ Hotovo
- [x] **Úvod** - co je Scoreboard V3, rozdíly oproti V2
- [x] **Quick Start** - minimální kroky ke spuštění
- [x] **Instalace** - prerequisites, npm install, build
- [x] **Konfigurace** - kompletní tabulka URL parametrů
- [x] **Layout módy** - vertical, ledwall, displayRows
- [x] **Data sources** - C123ServerProvider (primární), CLIProvider (fallback), ReplayProvider
- [x] **Asset management** - loga, bannery, ConfigPush
- [x] **Deployment** - web server, Raspberry Pi, FullPageOS
- [x] **BR1/BR2** - stručně jak funguje merge zobrazení
- [x] **Troubleshooting** - odkaz na docs/troubleshooting.md

---

### Blok J2: docs/url-parameters.md ✅ Hotovo

Kompletní reference všech URL parametrů na jednom místě.

#### Obsah ✅ Hotovo
- [x] Tabulka všech parametrů s typy a defaults
- [x] Příklady URL pro různé scénáře
- [x] ConfigPush override chování
- [x] Fallback chains (clientId, assets)

**Dokumentované parametry:**
```
server, source, type, displayRows, scrollToFinished,
disableScroll, clientId, speed, loop, pauseAfter,
customTitle, logoUrl, partnerLogoUrl, footerImageUrl
```

---

### Blok J3: docs/configuration.md ✅ Hotovo

Remote konfigurace přes C123 server.

#### Obsah ✅ Hotovo
- [x] **ConfigPush** - formát zprávy, podporovaná pole
- [x] **ClientState** - response formát, capabilities
- [x] **ForceRefresh** - kdy a jak se používá
- [x] **Asset management** - flow, localStorage, validace
- [x] **clientId** - přiřazení, persistence, priority

---

### Blok J4: docs/data-providers.md ✅ Hotovo

Jak funguje napojení na data.

#### Obsah ✅ Hotovo
- [x] **Provider interface** - abstrakce, metody, events
- [x] **C123ServerProvider** - WebSocket, REST sync, message typy
- [x] **CLIProvider** - legacy protokol, kdy použít
- [x] **ReplayProvider** - development, recordings
- [x] **Auto-discovery** - jak najde C123 server
- [x] **Reconnect logika** - exponential backoff, REST sync po reconnectu

---

### Blok J5: docs/components.md ✅ Hotovo

Klíčové React komponenty pro budoucí úpravy.

#### Obsah ✅ Hotovo
- [x] **App.tsx** - entry point, provider setup
- [x] **ScoreboardContext** - state management, reducer akce
- [x] **ResultsList** - scrolling, highlight, BR1/BR2 columns
- [x] **CurrentCompetitor** - on-course zobrazení
- [x] **TopBar/Footer** - asset loading, fallbacks
- [x] **Hooks** - useLayout, useAutoScroll, useAssets, useHighlight

---

### Blok J6: docs/development.md ✅ Hotovo

Průvodce pro vývojáře.

#### Obsah ✅ Hotovo
- [x] **Setup prostředí** - Node.js, IDE, extensions
- [x] **Struktura projektu** - adresáře, konvence pojmenování
- [x] **Coding standards** - TypeScript, CSS, testy
- [x] **Testování** - unit, e2e, visual, jak přidat test
- [x] **Mock servery** - TCP, WebSocket, recordings
- [x] **Debugging** - DevTools, console logs, network
- [x] **Git workflow** - branches, commit messages

---

### Blok J7: Aktualizace existujících docs

- [ ] **docs/testing.md** - rozšířit o test coverage, CI/CD, jak psát testy
- [ ] **docs/architecture.md** - doplnit BR2Manager, raceUtils
- [ ] **docs/DEVLOG.md** - uzavřít aktuální fázi

---

### Výstupní soubory

```
README.md                    # Uživatelská příručka (přepis)
docs/url-parameters.md       # Nový - kompletní reference
docs/configuration.md        # Nový - ConfigPush, assets, clientId
docs/data-providers.md       # Nový - providers, discovery
docs/components.md           # Nový - React komponenty
docs/development.md          # Nový - vývojářský průvodce
docs/testing.md              # Rozšířený
docs/architecture.md         # Doplněný
```

---

## Hotové fáze (shrnutí)

### Fáze F - Vylepšení a integrace s C123 serverem

- **F1** - Vizuální opravy penalizací (tlumené barvy #a08060, #a06060, #70a070)
- **F2** - Client ID podpora (`?clientId=xxx` → WebSocket URL)
- **F3** - ForceRefresh handler (`window.location.reload()`)
- **F4** - ConfigPush zprávy (type, displayRows, customTitle) + ClientState response
- **F5** - Asset management (logoUrl, partnerLogoUrl, footerImageUrl přes ConfigPush/localStorage)

**Soubory:** `assetStorage.ts`, `useAssets.ts`, `C123ServerProvider.ts`

---

### Fáze G - BR1/BR2 merge zobrazení

Při BR2 závodech zobrazení obou časů s grafickým rozlišením lepší/horší jízdy.

- Typy: `RunResult`, `Result.run1/run2/bestRun`
- Utility: `isBR2Race()`, `getBR1RaceId()`, `getClassId()`
- BR2Manager s cache BR1 dat a merge logikou
- Vertical UI: dva sloupce (BR1, BR2), `.worseRun` styling
- Ledwall: skryté penalizace (mohou být z jiné jízdy)

**Klíčové:** WebSocket `Total` = best of both runs, ne BR2!

**Soubory:** `raceUtils.ts`, `br1br2Merger.ts`, `c123ServerApi.ts`, `ResultRow.tsx`

---

### Fáze H - OnCourse vylepšení a scrollToFinished

- Vertical OnCourse zobrazuje pouze jednoho závodníka
- URL parametr `?scrollToFinished=false` - vypne scroll při dojetí (highlight zůstává)
- ConfigPush podpora pro `scrollToFinished: boolean`

**Soubory:** `useLayout.ts`, `useAutoScroll.ts`

---

### Fáze I - Server-assigned clientId persistence

Server může přiřadit clientId přes ConfigPush → uloží se do localStorage → použije při dalších připojeních.

**Fallback chain:** URL param → localStorage → null (IP-based)

**Soubory:** `discovery-client.ts`, `C123ServerProvider.ts`

---

## Dokumentace

| Dokument | Popis |
|----------|-------|
| [docs/architecture.md](docs/architecture.md) | Architektura, data flow, klíčové soubory |
| [docs/timing.md](docs/timing.md) | Timing konstanty a flow diagramy |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Řešení běžných problémů |
| [docs/testing.md](docs/testing.md) | Testovací příkazy a pokrytí |
| [docs/DEVLOG.md](docs/DEVLOG.md) | Deníček vývoje |
| [docs/SolvingBR1BR2.md](docs/SolvingBR1BR2.md) | BR1/BR2 analýza problému |

---

## Externí reference

| Dokumentace | Cesta |
|-------------|-------|
| C123 Server docs | `../c123-server/docs/` |
| Analýza | `../analysis/` |
| Nahrávky | `../analysis/recordings/` |
| V2 (READONLY) | `../canoe-scoreboard-v2/` |
