# Deníček vývoje - Canoe Scoreboard V3

Chronologický záznam vývoje, zjištění a řešení problémů.

---

## 2025-01-03 - Plán a Bloky T1-T3

- Navržena architektura pro automatické srovnání výstupů providerů
- Mock TCP server simulující Canoe123 (čte nahrávku, posílá TCP data)
- Mock WS server pro CLI replay
- Test: CLI 34 results, 1042 onCourse; C123 8 results, 756 onCourse

---

## 2026-01-03 - Oprava mock TCP protokolu

- Přidán pipe delimiter (`|`) mezi XML zprávy (Canoe123 protokol)
- Přidán 3s delay před replayem
- C123 nyní sbírá data správně

---

## 2026-01-03 - Oprava raceName mapperu

**Problém:** CLI "K1m - střední trať - 2. jízda", C123 jen "K1m - střední trať"

**Řešení:** `buildRaceName()` extrahuje BR1/BR2 suffix z raceId

---

## 2026-01-04 - Playwright testy

- Vizuální srovnání CLI vs C123
- CLI: 20 rows (scrollující), C123: 105 rows (všechny)
- Rozdíly očekávané

---

## 2026-01-04 - raceStatus mapper

**Problém:** C123 vracel "3"/"5" místo "In Progress"/"Unofficial"

**Řešení:** Human-readable hodnoty v mapperu

---

## 2026-01-04 - Unit testy

- 21 testů c123ServerMapper
- 31 testů C123ServerProvider
- Celkem 566 unit testů

---

## 2026-01-04 - Blok 5 (REST sync)

- XmlChange handling s checksum deduplication
- Sync state po reconnect přes REST API

---

## 2026-01-04 - Blok 7 (WebSocket opravy)

- Fix React StrictMode - deduplikace connect volání
- Probe timeout 3000ms pro explicitní/cached servery
- Nový design DiscoveryScreen

---

## 2026-01-04 - Blok 8 (OnCourse/Results flow)

**Problém:** Závodníci na trati mizeli

**Řešení:** Filtrovat závodníky bez dtStart

- Přidán raceId tracking - Results filtrovány podle activeRaceId

---

## 2026-01-04 - Blok 9 (Highlight, DNS/DNF, title)

- **Highlight:** Změna z total porovnání na timestamp-based detekci
- **DNS/DNF/DSQ:** Status field + detekce z dat
- **Title:** Fetch eventName z `/api/discover`

---

## 2026-01-04 - Live testing feedback

- DNS/DNF/DSQ: změnit na nevýrazný styl (ne červeně tučně)
- Nedopočítávat DNS/DNF - pokud není v datech, zobrazit `---`
- Flow: při změně kategorie schovat výsledky předchozí
- OnCourse blikání: zobrazit jen jezdce nejblíže cíli
- Title: ověřit přidávání kategorie, dopsat TODO pro C123 server

---

## 2026-01-04 - Blok 10.1-10.3 (vizuální opravy)

- **10.1:** Styl DNS/DNF/DSQ změněn na nevýrazný (šedá, italic, opacity)
- **10.2:** Odstraněna inference statusu, prázdný čas = `---`
- **10.3:** Results se mažou při změně kategorie (activeRaceId)

---

## 2026-01-04 - Blok 10.5 (title v záhlaví)

- **10.5:** Title komponenta zobrazí kategorii jako fallback když chybí eventName
- Formát: "TITLE: CATEGORY" nebo jen "CATEGORY" pokud není title

---

## 2026-01-04 - Blok 10.4 VYŘEŠENO

**Problém:** C123 server posílá OnCourse zprávy střídavě (bib 10, pak bib 11) - každá zpráva jen jeden závodník.

**Tři opravené problémy:**

1. **Poblikávání s neodstartovaným závodníkem:**
   - Zpráva o neodstartovaném (bez dtStart) způsobovala `updateOnCourse: true`
   - Fix: `isPartialMessage = total > activeCompetitors.length` (i pro prázdné)

2. **Okamžité zmizení dojetého závodníka:**
   - Závodník s dtFinish zmizel okamžitě bez grace period
   - Fix: dtFinish filtrováno jen pro výběr `current`, ne pro `onCourse` seznam

3. **Závodník nikdy nezmizí (3+ na trati):**
   - S partial messages závodník s dtFinish zůstal navždy
   - Fix: Grace period tracking (`onCourseFinishedAt: Record<bib, timestamp>`)
   - Po 5 sekundách od dtFinish závodník odstraněn

**Klíčový insight:** Rozdíl mezi 2→1 (full message) a 3→2 (partial messages).

**Soubory:**
- `constants.ts`: `FINISHED_GRACE_PERIOD = 5000`
- `c123ServerMapper.ts`: Opravená detekce partial messages
- `ScoreboardContext.tsx`: Grace period logika + filtrování pro current

---

## 2026-01-04 - Fáze E dokončena (Bloky 11-14)

**Shrnutí Fáze E - Opevnění a stabilizace:**

- **Blok 11:** Commitnutí změn + ESLint opravy (queueMicrotask pro sync setState)
- **Blok 12:** 37 nových testů pro partial OnCourse, DNS/DNF/DSQ, category flow, Title
- **Blok 13:** Code review - všechny soubory čisté, žádný mrtvý kód, konzistentní typy
- **Blok 14:** Dokumentace - CLAUDE.md rozšířen o architekturu, konstanty, troubleshooting

**Celkový stav po Fázi E:**
- 603 testů prochází
- 0 ESLint errors (3 warnings - fast refresh, neovlivňuje produkci)
- Build úspěšný
- Dokumentace aktuální

---

## Naučené lekce

1. **Partial messages z C123 serveru** vyžadují merge logiku, ne nahrazení
2. **Grace period pro dtFinish** je klíčová pro UX při více závodníkách na trati
3. **Timestamp-based highlight** je robustnější než diff-based
4. **React StrictMode double-mount** vyžaduje deduplikaci connect volání

---

## 2026-01-04 - Fáze F: Analýza a plán

- **Cíl:** BR1/BR2 merge zobrazení - kombinované výsledky z obou jízd
- **C123 Server:** REST endpoint `/api/xml/races/:id/results?merged=true` již existuje!
- **Scoreboard:** Potřebuje implementaci (5 bloků)
- **Rozhodnutí:** Unified view (varianta B) - rozšíření existujícího ResultsList o extra sloupce
- Podrobný plán rozdělen do bloků F1-F5

---

## 2026-01-05 - Fáze G dokončena: BR1/BR2 merge zobrazení

**Implementováno:**

1. **G1: Typy a utility**
   - `raceUtils.ts`: `isBR2Race()`, `isBR1Race()`, `getClassId()`, `getOtherRunRaceId()`
   - `Result` typ rozšířen o `run1`, `run2`, `bestRun`

2. **G2: REST fetch a merge logika**
   - `C123ServerApi`: `getMergedResults(raceId)` - fetch z REST API
   - `br1br2Merger.ts`: `BR2Manager` class s debounced fetch (500ms)
   - `mergeBR1IntoBR2Results()`, `mergeBR1CacheIntoBR2Results()`

3. **G3: C123ServerProvider integrace**
   - `BR2Manager` instancován při startu provideru
   - `processResults()` automaticky merguje BR1 data při BR2 závodech
   - Cache BR1 dat pro rychlou odezvu

4. **G4: UI komponenty**
   - `ResultRow`: `RunTimeCell` komponenta pro BR1/BR2 sloupce
   - CSS: `.br2Row` grid layout, `.worseRun` opacity styling
   - Ledwall: skryty penalizace při BR2 (mohou být z jiné jízdy)
   - Vertical: dva sloupce (BR1, BR2) s vizuálním rozlišením lepší/horší

5. **G5: Testy**
   - Unit testy pro raceUtils (45 testů)
   - Unit testy pro br1br2Merger (12 testů)
   - Celkem 672 testů, všechny prochází

**Klíčová zjištění:**
- TCP stream posílá `Total` = nejlepší z obou jízd (ne BR2 total!)
- BR1 data nutno fetchovat z REST API
- Debounce 500ms chrání před zahlcením API při rychlých Results zprávách

**Soubory:**
- `src/utils/raceUtils.ts` - BR1/BR2 utility funkce
- `src/providers/utils/br1br2Merger.ts` - BR2Manager + merge logika
- `src/providers/utils/c123ServerApi.ts` - REST API klient
- `src/components/ResultsList/ResultRow.tsx` - RunTimeCell pro BR2
- `src/components/ResultsList/ResultsList.module.css` - BR2 styly

---

## 2026-01-06 - Fáze J dokončena: Dokumentace

**Shrnutí Fáze J - Kompletní dokumentace:**

1. **J1: README.md** - Kompletní přepis uživatelské příručky
   - Quick start, instalace, konfigurace
   - Layout módy, data sources, deployment

2. **J2: docs/url-parameters.md** - Reference všech URL parametrů
   - Tabulka parametrů s typy a defaults
   - ConfigPush override chování

3. **J3: docs/configuration.md** - Remote konfigurace
   - ConfigPush, ClientState, ForceRefresh
   - Asset management, clientId flow

4. **J4: docs/data-providers.md** - Provider interface
   - C123ServerProvider, CLIProvider, ReplayProvider
   - Auto-discovery, reconnect logika

5. **J5: docs/components.md** - React komponenty
   - App, ScoreboardContext, ResultsList
   - Hooks dokumentace

6. **J6: docs/development.md** - Vývojářský průvodce
   - Setup, struktura, coding standards
   - Git workflow

7. **J7: Aktualizace existujících docs**
   - testing.md - rozšířeno o coverage, CI/CD, jak psát testy
   - architecture.md - doplněno o BR2Manager, raceUtils

**Celkový stav po Fázi J:**
- Kompletní uživatelská dokumentace (README.md)
- 7 dokumentů v docs/ složce
- 725 testů prochází
- Projekt připraven pro budoucí údržbu

---

## Uzavření vývoje V3

Canoe Scoreboard V3 je funkčně kompletní:

- **Plná kompatibilita s V2** - stejné zobrazení, stejná logika
- **BR1/BR2 merge** - nová funkcionalita zobrazující obě jízdy
- **ConfigPush** - remote konfigurace z C123 serveru
- **Asset management** - customizace log a bannerů
- **725+ testů** - robustní testovací pokrytí
- **Kompletní dokumentace** - pro uživatele i vývojáře
