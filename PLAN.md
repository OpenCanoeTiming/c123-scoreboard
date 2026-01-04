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

---

## TODO: Opravy z live testování

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

## Budoucí úkoly (po dokončení Fáze D)

### Fáze E: BR1/BR2 merge zobrazení
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

## Reference

| Dokumentace | Cesta |
|-------------|-------|
| C123 Server docs | `../c123-server/docs/` |
| Analýza | `../analysis/` |
| Nahrávky | `../analysis/recordings/` |
| V2 (READONLY) | `../canoe-scoreboard-v2/` |
