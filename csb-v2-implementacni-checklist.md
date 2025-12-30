# Canoe-Scoreboard-v2 - Implementační checklist

> **Souvislosti:**
> - Kompletní analýza: [../analysis/](../analysis/)
> - Plán reimplementace: [../analysis/08-plan-reimplementace.md](../analysis/08-plan-reimplementace.md)
> - Síťová komunikace: [../analysis/07-sitova-komunikace.md](../analysis/07-sitova-komunikace.md)
> - State management principy: [../analysis/03-state-management.md](../analysis/03-state-management.md)
> - Styly a layouty: [../analysis/06-styly.md](../analysis/06-styly.md)

---

## Jak používat tento checklist

- [ ] = Nesplněno
- [x] = Splněno
- [~] = Částečně / Vyžaduje revizi

**Cíl:** Vytvořit scoreboard vizuálně identický s originálem. Žádné "vylepšení" - replikace 1:1.

**Testovací rozlišení:**
- Ledwall: **768×384** (`?type=ledwall`)
- Vertical: **1080×1920**

---

## Fáze 0-10: Základ a vizuální shoda ✅

### Přehled dokončených fází

| Fáze | Obsah | Stav |
|------|-------|------|
| 0-1 | Příprava prostředí, scaffolding, typy | ✅ |
| 2 | DataProvider abstrakce (ReplayProvider, CLIProvider) | ✅ |
| 3 | Layout systém (useLayout, responsivita) | ✅ |
| 4 | Základní komponenty (TopBar, Title, ResultsList, Footer) | ✅ |
| 5 | Integrace a styly | ✅ |
| 6 | OnCourseDisplay, CurrentCompetitor | ✅ |
| 7-8 | Testování (unit, E2E, benchmarky) | ✅ |
| 9 | Vizuální shoda s originálem | ✅ |
| 10 | Finální testování a porovnání | ✅ |

### Aktuální stav

```
Build:       ✅ OK (437 kB JS, 19 kB CSS)
Unit testy:  ✅ 512 testů (25 test suites) - reduced from 570
E2E testy:   ✅ 87 passed, 39 skipped (CLI server tests)
Performance: ✅ FPS ~44, memory stable, load <1s
```

### Vizuální shoda ověřena (2025-12-29)

| Komponenta | Shoda |
|------------|-------|
| TopBar | ✅ 100% |
| Title | ✅ 100% |
| CurrentCompetitor | ✅ 100% |
| ResultsList | ✅ 100% |
| OnCourse | ✅ 100% |
| Footer | ✅ 100% |

Porovnání uloženo v `tests/e2e/comparison-screenshots/`.

---

## Fáze 11: Škálování ledwall (PROBÍHÁ)

> **Tag před implementací:** `pre-ledwall-scaling`
>
> **Požadavek:** Ledwall potřebuje škálování, protože samotné rozlišení zařízení a responsivita nepokryje situaci, kdy tabule má velké rozlišení, ale je daleko od diváků. V takovém případě potřebujeme méně řádků s většími písmeny.

### 11.1 URL parametr `displayRows` ✅

Nový URL parametr pro ledwall mód, který určuje počet viditelných řádků výsledků.

- [x] Přidat URL parametr `displayRows` (number, default: auto-calculated)
- [x] Dokumentovat parametr v App.tsx komentáři
- [x] Přidat validaci (min: 3, max: 20)

**Příklady použití:**
```
?type=ledwall&displayRows=5   // 5 řádků výsledků
?type=ledwall&displayRows=8   // 8 řádků výsledků
```

### 11.2 Výpočet škálování ✅

Layout se škáluje tak, aby na výšku vyplnil disponibilní viewport s přesně zadaným počtem řádků.

- [x] Upravit `useLayout.ts` - přidat podporu pro `displayRows` parametr
- [x] Vypočítat `scaleFactor` = viewport_height / (header + oncourse + displayRows * rowHeight)
- [x] Aplikovat `transform: scale(scaleFactor)` na root kontejner
- [x] Nastavit `transform-origin: top left`
- [x] Kompenzovat šířku: `width: calc(100% / scaleFactor)`

### 11.3 CSS transformace ✅

- [x] Vytvořit nový CSS wrapper pro škálovaný obsah v `ScoreboardLayout`
- [x] Aplikovat CSS proměnnou z useLayout
- [x] Zajistit že scrollování funguje i po škálování (používá unscaled pixely)
- [ ] Otestovat že text zůstává ostrý (ne rozmazaný) - manuální test

### 11.4 Rozměry komponent při škálování ✅

CSS `transform: scale()` automaticky škáluje všechny komponenty proporčně:

- [x] TopBar: původních 60px × scaleFactor
- [x] CurrentCompetitor: původní rozměry × scaleFactor
- [x] ResultRow: původních 56px × scaleFactor
- [x] Fonty: původní velikosti × scaleFactor

### 11.5 Autoscroll při škálování ✅

- [x] Ověřit že autoscroll funguje správně se škálovaným obsahem
- [x] Scroll offset počítán v původních (neškálovaných) pixelech
- [x] Page-based scrollování: posun o `displayRows` řádků

### 11.6 Testování

**Automatizované:**
- [x] E2E test: screenshot s displayRows=5 (layout.spec.ts)
- [x] E2E test: transform validation s displayRows (layout.spec.ts)

**Manuální (čeká na provedení):**
- [ ] `?type=ledwall&displayRows=5` na 1920×1080
- [ ] `?type=ledwall&displayRows=3` na 768×384
- [ ] Vizuální kontrola škálovaného ledwallu
- [ ] Performance test - FPS při škálování

### 11.7 Dokumentace ✅

- [x] Aktualizovat README.md - nový parametr displayRows
- [x] Aktualizovat checklist s výsledky testování

### 🔍 Revize: Fáze 11

- [ ] Provést manuální testy výše
- [ ] **Commit:** "fix: address Phase 11 code review findings" ✅ (cdbce2c)

---

## Zbývající práce

### Release

- [ ] **Tag:** `v2.0.0` (čeká na hardware testování a manuální testy Fáze 11)

### Střední priorita - Duplicitní kód

- [x] **penaltyGates parsing** - Identická logika pro parsování gate penalties (`CurrentCompetitor.tsx:50-58`, `OnCourseDisplay.tsx:103-114`)
- [x] **Message handlers** - Podobná struktura handleXxxMessage metod (`CLIProvider.ts`, `ReplayProvider.ts`) - extrahováno do `messageHandlers.ts`

### Nízká priorita - Code Quality

- [x] **ResultsList.tsx:51 showPenalty** - Odstraněna zbytečná proměnná, penalty je vždy zobrazen (matches original v1)
- [x] **formatTime.ts empty checks** - Kontrola po trim() je potřebná pro whitespace-only stringy (test potvrzuje)
- [x] **Dual exports** - Vyřešeno, žádné default exporty v codebase

### Nízká priorita - Testy

- [x] **layout.spec.ts** - Opraveny magic numbers (použití viewportWidth/Height * 0.9), přidány edge case testy pro displayRows (min/max hodnoty)
- [x] **validation.test.ts** - Zredukováno z 44 na 16 testů (sloučeny testy pro triviální funkce)
- [x] **parseGates.test.ts** - calculateTotalPenalty zredukováno z 6 na 2 testy
- [x] **componentSnapshots.test.tsx** - Odstraněn duplicitní soubor (Footer a ResultRow jsou testovány v dedicated souborech)

---

## Fáze 12: Code Cleanup (z review)

> **Důvod:** Review odhalilo mrtvý kód a redundantní testy. 518 testů je příliš na aplikaci této velikosti.

### 12.1 Mrtvý kód - smazat ✅

- [x] **normalizeCompetitor.ts** - celý soubor je nepoužitý (normalizeCompetitor, normalizeResult, isEmptyCompetitor)
- [x] **validation.ts** - smazat nepoužité funkce (isNumeric, validateCompetitorData)

### 12.2 Redukce testů (~50 redundantních)

> **Pozn:** useAutoScroll testy NECHAT - scrollování není doladěné

**formatX funkce** - sloučit duplicitní null/empty/whitespace testy:
- [x] **formatTime.test.ts** - 4 testy → 1 parametrizovaný
- [x] **formatName.test.ts** - sloučit empty value testy
- [x] **formatClub.test.ts** - sloučit empty value testy
- [x] **formatNat.test.ts** - sloučit empty value testy

**useLayout testy** - testovat chování, ne implementační detaily:
- [x] **useLayout.test.ts** - odstranit testy na CSS proměnné (--row-height, --visible-rows)

**E2E testy** - parametrizovat opakované setupy:
- [x] **layout.spec.ts** - parametrizovat testy pro různá rozlišení (vertical, ledwall, ledwall-wide)

### 12.3 Zbytečné fallbacky (minor)

- [x] **getGateClass.ts:49-50** - odstranit `?? ''` (CSS module nikdy nevrací undefined)
- [x] **validation.ts:76-80** - N/A (soubor byl smazán v 12.1)

---

## Post-implementace

### Budoucí kroky (až po release v2.0.0)

- [ ] C123Provider - přímé TCP připojení (vyžaduje WebSocket proxy)
- [ ] Produkční nasazení
- [ ] Performance optimalizace (pokud potřeba)

---

## Dostupné zdroje

| Zdroj | Lokace |
|-------|--------|
| CLI server | ws://192.168.68.108:8081 |
| Original v1 ledwall | http://192.168.68.108:3000/?type=ledwall |
| Original v1 vertical | http://192.168.68.108:3000/?type=vertical |
| Recording | `public/recordings/rec-2025-12-28T09-34-10.jsonl` |
| Original assets | `../canoe-scoreboard-original/default-assets/` |
| Ref. screenshoty | `/workspace/csb-v2/analysis/reference-screenshots/` |

---

## Manuální kontrola

**URLs pro porovnání:**

| Verze | Ledwall | Vertical |
|-------|---------|----------|
| **V2** | http://localhost:5173/?type=ledwall | http://localhost:5173/?type=vertical |
| **Originál** | http://192.168.68.108:3000/?type=ledwall | http://192.168.68.108:3000/?type=vertical |

**Spuštění V2:**
```bash
cd /workspace/csb-v2/canoe-scoreboard-v2 && npm run dev
```
