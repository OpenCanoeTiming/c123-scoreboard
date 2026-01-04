# Implementační plán: Canoe Scoreboard V3

## Stručný přehled

Real-time scoreboard pro kanoistické slalomové závody. Nová verze pracující s C123 Server jako primárním zdrojem dat, CLI jako fallback.

---

## Aktuální stav

| Fáze | Status |
|------|--------|
| Fáze A: Základní funkčnost | ✅ Hotovo |
| Fáze B: Automatické testování | ✅ Hotovo |
| Fáze C: REST sync a XmlChange | ✅ Hotovo |
| Fáze D: Opravy z live testování | ✅ Hotovo |
| Fáze E: Opevnění a stabilizace | 🔄 V průběhu |

---

## TODO: Fáze E - Opevnění a stabilizace

### Cíle fáze E

Zajistit stabilitu, kvalitu kódu a komplexní pokrytí testy před nasazením do produkce.

---

### Blok 11: Commitnutí a linting opravy ✅

#### 11.1 Commitnutí necommitovaných změn ✅
**Stav:** [x] Hotovo

**Změny commitnuty:**
- `src/components/ResultsList/ResultsList.module.css` - `position: relative` pro správný výpočet offsetTop
- `src/components/ResultsList/ResultsList.tsx` - oprava výpočtu výšky řádků (ROW_MARGIN)
- `src/hooks/useAutoScroll.ts` - ledwall overlap fix, přidán `layoutMode` do dependency array

#### 11.2 Oprava ESLint errorů ✅
**Stav:** [x] Hotovo

**Opravené chyby:**
- `useAutoScroll.ts` - všechny synchronní `setPhase` volání zabaleny do `queueMicrotask()`
- `tests/e2e/cli-functional.spec.ts` - odstraněna nepoužitá proměnná `page` z beforeEach

**Commit:** `fix: improve scroll calculation and fix ESLint errors` (5191027)

#### 11.3 ESLint warnings (nízká priorita)
**Stav:** [ ] Volitelné - ignorováno

**Warnings:**
- `ErrorBoundary.tsx:112` - fast refresh warning
- `ScoreboardContext.tsx:456, 632` - fast refresh warning (context v jednom souboru)

**Poznámka:** Tyto warnings neovlivňují produkční build, pouze dev hot reload. Ponecháno bez opravy.

---

### Blok 12: Doplnění testů ✅

#### 12.1 Testy pro partial OnCourse messages (C123) ✅
**Stav:** [x] Hotovo

**Scénáře pokryty:**
- [x] `mapOnCourse` - partial message (`total > competitors.length`) vrací `updateOnCourse: false`
- [x] `mapOnCourse` - prázdný competitors s `total > 0` je partial
- [x] `ScoreboardContext` - merge partial message do existujícího seznamu
- [x] `ScoreboardContext` - detekce finish z partial message

#### 12.2 Testy pro DNS/DNF/DSQ ✅
**Stav:** [x] Hotovo

**Scénáře pokryty:**
- [x] `mapResults` - status jen když není validní total
- [x] `mapResults` - ignoruje status když má validní čas
- [x] `mapResults` - normalizace lowercase na uppercase
- [x] `mapResults` - total "0" a "0.00" jako invalid

#### 12.3 Testy pro category change flow ✅
**Stav:** [x] Hotovo

**Scénáře pokryty:**
- [x] `ScoreboardContext` - vymaže results při změně activeRaceId
- [x] `ScoreboardContext` - filtruje Results podle targetRaceId
- [x] `ScoreboardContext` - použije lastActiveRaceId když nikdo není na trati

#### 12.4 Testy pro title display ✅
**Stav:** [x] Hotovo

**Scénáře pokryty:**
- [x] `Title` komponenta - zobrazí "TITLE: CATEGORY"
- [x] `Title` komponenta - fallback na jen CATEGORY když chybí title
- [x] `Title` komponenta - extrakce kategorie z raceName

**Commit:** `test: add tests for Block 12` (39f77ef)

---

### Blok 13: Code review a vyčištění ✅

#### 13.1 Review klíčových souborů ✅
**Stav:** [x] Hotovo

**Soubory k review:**
- [x] `C123ServerProvider.ts` - connection handling, reconnect logika
- [x] `c123ServerMapper.ts` - partial messages, status mapping
- [x] `ScoreboardContext.tsx` - reducer logika, grace period
- [x] `useAutoScroll.ts` - scroll phases, highlight detection

**Kritéria:**
- [x] Žádné TODO komentáře bez tracking issue
- [x] Dostatečné komentáře pro komplexní logiku
- [x] Konzistentní error handling
- [x] Žádné console.log v produkčním kódu (jen warn/error kde nutné)

**Výsledek:** Všechny soubory jsou čisté, dobře dokumentované, bez problémů.

#### 13.2 Odstranění mrtvého kódu ✅
**Stav:** [x] Hotovo

**Akce:**
- [x] Zkontrolovat nepoužívané exporty - žádné nalezeny
- [x] Odstranit zakomentovaný kód - žádný nalezen
- [x] Zkontrolovat nepoužívané importy - žádné nalezeny (TypeScript bez chyb)

#### 13.3 Konzistence typů ✅
**Stav:** [x] Hotovo

**Akce:**
- [x] Ověřit že všechny typy jsou exportované z `@/types` - OK
- [x] Žádné `any` typy v produkčním kódu - potvrzeno (0 výskytů)
- [x] Konzistentní pojmenování (camelCase pro proměnné, PascalCase pro typy) - OK

**Verifikace:**
- `npm run lint` - 0 errors, 3 warnings (fast refresh - neovlivňují produkci)
- `npm test` - 603 testů prošlo
- `npm run build` - úspěšný build

---

### Blok 14: Dokumentace a finalizace

#### 14.1 Aktualizace CLAUDE.md
**Stav:** [ ] TODO

**Akce:**
- [ ] Přidat sekci o architektuře C123 vs CLI provideru
- [ ] Dokumentovat klíčové konstanty a jejich význam
- [ ] Přidat troubleshooting sekci

#### 14.2 Aktualizace deníčku
**Stav:** [ ] TODO

**Akce:**
- [ ] Shrnout Fázi E
- [ ] Zaznamenat naučené lekce

#### 14.3 Finální testy
**Stav:** [ ] TODO

**Akce:**
- [ ] Spustit `npm test` - všechny testy prochází
- [ ] Spustit `npm run lint` - žádné errory
- [ ] Spustit `npm run build` - build prochází
- [ ] Manuální test proti nahrávce

---

## Archivované: Opravy z live testování (Fáze D)

### Blok 10: Vizuální a UX opravy

#### 10.1 DNS/DNF/DSQ zobrazení - oprava stylu ✅
**Problém:** DNS/DNF/DSQ jsou zobrazeny červeně tučně.

**Řešení:** Změněn styl na nevýrazný (šedá, italika, opacity 0.7).

#### 10.2 DNS/DNF bez dopočítávání ✅
**Problém:** Scoreboard se snaží dopočítávat DNS/DNF, pokud nejsou explicitně v datech.

**Řešení:** Odstraněna inference statusu, zobrazuje se `---` pro prázdný čas bez explicitního statusu.

#### 10.3 Flow: Schovat výsledky při změně kategorie ✅
**Problém:** Při jezdci z další kategorie zůstávají zobrazené výsledky z předchozí kategorie.

**Řešení:** V SET_ON_COURSE reducer se vymaže results při změně activeRaceId.

#### 10.4 OnCourse: Blikání jezdce na trati ✅
**Problém:** Když jsou dva závodníci na trati, blikají/střídají se. Jeden závodník "pohasíná".

**Příčina (zjištěná analýzou):** C123 server posílá OnCourse zprávy střídavě pro jednotlivé závodníky:
- Zpráva 1: `{total: 2, competitors: [závodník A]}`
- Zpráva 2: `{total: 2, competitors: [závodník B]}`
- Zpráva 3: `{total: 2, competitors: [závodník A]}` ...atd.

Každá zpráva obsahuje `total: 2` (dva na trati), ale pole `competitors` má jen jednoho závodníka.
Mapper vracel `updateOnCourse: true`, což nahrazovalo celý seznam → blikání.

**Řešení:**
- `c123ServerMapper.ts`: Detekce partial messages (`total > competitors.length`) → vrací `updateOnCourse: false` místo `true`
- `ScoreboardContext.tsx`: Pro partial messages merguje závodníka do existujícího seznamu (jako CLI `comp` zprávy)
- Přidáno filtrování závodníků s `dtFinish` (dokončili jízdu) při merge
- Detekce finish pro partial messages před filtrací (zachován highlight)

#### 10.5 Title v záhlaví akce ✅
**Problém:** Title v záhlaví nebyl zobrazen když chyběl eventName.

**Řešení:**
- [x] Kategorie se správně přidává k titlu (formát "TITLE: CATEGORY")
- [x] Fallback: pokud není eventName, zobrazí se jen kategorie
- [ ] C123 Server TODO: Naplnění eventName v API (řeší se separátně)

---

## Budoucí úkoly (po dokončení Fáze E)

### Fáze F: BR1/BR2 merge zobrazení
**Popis:** Zobrazení sloučených výsledků z obou jízd (Best Run).

**Požadavky:**
- [ ] REST API endpoint pro merged BR1/BR2 výsledky (C123 Server)
- [ ] Nový view mode nebo automatické rozpoznání BR2 závodů
- [ ] Zobrazení: čas BR1, čas BR2, nejlepší čas, celkové pořadí

**Priorita:** Střední - rozšíření funkcionality

---

### Volitelné úkoly (nice-to-have)

1. **Konfigurovatelný scroll** - rychlost, počet řádků, chování při highlight
2. **Statistiky závodníka** - historie jízd, porovnání s předchozími závody
3. **Multi-display** - různé pohledy na různých obrazovkách
4. **Offline mode** - cache výsledků pro offline prohlížení
5. **Export** - PDF/CSV export výsledků

---

## Architektura (referenční)

```
┌─────────────────────────────────────────────────────────────────┐
│                         SCOREBOARD V3                           │
├─────────────────────────────────────────────────────────────────┤
│  URL ?server=host:port (volitelné)                              │
│                                                                 │
│  1. Probe server → je to C123 Server?                           │
│     └── ANO: C123ServerProvider (primární)                      │
│     └── NE: CLIProvider (fallback)                              │
│                                                                 │
│  2. Pokud URL nezadáno:                                         │
│     └── localStorage cache                                      │
│     └── Autodiscover na síti                                    │
│     └── Manuální konfigurace                                    │
└─────────────────────────────────────────────────────────────────┘
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

## Testování

```bash
# Unit testy (566 testů)
npm test

# Integrační test CLI vs C123
npm run test:providers

# Vizuální testy Playwright
npm run test:visual

# Mock servery pro vývoj
npm run mock:tcp -- -f ../analysis/recordings/rec-2025-12-28T09-34-10.jsonl
npm run mock:ws -- -f ../analysis/recordings/rec-2025-12-28T09-34-10.jsonl
```

---

## Historie implementace (shrnutí)

### Dokončené fáze

**Fáze A: Základní funkčnost** ✅
- Discovery client + typy (Blok 1)
- Mappers + REST API (Blok 2)
- C123ServerProvider + App.tsx (Blok 3)

**Fáze B: Automatické testování** ✅
- Mock TCP/WS servery (Blok T1)
- Test utilities - EventCollector, Comparator (Blok T2)
- Integrační test (Blok T3)
- Playwright vizuální testy (Blok T4)
- Opravy nalezených rozdílů (Blok 4)

**Fáze C: Rozšíření** ✅
- REST sync a XmlChange handling (Blok 5)
- Unit testy (Blok 6)

**Fáze D: Live testing opravy** 🔄
- WebSocket a connection logika (Blok 7) ✅
- OnCourse a Results flow (Blok 8) ✅
- Highlight, DNS/DNF/DSQ, title (Blok 9) ✅
- Vizuální a UX opravy (Blok 10) ✅

---

## Deníček vývoje

### 2025-01-03 - Plán a Bloky T1-T3
- Navržena architektura pro automatické srovnání výstupů providerů
- Mock TCP server simulující Canoe123 (čte nahrávku, posílá TCP data)
- Mock WS server pro CLI replay
- Test: CLI 34 results, 1042 onCourse; C123 8 results, 756 onCourse

### 2026-01-03 - Oprava mock TCP protokolu
- Přidán pipe delimiter (`|`) mezi XML zprávy (Canoe123 protokol)
- Přidán 3s delay před replayem
- C123 nyní sbírá data správně

### 2026-01-03 - Oprava raceName mapperu
- **Problém:** CLI "K1m - střední trať - 2. jízda", C123 jen "K1m - střední trať"
- **Řešení:** `buildRaceName()` extrahuje BR1/BR2 suffix z raceId

### 2026-01-04 - Playwright testy
- Vizuální srovnání CLI vs C123
- CLI: 20 rows (scrollující), C123: 105 rows (všechny)
- Rozdíly očekávané

### 2026-01-04 - raceStatus mapper
- **Problém:** C123 vracel "3"/"5" místo "In Progress"/"Unofficial"
- **Řešení:** Human-readable hodnoty v mapperu

### 2026-01-04 - Unit testy
- 21 testů c123ServerMapper
- 31 testů C123ServerProvider
- Celkem 566 unit testů

### 2026-01-04 - Blok 5 (REST sync)
- XmlChange handling s checksum deduplication
- Sync state po reconnect přes REST API

### 2026-01-04 - Blok 7 (WebSocket opravy)
- Fix React StrictMode - deduplikace connect volání
- Probe timeout 3000ms pro explicitní/cached servery
- Nový design DiscoveryScreen

### 2026-01-04 - Blok 8 (OnCourse/Results flow)
- **Problém:** Závodníci na trati mizeli
- **Řešení:** Filtrovat závodníky bez dtStart
- Přidán raceId tracking - Results filtrovány podle activeRaceId

### 2026-01-04 - Blok 9 (Highlight, DNS/DNF, title)
- **Highlight:** Změna z total porovnání na timestamp-based detekci
- **DNS/DNF/DSQ:** Status field + detekce z dat
- **Title:** Fetch eventName z `/api/discover`

### 2026-01-04 - Live testing feedback
- DNS/DNF/DSQ: změnit na nevýrazný styl (ne červeně tučně)
- Nedopočítávat DNS/DNF - pokud není v datech, zobrazit `---`
- Flow: při změně kategorie schovat výsledky předchozí
- OnCourse blikání: zobrazit jen jezdce nejblíže cíli
- Title: ověřit přidávání kategorie, dopsat TODO pro C123 server

### 2026-01-04 - Blok 10.1-10.3 (vizuální opravy)
- **10.1:** Styl DNS/DNF/DSQ změněn na nevýrazný (šedá, italic, opacity)
- **10.2:** Odstraněna inference statusu, prázdný čas = `---`
- **10.3:** Results se mažou při změně kategorie (activeRaceId)

### 2026-01-04 - Blok 10.5 (title v záhlaví)
- **10.5:** Title komponenta zobrazí kategorii jako fallback když chybí eventName
- Formát: "TITLE: CATEGORY" nebo jen "CATEGORY" pokud není title

### 2026-01-04 - Blok 10.4 VYŘEŠENO
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

## Timing konstanty

Všechny timeouty a grace period používané ve scoreboardu.

### Přehled konstant

| Konstanta | Hodnota | Soubor | Účel |
|-----------|---------|--------|------|
| `HIGHLIGHT_DURATION` | 5 000 ms | `constants.ts` | Jak dlouho je výsledek zvýrazněn (žlutý řádek) |
| `DEPARTING_TIMEOUT` | 3 000 ms | `constants.ts` | Jak dlouho se zobrazuje "odcházející" závodník |
| `FINISHED_GRACE_PERIOD` | 5 000 ms | `constants.ts` | Jak dlouho závodník s dtFinish zůstane v onCourse |
| Pending highlight timeout | 10 000 ms | `ScoreboardContext.tsx` | Max čekání na Results po detekci dtFinish |

### Flow: Závodník dojede

```
Závodník na trati (dtStart)
         │
         ▼
    Dojede (dtFinish) ──────────────────────────────┐
         │                                          │
         ▼                                          ▼
  pendingHighlightBib = bib              Zůstává v onCourse
  pendingHighlightTimestamp = now()      (FINISHED_GRACE_PERIOD = 5s)
         │                                          │
         │                                          ▼
         │                               Po 5s zmizí z tratě
         │
         ▼
   Čeká na Results (max 10s)
         │
         ├─── Results přijdou ─────────────┐
         │                                  ▼
         │                         highlightBib = bib
         │                         Scroll k výsledku
         │                         departingCompetitor = null
         │                                  │
         │                                  ▼
         │                         HIGHLIGHT_DURATION (5s)
         │                         Žlutý řádek ve výsledcích
         │
         └─── Results nepřijdou do 10s ───► pendingHighlight vyprší
```

### Použití v kódu

- **`useHighlight.ts`**: `useTimestamp(highlightTimestamp, HIGHLIGHT_DURATION)`
- **`useDeparting.ts`**: `useTimestamp(departedAt, DEPARTING_TIMEOUT)`
- **`ScoreboardContext.tsx`**: Grace period filtrování v SET_ON_COURSE reducer
- **`ScoreboardContext.tsx:211`**: `pendingAge < 10000` v SET_RESULTS reducer

---

## Reference

| Dokumentace | Cesta |
|-------------|-------|
| C123 Server docs | `../c123-server/docs/` |
| Analýza | `../analysis/` |
| Nahrávky | `../analysis/recordings/` |
| V2 (READONLY) | `../canoe-scoreboard-v2/` |
