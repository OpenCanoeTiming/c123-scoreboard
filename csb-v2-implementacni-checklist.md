# Canoe-Scoreboard-v2 - Implementační checklist

> **Souvislosti:**
> - Kompletní analýza: [../analysis/](../analysis/)
> - Plán reimplementace: [../analysis/08-plan-reimplementace.md](../analysis/08-plan-reimplementace.md)
> - Síťová komunikace: [../analysis/07-sitova-komunikace.md](../analysis/07-sitova-komunikace.md)
> - State management principy: [../analysis/03-state-management.md](../analysis/03-state-management.md)
> - Styly a layouty: [../analysis/06-styly.md](../analysis/06-styly.md)
> - Prerekvizita (splněna): [../analysis/10-prototype-checklist.md](../analysis/10-prototype-checklist.md) → [../canoe-scoreboard-v2-prototype/](../canoe-scoreboard-v2-prototype/)

---

## Jak používat tento checklist

- [ ] = Nesplněno
- [x] = Splněno
- [~] = Částečně / Vyžaduje revizi
- [!] = Blokováno / Problém

**Revizní body** jsou označeny 🔍 - zde se zastavit, zhodnotit a případně upravit plán.

**Rozhodovací body** jsou označeny ❓ - zde je potřeba rozhodnout před pokračováním.

---

## Fáze 0: Příprava

### 0.1 Prostředí
- [x] Node.js 18+ nainstalován
- [x] npm/pnpm připraven
- [x] VS Code / editor připraven
- [x] Git inicializován v `/workspace/csb-v2/canoe-scoreboard-v2/`

### 0.2 Reference materiály
- [x] Prostudovat `08-plan-reimplementace.md` (architektura, DataProvider, edge cases)
- [x] Prostudovat `07-sitova-komunikace.md` (protokoly CLI/C123, detekce dojetí)
- [x] Prostudovat `06-styly.md` (barevné schéma, layouty)
- [x] Screenshoty a prototyp pro vizuální referenci
- [x] Ověřit dostupnost testovacích dat (`recordings/rec-2025-12-28T09-34-10.jsonl`)

---

## Fáze 1: Základ projektu

### 1.1 Scaffolding
- [x] Vytvořit projekt: `npm create vite@latest canoe-scoreboard-v2 -- --template react-ts`
- [x] `cd canoe-scoreboard-v2 && npm install`
- [x] Ověřit že `npm run dev` funguje
- [x] Smazat demo obsah (App.tsx, App.css, assets/)

### 1.2 Struktura adresářů
- [x] Vytvořit `src/components/`
- [x] Vytvořit `src/context/`
- [x] Vytvořit `src/providers/` (DataProvider implementace)
- [x] Vytvořit `src/hooks/`
- [x] Vytvořit `src/styles/`
- [x] Vytvořit `src/types/`
- [x] Vytvořit `src/utils/`

### 1.3 Konfigurace
- [x] ESLint - základní React + TypeScript pravidla
- [x] Prettier - konfigurace formátování
- [x] tsconfig.json - strict mode
- [x] tsconfig.json - path aliases (@/components, @/types, ...)
- [x] vite.config.ts - CSS modules enabled (default)
- [x] vite.config.ts - path alias resolver
- [x] Vitest setup (`npm install -D vitest @testing-library/react`)
- [x] `vitest.config.ts` - konfigurace testů
- [x] Playwright setup (`npm install -D @playwright/test`)
- [x] `playwright.config.ts` - viewporty pro vertical (1080×1920) a ledwall (768×384)

### 1.4-1.9 Základní soubory
- [x] Styly: variables.css, reset.css, fonts.css
- [x] Fonty: Inter, JetBrains Mono v public/fonts/
- [x] App: main.tsx, App.tsx
- [x] TypeScript typy: competitor.ts, result.ts, config.ts, messages.ts, visibility.ts, connection.ts

### 🔍 Revize: Fáze 1
- [x] Projekt se builduje bez errorů (`npm run build`)
- [x] TypeScript typy odpovídají datům z WebSocket
- [x] Fonty se správně načítají
- [x] Path aliases fungují
- [x] **Commit:** "feat: project scaffolding and types"

---

## Fáze 2: DataProvider abstrakce

### 2.1-2.3 DataProvider interface a utility
- [x] `src/providers/types.ts` - DataProvider interface (connect, disconnect, callbacks)
- [x] `src/providers/utils/parseGates.ts` - parsování "0,0,2,..."
- [x] `src/providers/utils/normalizeCompetitor.ts`
- [x] `src/providers/utils/detectFinish.ts`
- [x] Testy pro utility prochází

### 2.4 ReplayProvider
- [x] `src/providers/ReplayProvider.ts` - třída implementující DataProvider
- [x] Parsovat JSONL, přeskočit _meta
- [x] Playback engine s setTimeout/setInterval
- [x] Playback controls: pause, resume, seek, setSpeed
- [x] Message dispatch podle typu zprávy
- [x] 27+ unit testů

### CLIProvider
- [x] `src/providers/CLIProvider.ts` - WebSocket připojení
- [x] Constructor přijímá URL (ws://host:8081)
- [x] Exponential backoff reconnect: 1s → 2s → 4s → 8s → 16s → 30s
- [x] Message parsing (top, oncourse, comp, control, title, infotext, daytime)
- [x] 24 unit testů

### C123Provider
- [!] **NELZE v prohlížeči** - TCP socket není dostupný v browser JS
- Možné řešení: WebSocket proxy server nebo přesunutí do Node.js backend

---

## Fáze 2.5-2.8: ScoreboardContext

### 2.5 Základní struktura
- [x] `src/context/ScoreboardContext.tsx`
- [x] ScoreboardState interface
- [x] ScoreboardProvider komponenta
- [x] useScoreboard hook
- [x] Connection state, data state, visibility state

### 2.6 Highlight logika
- [x] State: highlightBib, highlightTimestamp
- [x] HIGHLIGHT_DURATION = 5000 (5 sekund)
- [x] Deduplikace s onCourse
- [x] useHighlight hook

### 2.7 Departing competitor
- [x] State: departingCompetitor, departedAt
- [x] DEPARTING_TIMEOUT = 3000 (3 sekundy)
- [x] Vymazat při highlight nebo timeout

### 2.8 Reconnect handling
- [x] State reset při reconnect
- [x] Čekat na první top zprávu

### 🔍 Revize: Data Layer
- [x] Všechny edge cases pokryty (v ScoreboardContext)
- [x] ReplayProvider funguje pro development
- [x] ScoreboardContext správně zpracovává všechna data
- [ ] CLIProvider stabilní (vyžaduje live server test)

---

## Fáze 3: Layout systém

### 3.1-3.5 useLayout hook
- [x] Detekce viewport rozměrů
- [x] URL parametr `?type=vertical|ledwall`
- [x] Fallback na autodetekci podle aspect ratio
- [x] Výpočty pro vertical i ledwall
- [x] Return: visibleRows, rowHeight, fontSize, layoutMode, showFooter

### 3.6-3.10 CSS Variables
- [x] Barvy, spacing, typography, layout
- [x] Hook nastavuje CSS variables na :root

### 3.11 Layout komponenta
- [x] `src/components/Layout/ScoreboardLayout.tsx`
- [x] CSS Grid layout
- [x] Responzivní bez transform: scale()

---

## Fáze 4: Základní komponenty

### 4.1-4.3 Utility funkce
- [x] `src/utils/formatTime.ts` - formát "1:23.45"
- [x] `src/utils/formatName.ts` - zkrácení jmen
- [x] Unit testy pro obě funkce

### 4.4-4.7 Základní komponenty
- [x] TimeDisplay - JetBrains Mono font
- [x] Footer - sponzorský banner
- [x] TopBar - logo, partners
- [x] Title - název závodu

### 4.8-4.15 CurrentCompetitor
- [x] Bib, Name, Club, Time
- [x] TTB info (rozdíl, jméno vedoucího)
- [x] Penalties summary
- [x] Gate penalties (barevné kódování)
- [x] Pulzující indikátor ►
- [x] Animace změny
- [x] Departing zobrazení

### 4.16-4.24 ResultsList
- [x] ResultRow komponenta
- [x] Sloupce: Rank, Bib, Name, Penalty, Time, Behind
- [x] Responzivní sloupce (ledwall skrývá některé)
- [x] Alternující barvy řádků
- [x] Highlight styling
- [x] Scroll k highlight
- [x] Auto-scroll (useAutoScroll hook, 25 testů)

---

## Fáze 5: Integrace a styly

### 5.1-5.3 App.tsx
- [x] ScoreboardProvider wrapper
- [x] DataProvider (ReplayProvider) instance
- [x] URL parametry (?source, ?speed, ?host, ?loop)
- [x] Propojení s kontextem

### 5.4-5.6 Connection UI
- [x] Loading, Waiting, Connected, Reconnecting stavy
- [x] ConnectionStatus komponenta
- [x] Error handling s retry

### 5.7-5.8 Visibility
- [x] Propojit visibility state s komponentami
- [ ] Testovat toggle jednotlivých komponent (manuální)

### 5.9-5.16 Styly a animace
- [x] @keyframes pulseGlyph (`CurrentCompetitor.module.css:91-98`)
- [x] @keyframes subtlePulse (`ResultsList.module.css:68-75`)
- [x] CSS transitions
- [ ] Vizuální porovnání s originálem (manuální)
- [ ] Pixel-level doladění barev a typografie (manuální)

---

## Fáze 6: Rozšíření (volitelné)

### OnCourseDisplay
- [ ] ❓ Rozhodnutí: Implementovat teď?

### InfoText (Marquee)
- [X] ❓ Rozhodnutí: Teď se nebude implementovat

---

## Fáze 7: Testování a dokumentace

### 7.1-7.8 Funkční scénáře (manuální)
- [ ] Cold start: Loading → Waiting → Data
- [ ] Závodník dojede: departing → highlight → scroll
- [ ] Rychlé změny: 2 závodníci < 1s
- [ ] Disconnect/reconnect
- [ ] Prázdný závod
- [ ] Highlight + OnCourse deduplikace
- [ ] Highlight timeout

### 7.9-7.12 Layout testování (manuální)
- [ ] Vertical 1080×1920, 720×1280
- [ ] Ledwall 768×384, 1920×480
- [ ] Resize přepínání
- [ ] Hardware test

### 7.13-7.14 Automatické testy
- [x] Unit testy pro utility
- [x] Integration testy pro providery

### 7.15-7.17 Dokumentace
- [x] README.md
- [x] URL parametry dokumentace
- [x] Architektura přehled

---

## Fáze 8: Automatizované E2E testování a porovnání

### 8.1 Oprava Playwright E2E testů

**Problém:** Některé testy selhávají na "Failed to take two consecutive stable screenshots" kvůli animacím a měnícím se datům.

- [x] Zastavit ReplayProvider playback před screenshotem (URL param `pauseAfter=50`)
- [x] Přidat delší `waitForTimeout` před screenshoty (500ms → 2000ms)
- [x] Zakázat animace v Playwright config (`--force-prefers-reduced-motion`)
- [x] Přidat `data-testid` pro všechny testované komponenty (již existovaly)
- [x] Aktualizovat všechny baseline snapshoty po stabilizaci (24 snapshotů)
- [x] Rozdělit testy na "static" (visual.spec.ts) a "dynamic" (dynamic.spec.ts)

**Implementované řešení:**
- Přidán URL parametr `pauseAfter` pro ReplayProvider - zastaví playback po N zprávách
- Přidán URL parametr `disableScroll` - vypne auto-scroll pro stabilní screenshoty
- Hook `useAutoScroll` respektuje `prefers-reduced-motion` media query
- Hook `useLayout` nově vrací `disableScroll` z URL parametrů
- 24 visual testů (static) + 14 dynamic testů = 38 E2E testů celkem

### 8.2 Oprava CLI připojení v Playwright

**Problém:** WebSocket připojení na `ws://192.168.68.108:8081` selhává v Chromium headless.

**Ověření problému:**
- [ ] Zkontrolovat přesný error message v browser console
- [ ] Ověřit, že URL formát je správný (`ws://` vs `wss://`)
- [ ] Otestovat s `--disable-web-security` flag v Playwright
- [ ] Porovnat s prototypem - jak tam WebSocket funguje?

**Možné příčiny a řešení:**
- [ ] **Mixed content** - pokud app běží na localhost, WS na externí IP může být blokován
  - Řešení: Spustit dev server s `--host` flag
- [ ] **CORS/CSP headers** - zkontrolovat response headers z CLI serveru
- [ ] **WebSocket URL parsing** - ověřit, že CLIProvider správně parsuje host parametr
- [ ] **Timeout** - zvýšit connection timeout v CLIProvider

**Debug kroky:**
- [ ] Přidat detailed logging do CLIProvider (`console.log` pro každý WS event)
- [ ] Otestovat WebSocket připojení přímo v browser DevTools
- [ ] Porovnat network tab mezi v2 a původní verzí

### 8.3 Automatické porovnání s původní verzí

**Reference URLs (živá data):**
```
Ledwall: http://192.168.68.108:3000/?type=ledwall&server=ws%3A%2F%2F192.168.68.108%3A8081%2F&disableScroll=true&ledwallExactSize=true
Vertical: http://192.168.68.108:3000/?type=vertical&server=ws%3A%2F%2F192.168.68.108%3A8081%2F&disableScroll=true
```

**Automatické screenshot porovnání:**
- [ ] Vytvořit Playwright test `tests/e2e/comparison.spec.ts`
- [ ] Screenshot původní verze (http://192.168.68.108:3000)
- [ ] Screenshot nové verze (http://localhost:5173)
- [ ] Použít `pixelmatch` nebo Playwright built-in comparison
- [ ] Generovat diff report s highlighted rozdíly

**Struktura testu:**
```typescript
test.describe('Visual Comparison with Original', () => {
  test('ledwall layout matches original', async ({ page }) => {
    // 1. Screenshot original
    await page.goto('http://192.168.68.108:3000/?type=ledwall&server=...')
    await page.waitForTimeout(5000) // čekat na data
    const originalScreenshot = await page.screenshot()

    // 2. Screenshot new version
    await page.goto('http://localhost:5173/?source=cli&host=192.168.68.108:8081&type=ledwall')
    await page.waitForTimeout(5000)
    const newScreenshot = await page.screenshot()

    // 3. Compare
    expect(newScreenshot).toMatchSnapshot('ledwall-comparison.png', {
      maxDiffPixelRatio: 0.1 // 10% tolerance
    })
  })
})
```

**Metriky pro porovnání:**
- [ ] Pixel diff ratio (cíl: < 5%)
- [ ] Layout structure (DOM hierarchy)
- [ ] Barvy (HSL distance)
- [ ] Typography (font-size, line-height)
- [ ] Spacing (margin, padding)

### 8.4 Automatické funkční testy s CLI

**Předpoklad:** CLI připojení funguje (viz 8.2)

- [ ] Test: Připojení k CLI serveru
- [ ] Test: Příjem `top` zprávy → results se zobrazí
- [ ] Test: Příjem `comp` zprávy → CurrentCompetitor se aktualizuje
- [ ] Test: Příjem `control` zprávy → visibility se změní
- [ ] Test: Reconnect po výpadku (simulovat odpojení CLI serveru)

### 8.5 Performance porovnání

- [ ] Měřit FPS v obou verzích (Performance API)
- [ ] Měřit memory usage (po 1 minutě běhu)
- [ ] Měřit CPU usage (Chrome DevTools)
- [ ] Lighthouse audit pro obě verze
- [ ] Porovnat bundle size

### 🔍 Revize: Fáze 8

- [ ] Všechny Playwright testy prochází
- [ ] CLI připojení funguje v Playwright
- [ ] Vizuální rozdíl od originálu < 5%
- [ ] Performance srovnatelná nebo lepší
- [ ] **Commit:** "test: add E2E comparison with original"

---

## Post-implementace

### Další kroky (budoucnost)
- [ ] C123Provider - přímé připojení bez CLI (vyžaduje WebSocket proxy)
- [ ] Produkční nasazení
- [ ] Performance optimalizace (pokud potřeba)
- [ ] Cache BR1 výsledků pro dvě jízdy

---

## Aktuální stav projektu (2025-12-29)

### Build & testy

```
Build:      ✅ Úspěšný (438 kB JS, 14 kB CSS)
Unit testy: ✅ 551 testů (24 test suites)
E2E testy:  ✅ 38 testů (24 visual + 14 dynamic, 2 skipped)
Benchmarks: ✅ 29 performance benchmarků
ESLint:     ✅ 0 errors
TypeScript: ✅ Strict mode
```

### Test coverage

| Kategorie | Počet testů |
|-----------|-------------|
| Utility (formatTime, formatName) | 59 |
| Providers (CLI, Replay) | 55 |
| Provider utils (parseGates, detectFinish, validation) | 78 |
| Hooks (useAutoScroll, useLayout, useHighlight) | 61 |
| Components (ResultsList, CurrentCompetitor) | 65 |
| Context (ScoreboardContext) | 45 |
| Contract tests | 35 |
| Fuzz tests | 22 |
| Memory leak tests | 10 |
| ErrorBoundary tests | 20 |
| Snapshot tests | 57 |
| Chaos engineering tests | 31 |
| **E2E visual tests** | 24 |
| **E2E dynamic tests** | 14 |

### Dostupné zdroje

| Zdroj | Lokace |
|-------|--------|
| CLI server | ws://192.168.68.108:8081 |
| C123 server | tcp://192.168.68.108 |
| Recording | `public/recordings/rec-2025-12-28T09-34-10.jsonl` |
| Ref. screenshoty | `/workspace/csb-v2/analysis/reference-screenshots/original-live-*.png` |
| Styly JSON | `/workspace/csb-v2/analysis/reference-screenshots/*-styles.json` |
| **Original v1 ledwall** | http://192.168.68.108:3000/?type=ledwall&server=ws%3A%2F%2F192.168.68.108%3A8081%2F&disableScroll=true&ledwallExactSize=true |
| **Original v1 vertical** | http://192.168.68.108:3000/?type=vertical&server=ws%3A%2F%2F192.168.68.108%3A8081%2F&disableScroll=true |

---

## Zbývající kroky

### Automatizovatelné (Fáze 8)

| Kategorie | Stav | Poznámka |
|-----------|------|----------|
| **Playwright E2E** | ✅ Hotovo | 38 testů prochází (24 visual + 14 dynamic) |
| **CLI v Playwright** | 🔧 Debug | WebSocket chyba - nutné ověřit příčinu |
| **Porovnání s originálem** | ⏳ TODO | Automatické screenshot diff |
| **Performance testy** | ⏳ TODO | FPS, memory, Lighthouse |

### Vyžaduje manuální práci

| Kategorie | Důvod |
|-----------|-------|
| **C123Provider** (3) | TCP socket nelze v browser JS - technicky nemožné |
| **Hardware test** (~5) | Fyzická zařízení (Raspberry Pi, TV/LED panel) |
| **Architekturální rozhodnutí** (~5) | Rozdělení Context, schema validace |

### Implementováno ale neoznačeno (čeká vizuální ověření)

| Položka | Lokace |
|---------|--------|
| @keyframes pulseGlyph | `CurrentCompetitor.module.css:91-98` |
| @keyframes subtlePulse | `ResultsList.module.css:68-75` |
| CSS transitions | opacity, transform v komponentách |
| Scroll k highlight | `ResultsList.tsx` (scrollIntoView) |
| Auto-scroll | `useAutoScroll.ts` (25 testů) |

---

## Doporučený postup pro manuální testování

### 1. Spustit dev server

```bash
npm run dev
# Otevřít http://localhost:5173/?source=replay&speed=10
```

### 2. Testovat scénáře

1. **Cold start** - Loading → Waiting → Data zobrazena
2. **Závodník dojede** - comp zmizí → departing 3s → highlight → scroll
3. **Highlight timeout** - po 5s zmizí, scroll to top
4. **Layout přepínání** - Vertical (1080×1920) vs Ledwall (768×384)
5. **Prázdný závod** - graceful empty state

### 3. Vizuální porovnání

- Porovnat s `/workspace/csb-v2/analysis/reference-screenshots/original-live-*.png`
- Zkopírovat barvy z `*-styles.json` do `variables.css`

### 4. Live server test (pokud dostupný)

```
?source=cli&host=192.168.68.108:8081
```

### 5. Hardware test

- Spustit na Raspberry Pi 4/5
- Ověřit 60fps plynulost
- Změřit CPU/memory usage

---

## Doporučení pro produkční nasazení

### Před nasazením

1. **Vizuální QA** - porovnat všechny komponenty s reference screenshoty
2. **Live test** - připojit k reálnému CLI serveru
3. **Hardware test** - nasadit na Raspberry Pi a otestovat výkon

### Po úspěšném testování

```bash
git tag v2.0.0-beta
```

---

## Historie review (konsolidováno)

Projekt prošel iterativním vývojem s 12+ review cykly (v0.6 - v2.5). Klíčové milníky:

| Verze | Testy | Přidáno |
|-------|-------|---------|
| v0.6 | 156 | Základní unit testy, opravy ReplayProvider |
| v0.8 | 334 | Error Boundary, rozšíření testů komponent |
| v1.0 | 387 | Edge cases pro highlight, stress testy |
| v1.3 | 418 | Fuzz testing (22 testů), opravy parseGates |
| v1.4 | 428 | Memory leak testy (10 testů) |
| v1.8 | 463 | Contract testy (35 testů) |
| v2.0 | 475 | Snapshot testy (12 testů) |
| v2.3 | 522 | Chaos engineering (31 testů) |
| v2.4 | 551 | Rozšířené snapshoty (57 celkem) |

### Nalezené a opravené problémy

1. **Unstable key v CurrentCompetitor gates** - opraveno na `gate-${gateNumber}`
2. **parseGates s non-string vstupy** - přidána validace
3. **ReplayProvider null/undefined data** - přidána kontrola
4. **Callback error handling** - přidáno safeCallCallbacks s try-catch
5. **useEffect re-run loop v ScoreboardContext** (2025-12-29) - `handleResults` měl dependency `[onCourse]`, což způsobovalo neustálé disconnect/connect cykly. Opraveno použitím `useRef` pro onCourse.

### Silné stránky kódu

- Čistý DataProvider pattern s pub/sub systémem
- Dobře strukturovaný Context s TypeScript interfaces
- Správné cleanup v hooks (timery, animation frames, subscriptions)
- Responzivní layout systém
- 551 jednotkových testů + 29 benchmarků
- Error Boundary implementován
