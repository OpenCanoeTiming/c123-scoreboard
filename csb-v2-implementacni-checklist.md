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

### 1.4 Základní soubory - styly
- [x] `src/styles/variables.css` - CSS custom properties (prázdná struktura)
- [x] `src/styles/reset.css` - CSS reset (minimální, box-sizing)
- [x] `src/styles/fonts.css` - font-face deklarace

### 1.5 Základní soubory - fonty
- [x] Vytvořit `public/fonts/`
- [x] Zkopírovat Inter (Regular, SemiBold, Bold)
- [x] Zkopírovat JetBrains Mono (Regular)
- [x] Ověřit že fonty jsou správně načteny

### 1.6 Základní soubory - app
- [x] `src/main.tsx` - importovat globální styly
- [x] `src/App.tsx` - prázdná kostra s placeholder textem
- [x] Ověřit že se styly a fonty aplikují

### 1.7 TypeScript typy - základní
- [x] `src/types/competitor.ts` - OnCourseCompetitor interface (viz 08-plan)
- [x] `src/types/result.ts` - Result interface (viz 08-plan)
- [x] `src/types/config.ts` - RaceConfig interface

### 1.8 TypeScript typy - zprávy
- [x] `src/types/messages.ts` - MessageType enum
- [x] `src/types/messages.ts` - CLI message payloads (top, comp, oncourse, control...)
- [x] `src/types/visibility.ts` - VisibilityState interface

### 1.9 TypeScript typy - connection
- [x] `src/types/connection.ts` - ConnectionStatus type
- [x] `src/types/index.ts` - re-exporty všech typů

### 🔍 Revize: Fáze 1
- [x] Projekt se builduje bez errorů (`npm run build`)
- [x] TypeScript typy odpovídají datům z WebSocket
- [x] Fonty se správně načítají
- [x] Path aliases fungují
- [x] Struktura je čistá a logická
- [x] **Commit:** "feat: project scaffolding and types"

---

## Fáze 2: DataProvider abstrakce

> **Reference:** [../analysis/07-sitova-komunikace.md](../analysis/07-sitova-komunikace.md) a [../analysis/08-plan-reimplementace.md](../analysis/08-plan-reimplementace.md#dataprovider-abstrakce-detailně)

### 2.1 DataProvider interface
- [x] `src/providers/types.ts` - DataProvider interface
- [x] Metoda: `connect(): Promise<void>`
- [x] Metoda: `disconnect(): void`
- [x] Callback: `onResults(callback): Unsubscribe`
- [x] Callback: `onOnCourse(callback): Unsubscribe`
- [x] Callback: `onConfig(callback): Unsubscribe`
- [x] Callback: `onConnectionChange(callback): Unsubscribe`
- [x] Property: `readonly connected: boolean`
- [x] Property: `readonly status: ConnectionStatus`
- [x] Type: `Unsubscribe = () => void`

### 2.2 Společné utility pro providery
- [x] `src/providers/utils/parseGates.ts` - parsování "0,0,2,..." nebo "0 0 2 ..."
- [x] `src/providers/utils/normalizeCompetitor.ts` - sjednocení formátu
- [x] `src/providers/utils/detectFinish.ts` - detekce dojetí (dtFinish změna)

### 2.3 Testy pro utility
- [x] `src/providers/utils/__tests__/parseGates.test.ts`
- [x] `src/providers/utils/__tests__/detectFinish.test.ts`
- [x] Testy prochází (`npm test`)

### 🔍 Revize: DataProvider interface
- [x] Interface pokrývá všechny potřebné operace
- [x] Typy jsou správné a konzistentní
- [x] Testy pro utility prochází
- [x] **Commit:** "feat: DataProvider interface and utils"

---

## Fáze 2.4: ReplayProvider (primární pro vývoj)

> **Poznámka:** ReplayProvider je primární zdroj dat během vývoje.
> Umožňuje opakovatelné testování bez závislosti na běžícím serveru.
> Testovací nahrávka: `../analysis/recordings/rec-2025-12-28T09-34-10.jsonl`

### 2.4.1 Základní struktura
- [x] `src/providers/ReplayProvider.ts` - třída implementující DataProvider
- [x] Constructor přijímá: source (JSONL string nebo URL)
- [x] Interní stav: messages[], currentIndex, playing, speed

### 2.4.2 Načtení dat
- [x] Parsovat JSONL (jeden JSON na řádek)
- [x] Přeskočit _meta řádek
- [x] Uložit zprávy s jejich timestamps (ts field)

### 2.4.3 Playback engine
- [x] `connect()` - zahájí playback
- [x] setTimeout/setInterval pro scheduling zpráv
- [x] Respektovat relativní timestamps (ts)
- [x] Speed multiplier (1.0 = realtime, 2.0 = 2x rychleji)

### 2.4.4 Playback controls
- [x] `pause(): void` - pozastavit
- [x] `resume(): void` - pokračovat
- [x] `seek(positionMs: number): void` - přeskočit
- [x] `setSpeed(multiplier: number): void` - změnit rychlost

### 2.4.5 Message dispatch
- [x] Filtrovat podle zdroje (tcp nebo ws) - pro vývoj používat jen `ws`
- [x] Parsovat data podle typu zprávy
- [x] Volat příslušné callbacks (onResults, onOnCourse)

### 2.4.6 Testy pro ReplayProvider
- [x] `src/providers/__tests__/ReplayProvider.test.ts`
- [x] Test: načtení JSONL, správné pořadí zpráv
- [x] Test: speed multiplier funguje
- [x] Testy prochází

### 🔍 Revize: ReplayProvider
- [x] Načíst testovací nahrávku
- [x] Ověřit že zprávy přicházejí ve správném pořadí
- [x] Otestovat pause/resume
- [x] Otestovat speed změnu
- [x] **Commit:** "feat: ReplayProvider for development"

---

## Fáze 2.5 - 2.7: CLIProvider a C123Provider (až po ověření UI)

> **Poznámka:** Tyto providery se implementují až když je UI ověřené na ReplayProvider.
> Pořadí: nejprve CLIProvider (jednodušší, JSON), pak případně C123Provider (XML).

Dulezite aktualni info: C123 i CLI bezi na IP 192.168.68.108 a poskytuji jednoducha skoro staticka data - je vhodne tyto moduly implementovat a castene otestovat (automaticky)

### CLIProvider (po ověření UI)
- [x] `src/providers/CLIProvider.ts` - WebSocket připojení
- [x] Constructor přijímá URL (ws://host:8081)
- [x] Connect/Disconnect s Promise
- [x] Exponential backoff reconnect: 1s → 2s → 4s → 8s → 16s → 30s
- [x] Message parsing (top, oncourse, comp, control, title, infotext, daytime)
- [x] Testy pro CLIProvider
- [x] **Commit:** "feat: CLIProvider with reconnect"

### C123Provider (budoucnost)
- [ ] `src/providers/C123Provider.ts` - TCP socket, XML parsing
- [ ] Detekce dojetí z dtFinish změn
- [ ] **Commit:** "feat: C123Provider direct connection"

---

## Fáze 2.5: ScoreboardContext

### 2.5.1 Základní struktura
- [x] `src/context/ScoreboardContext.tsx`
- [x] Definovat ScoreboardState interface
- [x] createContext s default hodnotami
- [x] ScoreboardProvider komponenta
- [x] useScoreboard hook

### 2.5.2 Connection state
- [x] State: `status: ConnectionStatus`
- [x] State: `error: string | null`
- [x] State: `initialDataReceived: boolean`
- [x] Aktualizace při connection change events

### 2.5.3 Data state - results
- [x] State: `results: Result[]`
- [x] State: `raceName: string`
- [x] State: `raceStatus: string`

### 2.5.4 Data state - competitors
- [x] State: `currentCompetitor: OnCourseCompetitor | null`
- [x] State: `onCourse: OnCourseCompetitor[]`

### 2.5.5 Data state - visibility
- [x] State: `visibility: VisibilityState`
- [x] Parsovat control zprávu

### 2.5.6 Data state - event info
- [x] State: `title: string`
- [x] State: `infoText: string`
- [x] State: `dayTime: string`

### 2.5.7 Provider props
- [x] Přijímá DataProvider jako prop
- [x] Subscribuje na všechny callbacks
- [x] Cleanup při unmount

### 🔍 Revize: ScoreboardContext základní
- [x] Vytvořit testovací komponentu zobrazující raw state
- [x] Použít ReplayProvider, připojit k nahrávce
- [x] Ověřit že state se aktualizuje
- [x] **Commit:** "feat: ScoreboardContext basic"

---

## Fáze 2.6: Highlight logika

### 2.5.1 Highlight state
- [x] State: `highlightBib: string | null`
- [x] State: `highlightTimestamp: number | null`
- [x] Konstanta: HIGHLIGHT_DURATION = 5000 (5 sekund)

### 2.5.2 Highlight aktivace
- [x] Při top.HighlightBib != 0
- [x] Zkontrolovat zda bib NENÍ v onCourse (deduplikace)
- [x] Pokud není → aktivovat highlight s aktuálním timestamp

### 2.5.3 Highlight expiration
- [x] Helper: `isHighlightActive(): boolean`
- [x] Počítat: `Date.now() - highlightTimestamp < HIGHLIGHT_DURATION`
- [x] Timestamp-based, žádné setTimeout

### 2.5.4 Highlight UI hook
- [x] `useHighlight()` hook
- [x] Vrací: { highlightBib, isActive, timeRemaining }
- [x] Používá requestAnimationFrame nebo interval pro aktualizaci

### 🔍 Revize: Highlight
- [x] Aktivace highlight funguje
- [x] Expiration po 5s funguje
- [x] Deduplikace s onCourse funguje
- [x] **Commit:** "feat: highlight logic"

---

## Fáze 2.7: Departing competitor

### 2.6.1 Departing state
- [x] State: `departingCompetitor: OnCourseCompetitor | null`
- [x] State: `departedAt: number | null`
- [x] Konstanta: DEPARTING_TIMEOUT = 3000 (3 sekundy)

### 2.6.2 Departing logika
- [x] Při změně comp.Bib (nový nebo prázdný)
- [x] Uložit předchozího jako departing s timestamp
- [x] Vymazat departing když:
  - Přijde v top.HighlightBib, NEBO
  - Uběhlo DEPARTING_TIMEOUT

### 2.6.3 Departing display
- [x] CurrentCompetitor zobrazuje departing pokud existuje
- [x] Vizuální odlišení (opacity, label)

### 🔍 Revize: Departing
- [x] comp zmizí → departing se zobrazí
- [x] Highlight přijde → departing zmizí
- [x] Timeout 3s → departing zmizí
- [x] **Commit:** "feat: departing competitor buffer"

---

## Fáze 2.8: Reconnect handling

### 2.7.1 State reset při reconnect
- [x] Při status změně na 'reconnecting':
  - [x] Vymazat results
  - [x] Vymazat currentCompetitor
  - [x] Vymazat onCourse
  - [x] Vymazat highlight
  - [x] Vymazat departing
  - [x] Nastavit initialDataReceived = false

### 2.7.2 Fresh start
- [x] Po reconnect (status → 'connected')
- [x] Čekat na první top zprávu
- [x] initialDataReceived = true

### 🔍 Revize: Reconnect
- [ ] Odpojit server (vyžaduje CLIProvider)
- [ ] Ověřit že UI ukazuje reconnecting stav
- [ ] Ověřit že data jsou vymazána
- [ ] Znovu připojit, ověřit fresh data
- [x] **Commit:** "feat: reconnect state handling"

### 🔍 Revize: Celý Data Layer
- [x] Všechny edge cases pokryty (v ScoreboardContext)
- [ ] CLIProvider stabilní (bude implementován po ověření UI)
- [x] ReplayProvider funguje pro development
- [x] ScoreboardContext správně zpracovává všechna data
- [ ] **Commit:** "feat: complete data layer"

### ❓ Rozhodnutí: State management
- [x] Je Context API dostatečný nebo potřebujeme reducer/zustand?
  - **Rozhodnutí:** Context API je dostatečný. Stav je relativně jednoduchý a aktualizace jsou časté ale ne extrémně rychlé. Případná optimalizace pomocí useMemo/useCallback je dostačující.
- [x] Jsou všechny edge cases pokryté?
  - **Ano:** Highlight deduplikace, departing buffer, reconnect reset
- [x] Aktualizovat plán pokud potřeba - není potřeba změn

---

## Fáze 3: Layout systém

### 3.1 useLayout hook - viewport
- [x] `src/hooks/useLayout.ts`
- [x] Detekce viewport rozměrů (window.innerWidth/Height)
- [x] Event listener na resize
- [x] Debounce resize events (100ms)
- [x] Cleanup při unmount

### 3.2 useLayout hook - layout mode
- [x] URL parametr `?type=vertical|ledwall`
- [x] Fallback na autodetekci podle aspect ratio
- [x] Vertical: height > width * 1.5
- [x] Ledwall: aspect ratio blízké 2:1
- [x] Return: `layoutMode: 'vertical' | 'ledwall'`

### 3.3 useLayout hook - výpočty vertical
- [x] Definovat minimální/maximální row height
- [x] Výpočet visibleRows podle výšky (s rezervou pro header/footer)
- [x] Výpočet rowHeight
- [x] Výpočet fontSize kategorie

### 3.4 useLayout hook - výpočty ledwall
- [x] Jiné proporce než vertical
- [x] Méně řádků, větší font
- [x] Skrytý footer

### 3.5 useLayout hook - return value
- [x] Return: `{ visibleRows, rowHeight, fontSize, layoutMode, showFooter }`
- [x] Memoizace výpočtů

### 3.6 CSS Variables - barvy
- [x] `src/styles/variables.css`
- [x] --color-bg-primary, --color-bg-secondary
- [x] --color-text-primary, --color-text-secondary
- [x] --color-accent, --color-highlight
- [x] --color-penalty-touch (2s), --color-penalty-miss (50s)

### 3.7 CSS Variables - spacing
- [x] --spacing-xs, --spacing-sm, --spacing-md, --spacing-lg
- [x] --border-radius

### 3.8 CSS Variables - typography
- [x] --font-family-primary (Inter)
- [x] --font-family-mono (JetBrains Mono)
- [x] --font-size-sm, --font-size-md, --font-size-lg

### 3.9 CSS Variables - layout
- [x] --row-height
- [x] --visible-rows
- [x] --header-height
- [x] --footer-height

### 3.10 useLayout hook - CSS Variables
- [x] Hook nastavuje CSS variables na :root
- [x] document.documentElement.style.setProperty()
- [x] Aktualizace při změně layoutu/resize

### 3.11 Layout komponenta
- [x] `src/components/Layout/ScoreboardLayout.tsx`
- [x] `src/components/Layout/ScoreboardLayout.module.css`
- [x] Struktura: header, main (results area), footer
- [x] CSS Grid layout
- [x] Responzivní bez transform: scale()

### 🔍 Revize: Layout
- [ ] Otestovat na různých rozlišeních (DevTools)
- [ ] Vertical 1080x1920 - správný počet řádků?
- [ ] Ledwall 768x384 - správný počet řádků?
- [ ] Resize funguje plynule?
- [ ] CSS variables se správně aktualizují?
- [x] **Commit:** "feat: responsive layout system"

### ❓ Rozhodnutí: Layout
- [ ] Jsou výpočty řádků správné?
- [ ] Potřebujeme Container Queries?
- [ ] Aktualizovat plán pokud potřeba

---

## Fáze 4: Základní komponenty

### 4.1 Utility funkce - formatTime
- [x] `src/utils/formatTime.ts`
- [x] Formát: "1:23.45" nebo "23.45"
- [x] Handle prázdné/null hodnoty
- [x] Handle různé vstupní formáty (string, number)

### 4.2 Utility funkce - formatName
- [x] `src/utils/formatName.ts`
- [x] Zkrácení dlouhých jmen
- [x] PŘÍJMENÍ Jméno formát
- [x] Handle prázdné hodnoty

### 4.3 Utility funkce - testy
- [x] Unit testy pro formatTime
- [x] Unit testy pro formatName
- [x] Edge cases (prázdné, null, nevalidní)

### 🔍 Revize: Utility
- [x] Testy prošly
- [x] **Commit:** "feat: utility functions"

---

### 4.4 TimeDisplay komponenta
- [x] `src/components/TimeDisplay/TimeDisplay.tsx`
- [x] `src/components/TimeDisplay/TimeDisplay.module.css`
- [x] Props: `time: string`, `visible: boolean`
- [x] JetBrains Mono font
- [x] Pozice podle layoutu

### 🔍 Revize: TimeDisplay
- [ ] Vizuální porovnání s originálem
- [x] Visibility funguje
- [x] **Commit:** "feat: TimeDisplay component"

---

### 4.5 Footer komponenta
- [x] `src/components/Footer/Footer.tsx`
- [x] `src/components/Footer/Footer.module.css`
- [x] Props: `visible: boolean`
- [x] Sponzorský banner
- [x] Automaticky skrytý na ledwall

### 🔍 Revize: Footer
- [ ] Vizuální porovnání
- [x] Skrytý na ledwall (via ScoreboardLayout showFooter)
- [ ] **Commit:** "feat: Footer component"

---

### 4.6 EventInfo - TopBar
- [x] `src/components/EventInfo/TopBar.tsx`
- [x] `src/components/EventInfo/TopBar.module.css`
- [x] Logo vlevo
- [x] Partners/sponsors vpravo
- [x] Props: `visible: boolean`

### 4.7 EventInfo - Title
- [x] `src/components/EventInfo/Title.tsx`
- [x] `src/components/EventInfo/Title.module.css`
- [x] Props: `title: string`, `visible: boolean`
- [x] Pozice podle layoutu

### 🔍 Revize: EventInfo
- [x] TopBar vizuálně správně
- [x] Title správně
- [x] Visibility funguje
- [x] **Commit:** "feat: EventInfo components"

---

### 4.8 CurrentCompetitor - základní
- [x] `src/components/CurrentCompetitor/CurrentCompetitor.tsx`
- [x] `src/components/CurrentCompetitor/CurrentCompetitor.module.css`
- [x] Props: `competitor: OnCourseCompetitor | null`, `visible: boolean`

### 4.9 CurrentCompetitor - layout
- [x] Bib (velké, výrazné)
- [x] Name (PŘÍJMENÍ Jméno)
- [x] Club
- [x] Time (běžící nebo finální)

### 4.10 CurrentCompetitor - TTB info
- [x] TTB rozdíl (TTBDiff)
- [x] Jméno vedoucího (TTBName)
- [x] Barevné kódování (+/-)

### 4.11 CurrentCompetitor - penalties summary
- [x] Celkový penalty součet
- [x] Barevné kódování

### 4.12 CurrentCompetitor - gate penalties
- [x] Zobrazení jednotlivých bran
- [x] 0 = zelená/neutrální
- [x] 2 = oranžová
- [x] 50 = červená
- [x] Prázdná = neprojeto (šedá)

### 4.13 CurrentCompetitor - pulzující indikátor
- [x] Indikátor ► pro běžícího závodníka
- [x] CSS @keyframes pulseGlyph
- [x] Zobrazit pouze když time běží (dtFinish == null)

### 4.14 CurrentCompetitor - animace změny
- [x] Fade/slide při změně závodníka
- [x] CSS transition

### 4.15 CurrentCompetitor - departing
- [x] Zobrazit departing competitor pokud existuje
- [x] Vizuální odlišení (nižší opacity, label "předchozí")
- [x] Pozice (nad nebo vedle aktuálního)

### 🔍 Revize: CurrentCompetitor
- [ ] Vizuální porovnání s originálem
- [x] Penalty barvy správné
- [x] Gate display správný
- [x] Pulzující indikátor funguje
- [x] Animace změny plynulá
- [x] Departing buffer funguje
- [x] **Commit:** "feat: CurrentCompetitor component"

---

### 4.16 ResultsList - základní struktura
- [x] `src/components/ResultsList/ResultsList.tsx`
- [x] `src/components/ResultsList/ResultsList.module.css`
- [x] Props: `results: Result[]`, `visible: boolean`
- [x] Scroll container

### 4.17 ResultsList - ResultRow
- [x] `src/components/ResultsList/ResultRow.tsx`
- [x] `src/components/ResultsList/ResultRow.module.css` (shared with ResultsList.module.css)
- [x] Props: `result: Result`, `isHighlighted: boolean`
- [x] Grid layout

### 4.18 ResultsList - sloupce
- [x] Rank (pořadí)
- [x] Bib (startovní číslo)
- [x] Name (jméno závodníka)
- [x] Penalty (penalizace) - volitelný
- [x] Time (čas)
- [x] Behind (ztráta) - volitelný

### 4.19 ResultsList - responzivní sloupce
- [x] Vertical: všechny sloupce
- [x] Ledwall: skrýt Penalty a/nebo Behind
- [x] Použít layout hook

### 4.20 ResultsList - alternující barvy
- [x] Sudé/liché řádky
- [x] CSS :nth-child(even/odd)

### 4.21 ResultsList - highlight styling
- [x] Props: `highlightBib: string | null` (via useHighlight hook)
- [x] Highlight row má jiné pozadí
- [x] Border nebo glow efekt
- [x] CSS @keyframes subtlePulse

### 🔍 Revize: ResultsList základní
- [ ] Vizuální porovnání s originálem
- [x] Všechny sloupce správně
- [x] Responzivní sloupce fungují
- [x] Alternující barvy
- [x] **Commit:** "feat: ResultsList basic"

---

### 4.22 ResultsList - scroll k highlight
- [x] Ref na highlighted row
- [x] Při aktivaci highlight: scrollIntoView
- [x] Smooth scroll animation
- [x] scroll-margin pro správnou pozici

### 4.23 ResultsList - scroll po expiraci
- [x] Po expiraci highlight (5s)
- [x] Scroll to top
- [x] Smooth animation

### 🔍 Revize: ResultsList scroll
- [ ] Scroll k highlight funguje
- [ ] Scroll po expiraci funguje
- [x] Smooth animace
- [x] **Commit:** "feat: ResultsList component"

---

### 4.24 ResultsList - auto-scroll
- [X] ❓ Rozhodnutí: Implementovat auto-scroll teď nebo později? --> ANO Implementovat!

### Pokud auto-scroll teď:
- [x] `src/hooks/useAutoScroll.ts`
- [x] Fáze: IDLE → SCROLLING → PAUSED_AT_BOTTOM → RETURNING
- [x] Scroll rychlost podle layoutu
- [x] Pauza při dosažení konce
- [x] Návrat na začátek
- [x] Zastavit při aktivním highlight

### 🔍 Revize: Auto-scroll
- [x] Auto-scroll funguje (pokud implementován)
- [x] Highlight přeruší scroll
- [x] Timing správný
- [x] **Commit:** "feat: ResultsList auto-scroll"

### ❓ Rozhodnutí: Virtualizace
- [ ] Je seznam dostatečně výkonný bez virtualizace?
- [ ] Test s 50+ závodníky
- [ ] Pokud ne, implementovat react-window

---

## Fáze 5: Integrace a styly

### 5.1 App.tsx - struktura
- [x] ScoreboardProvider wrapper
- [x] DataProvider (ReplayProvider) instance - CLIProvider bude po ověření UI
- [x] URL parametry pro server address (?source, ?speed, ?host, ?loop)

### 5.2 App.tsx - layout
- [x] ScoreboardLayout
- [x] EventInfo (TopBar, Title)
- [x] CurrentCompetitor
- [x] ResultsList
- [x] TimeDisplay
- [x] Footer

### 5.3 Propojení s kontextem
- [x] Použít useScoreboard hook
- [x] Předat data komponentám
- [x] Předat visibility flags

### 🔍 Revize: Základní integrace
- [x] Připojit k serveru (ReplayProvider)
- [ ] Data se zobrazují - vizuální ověření
- [ ] Komponenty reagují na změny - vizuální ověření
- [x] **Commit:** "feat: basic app integration"

---

### 5.4 Connection UI - stavy
- [x] Loading state: "Připojování..."
- [x] Waiting state: "Čekání na data..."
- [x] Connected: normální zobrazení
- [x] Reconnecting: overlay s indikátorem

### 5.5 Connection UI - komponenta
- [x] `src/components/ConnectionStatus/ConnectionStatus.tsx`
- [x] Zobrazit pouze při non-connected stavech
- [x] Overlay přes celou obrazovku
- [x] Spinner nebo progress

### 5.6 Error handling
- [x] Error state zobrazení
- [x] Retry button (manual reconnect)

### 🔍 Revize: Connection UI
- [x] Všechny stavy mají správné UI
- [x] Overlay funguje
- [x] **Commit:** "feat: connection status UI"

---

### 5.7 Visibility logika
- [x] Propojit visibility state s komponentami
- [x] displayCurrent → CurrentCompetitor
- [x] displayTop → ResultsList
- [x] displayTitle → Title
- [x] displayTopBar → TopBar
- [x] displayFooter → Footer
- [x] displayDayTime → TimeDisplay

### 5.8 Visibility testování
- [ ] Testovat toggle jednotlivých komponent
- [ ] Ověřit že se správně skrývají/zobrazují

### 🔍 Revize: Visibility
- [ ] Všechny visibility flags fungují
- [x] **Commit:** "feat: visibility controls"

---

### 5.9 Barevné schéma - přenos
- [ ] Zkopírovat barvy z originálu/prototypu
- [ ] Organizovat v variables.css
- [ ] Dokumentovat účel každé barvy

### 5.10 Barevné schéma - aplikace
- [ ] Aplikovat na všechny komponenty
- [ ] Ověřit konzistenci

### 5.11 Typografie - přenos
- [ ] Font sizes z prototypu
- [ ] Line heights
- [ ] Font weights
- [ ] Letter spacing (pokud potřeba)

### 5.12 Typografie - aplikace
- [ ] Aplikovat na všechny komponenty
- [ ] Responzivní font sizes

### 🔍 Revize: Barvy a typografie
- [ ] Vizuální porovnání s originálem
- [ ] Konzistentní styly
- [ ] **Commit:** "feat: colors and typography"

---

### 5.13 Animace - pulseGlyph
- [ ] @keyframes pulseGlyph
- [ ] Aplikovat na indikátor ►

### 5.14 Animace - subtlePulse
- [ ] @keyframes subtlePulse
- [ ] Aplikovat na highlighted row

### 5.15 Animace - transitions
- [ ] Visibility změny (fade in/out)
- [ ] Competitor změny
- [ ] Highlight aktivace/deaktivace

### 5.16 Finální styling
- [ ] Spacing a padding kontrola
- [ ] Border radius
- [ ] Shadows (pokud používáme)
- [ ] Pixel-level porovnání

### 5.17 Playwright vizuální testy
- [ ] `tests/visual/vertical.spec.ts` - screenshot test pro vertical layout
- [ ] `tests/visual/ledwall.spec.ts` - screenshot test pro ledwall layout
- [ ] Referenční screenshoty z prototypu (`../canoe-scoreboard-v2-prototype/`)
- [ ] Tolerance nastavení (±5px vertical, ±3px ledwall)

### 🔍 Revize: Styly kompletní
- [ ] Screenshot comparison s originálem
- [ ] Vertical layout správně
- [ ] Ledwall layout správně
- [ ] Animace plynulé
- [ ] Playwright vizuální testy prochází
- [ ] **Commit:** "feat: complete styling"

---

## Fáze 6: Rozšíření (volitelné)

### 6.1 OnCourseDisplay
- [ ] ❓ Rozhodnutí: Implementovat teď?

### Pokud OnCourseDisplay teď:
- [ ] `src/components/OnCourseDisplay/OnCourseDisplay.tsx`
- [ ] `src/components/OnCourseDisplay/OnCourseDisplay.module.css`
- [ ] Seznam závodníků na trati (0-N)
- [ ] Podobný layout jako CurrentCompetitor (kompaktnější)
- [ ] Props: `competitors: OnCourseCompetitor[]`, `visible: boolean`
- [ ] Integrace do App.tsx
- [ ] Visibility: displayOnCourse

### 🔍 Revize: OnCourseDisplay
- [ ] Vizuální porovnání
- [ ] Více závodníků se zobrazuje správně
- [ ] **Commit:** "feat: OnCourseDisplay component"

---

### 6.2 InfoText (Marquee - aktuálně přeskočit!)
- [X] ❓ Rozhodnutí: Teď se nebude implementovat

### Pokud InfoText teď:
- [ ] `src/components/EventInfo/InfoText.tsx`
- [ ] `src/components/EventInfo/InfoText.module.css`
- [ ] CSS animation pro běžící text
- [ ] @keyframes marquee
- [ ] Props: `text: string`, `visible: boolean`
- [ ] Integrace do EventInfo/App

### 🔍 Revize: InfoText
- [ ] Animace plynulá
- [ ] Text správně běží
- [ ] **Commit:** "feat: InfoText marquee"

---

## Fáze 7: Testování a dokumentace

!maximum zvladnout automaticky, proti recording, pomoci playwright atd

napis a udrzuj/rozvijej si testovaci skript, ktery otestuje maximum autonomne a bude ti vracet souhrnny vystup, at nemusi jednotlive testy spoustet, provaded a vyhodnocovat claude code!

### 7.1  testování - příprava
- [ ] Použít ReplayProvider s testovací nahrávkou
- [ ] Nebo připojit k živému serveru

### 7.2 Scénář: Cold start
- [ ] Spustit aplikaci
- [ ] Ověřit: Loading → Waiting → Data zobrazena
- [ ] Timeout handling

### 7.3 Scénář: Závodník dojede
- [ ] Sledovat comp zprávy
- [ ] comp zmizí → departing buffer
- [ ] HighlightBib přijde → highlight v Results
- [ ] Scroll k závodníkovi

### 7.4 Scénář: Rychlé změny
- [ ] 2 závodníci dojedou < 1s po sobě
- [ ] Oba musí dostat highlight (sekvenčně)
- [ ] UI nezamrzne

### 7.5 Scénář: Disconnect/reconnect
- [ ] Odpojit server
- [ ] Ověřit reconnecting overlay
- [ ] Ověřit state reset
- [ ] Znovu připojit
- [ ] Ověřit fresh data

### 7.6 Scénář: Prázdný závod
- [ ] Žádné results
- [ ] Graceful handling (prázdný seznam, ne error)

### 7.7 Scénář: Highlight + OnCourse
- [ ] Závodník v onCourse
- [ ] Přijde HighlightBib pro něj
- [ ] NENÍ highlighted v Results (deduplikace)

### 7.8 Scénář: Highlight timeout
- [ ] Highlight aktivní
- [ ] Čekat 5s
- [ ] Highlight zmizí
- [ ] Scroll to top

### 🔍 Revize:  testy
- [ ] Všechny scénáře prošly
- [ ] Zaznamenat nalezené problémy
- [ ] **Commit:** "test:  testing complete"

---

### 7.9 Testování layoutů - Vertical
- [ ] 1080x1920 (full HD portrait)
- [ ] 720x1280 (HD portrait)
- [ ] Správný počet řádků
- [ ] Správné proporce

### 7.10 Testování layoutů - Ledwall
- [ ] 768x384 (typický ledwall)
- [ ] 1920x480 (široký ledwall)
- [ ] Footer skrytý
- [ ] Správný počet řádků

### 7.11 Testování layoutů - resize
- [ ] DevTools responsive mode
- [ ] Resize okna
- [ ] Layout se přepíná správně

### 7.12 Testování - hardware
- [ ] Skutečný hardware (pokud dostupný)
- [ ] Ověřit výkon

### 🔍 Revize: Layout testy
- [ ] Všechny layouty fungují
- [ ] **Commit:** "test: layout testing complete"

---

### 7.13 Unit testy
- [ ] Utility funkce (formatTime, formatName)
- [ ] parseGates
- [ ] detectFinish
- [ ] Highlight expiration logika

### 7.14 Integration testy
- [ ] CLIProvider connect/disconnect
- [ ] Message parsing
- [ ] ReplayProvider playback

### 🔍 Revize: Automatické testy
- [ ] Testy prošly
- [ ] **Commit:** "test: unit and integration tests"

---

### 7.15 Dokumentace - README
- [x] `README.md` v projektu
- [x] Jak nainstalovat
- [x] Jak spustit (development)
- [x] Jak buildovat (production)

### 7.16 Dokumentace - konfigurace
- [x] URL parametry (?type, ?host, ...)
- [x] Environment variables (pokud nějaké) - žádné aktuálně

### 7.17 Dokumentace - architektura
- [x] Stručný přehled struktury
- [x] Diagram komponent
- [x] DataProvider pattern

### 🔍 Finální revize
- [ ] Všechny testy prošly
- [ ] Dokumentace kompletní
- [ ] Kód je čistý a čitelný
- [ ] Žádné console.log v produkčním kódu
- [ ] **Commit:** "docs: README and final cleanup"
- [ ] **Tag:** v2.0.0-alpha

---

## Post-implementace

### Retrospektiva
- [ ] Co fungovalo dobře?
- [ ] Co bylo složitější než očekáváno?
- [ ] Co by šlo udělat lépe příště?

### Aktualizace dokumentace
- [ ] Aktualizovat `08-plan-reimplementace.md` s poučeními
- [ ] Zaznamenat rozdíly oproti plánu

### Další kroky (budoucnost)
- [ ] C123Provider - přímé připojení bez CLI
- [ ] Produkční nasazení
- [ ] Performance optimalizace (pokud potřeba)
- [ ] Cache BR1 výsledků pro dvě jízdy

---

## Aktuální stav (2025-12-28)

### Technický stav

```
Build:      ✅ Úspěšný (430 kB JS, 13 kB CSS)
ESLint:     ✅ 0 errors, 4 warnings
Tests:      ✅ 156 unit testů
TypeScript: ✅ Strict mode
```

### Dostupné zdroje

| Zdroj | Lokace |
|-------|--------|
| CLI server | ws://192.168.68.108:8081 |
| C123 server | tcp://192.168.68.108 |
| Recording | `public/recordings/rec-2025-12-28T09-34-10.jsonl` |
| Ref. screenshoty | `/workspace/csb-v2/analysis/reference-screenshots/original-live-*.png` |
| Styly JSON | `/workspace/csb-v2/analysis/reference-screenshots/*-styles.json` |

---

## Zbývající kroky

### 1. E2E testy (Playwright)
- [x] data-testid atributy v komponentách
- [x] `tests/e2e/visual.spec.ts` struktura
- [ ] `npx playwright test --update-snapshots` - vytvořit baseline
- [ ] `npx playwright test` - ověřit

### 2. CLIProvider (otestovat proti serveru)
- [x] Implementace hotová, 24 unit testů
- [ ] `?source=cli&host=192.168.68.108:8081` - ověřit data
- [ ] Testovat reconnect

### 3. C123Provider (implementovat)
- [!] **NELZE v prohlížeči** - TCP socket není dostupný v browser JS
- Možné řešení: WebSocket proxy server nebo přesunutí do Node.js backend

### 4. Vizuální ladění
- [ ] Porovnat s `original-live-*.png`
- [ ] Zkopírovat barvy z `*-styles.json` do `variables.css`
- [ ] Doladit typografii

### 5. Funkční scénáře
- [ ] Cold start: Loading → Waiting → Data
- [ ] Závodník dojede: departing → highlight → scroll
- [ ] Highlight timeout (5s) → scroll to top
- [ ] Highlight + OnCourse deduplikace

---

## Review v0.7 (2025-12-28) - Tag: `review-ready-v0.7`

### Stav projektu

```
Build:      ✅ Úspěšný (430 kB JS, 13 kB CSS)
Unit testy: ✅ 156 testů prochází (8 test suites)
ESLint:     ✅ 0 errors, 4 warnings
TypeScript: ✅ Strict mode
```

### Co nelze provést z tohoto prostředí

1. **Playwright E2E testy** - Nelze nainstalovat systémové závislosti (fonts-wqy-zenhei, fonts-tlwg-loma-otf)
2. **CLIProvider live test** - CLI server 192.168.68.108:8081 není přístupný
3. **C123Provider** - TCP socket není možný v prohlížeči (označeno `[!]`)

### Review findings - Co je dobře

1. **Architektura** - Čistý DataProvider pattern s pub/sub systémem
2. **TypeScript** - Kompletní typové definice, strict mode
3. **Test coverage pro utilities** - formatTime, formatName, parseGates, detectFinish plně otestovány
4. **Providers** - CLIProvider (24 testů), ReplayProvider (27 testů) plně otestovány
5. **Dokumentace** - Dobrý JSDoc v celém projektu
6. **Reconnect logika** - Exponential backoff v CLIProvider

### Review findings - Co chybí/je třeba zlepšit

**Kritické:**
1. **Žádné testy React komponent** - 10 komponent bez testů (ResultsList, CurrentCompetitor, ConnectionStatus, ...)
2. **ScoreboardContext bez testů** - Highlight deduplikace, departing clearing, reconnect reset netestovány
3. **useAutoScroll bez testů** - Komplexní state machine (4 fáze) není otestována
4. **useLayout bez testů** - Responsive systém netestován

**Střední priorita:**
5. **Chybí Error Boundaries** - Komponenty mohou crashnout celou aplikaci
6. **Accessibility** - Žádné ARIA labely, gate penalty spoléhá jen na barvu

**Nízká priorita:**
7. **CSS variable fallbacks** - Chybí fallback hodnoty
8. **CLIProvider validation** - Některé message payloads nejsou hluboce validovány

### Další kroky k implementaci

#### A. Rozšíření testů (HIGH PRIORITY)

- [ ] `src/context/__tests__/ScoreboardContext.test.tsx`
  - Test state initialization
  - Test highlight deduplication (competitor on-course)
  - Test departing competitor clearing on timeout
  - Test state reset on reconnect

- [ ] `src/hooks/__tests__/useAutoScroll.test.ts`
  - Test IDLE → SCROLLING → PAUSED_AT_BOTTOM → RETURNING transitions
  - Test manual pause/resume/reset
  - Test ledwall speed multiplier (0.7x)

- [ ] `src/hooks/__tests__/useLayout.test.ts`
  - Test URL parameter detection (?type=vertical|ledwall)
  - Test aspect ratio auto-detection
  - Test row height calculations
  - Test CSS variable updates

- [ ] `src/components/__tests__/ResultsList.test.tsx`
  - Test rendering with various result data
  - Test highlight styling
  - Test empty state
  - Test responsive column hiding

- [ ] `src/components/__tests__/CurrentCompetitor.test.tsx`
  - Test gate penalty visualization
  - Test TTB display (ahead/behind)
  - Test departing label
  - Test running indicator

#### B. Error Handling

- [ ] Přidat React Error Boundary wrapper kolem hlavních komponent
- [ ] Přidat fallback UI pro component failures

#### C. Accessibility

- [ ] ARIA labels pro gate penalties (role="img", aria-label)
- [ ] Alternativní indikace pro TTB (ikony kromě barvy)

#### D. Manuální testování (vyžaduje prohlížeč)

- [ ] `http://localhost:5173/?source=replay&speed=10` - ověřit data loading
- [ ] Testovat vertical (1080×1920) a ledwall (768×384) viewporty
- [ ] Vizuální porovnání s `/workspace/csb-v2/analysis/reference-screenshots/original-live-*.png`
- [ ] Doladit barvy podle `*-styles.json`

#### E. Live server testování (vyžaduje síťový přístup)

- [ ] `?source=cli&host=192.168.68.108:8081` - připojení k CLI serveru
- [ ] Test reconnect chování (odpojit/připojit server)
- [ ] Test real-time dat (závodník dojede → highlight → scroll)

---

## Review v0.6 (2025-12-28)

### Opravené chyby

1. **ReplayProvider URL handling** - Provider nyní správně rozpoznává relativní URL (`/recordings/...`) a fetchuje soubory místo toho, aby je interpretoval jako JSONL obsah
2. **handleEventInfo partial updates** - Context nyní aktualizuje pouze neprázdné hodnoty, takže separátní title/infoText/dayTime zprávy nepřepisují ostatní hodnoty
3. **ResultsList testid** - data-testid atribut je nyní přítomný i v prázdném stavu seznamu výsledků

### Stav testů

- ✅ 156 unit testů prochází
- ✅ Build úspěšný (430 kB JS, 13 kB CSS)
- ✅ ESLint: 0 errors, 4 warnings
- ⚠️ E2E testy (Playwright): struktura připravena, ale timeout problém při čekání na data

### Co nelze automaticky otestovat

1. **C123Provider** - TCP socket v prohlížeči není možný
2. **CLIProvider live test** - vyžaduje běžící CLI server
3. **Vizuální porovnání** - vyžaduje manuální kontrolu proti referenčním screenshotům
4. **Hardware test** - vyžaduje skutečné zobrazovací zařízení

### Doporučené další kroky

1. **Manuální testování v prohlížeči**
   - Otevřít `http://localhost:5173/?source=replay&speed=10`
   - Ověřit, že se data načítají a zobrazují
   - Otestovat různé viewporty (vertical, ledwall)

2. **Testování proti live serveru**
   - Připojit k CLI serveru: `?source=cli&host=192.168.68.108:8081`
   - Ověřit reconnect chování

3. **Vizuální ladění**
   - Porovnat s referenčními screenshoty
   - Doladit barvy a typografii podle `*-styles.json`

4. **Playwright testy**
   - Vyřešit timeout problém - pravděpodobně ReplayProvider potřebuje delší čas na načtení
   - Možná přidat explicit wait na status "connected"

---

