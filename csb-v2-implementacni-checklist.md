# Canoe-Scoreboard-v2 - Implementační checklist

> **Souvislosti:**
> - Kompletní analýza: [../analysis/](../analysis/)
> - Plán reimplementace: [../analysis/08-plan-reimplementace.md](../analysis/08-plan-reimplementace.md)
> - Síťová komunikace: [../analysis/07-sitova-komunikace.md](../analysis/07-sitova-komunikace.md)
> - State management principy: [../analysis/03-state-management.md](../analysis/03-state-management.md)
> - Styly a layouty: [../analysis/06-styly.md](../analysis/06-styly.md)

---

## Aktuální stav

```
Build:       ✅ OK (437 kB JS, 19 kB CSS)
Unit testy:  ✅ 534 testů (26 test suites)
E2E testy:   ✅ 87 passed, 39 skipped (CLI server tests)
Performance: ✅ FPS ~44, memory stable, load <1s
```

---

## Fáze 0-12: Přehled

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
| 11 | Škálování ledwall (`displayRows`) | ✅ |
| 12 | Code cleanup (mrtvý kód, redukce testů) | ✅ |

---

## Fáze 11: Škálování ledwall (MANUÁLNÍ TESTY)

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
- [x] Otestovat že text zůstává ostrý (ne rozmazaný) - manuální test

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

**Automatizované:** ✅
- [x] E2E test: screenshot s displayRows=5 (layout.spec.ts)
- [x] E2E test: transform validation s displayRows (layout.spec.ts)

**Manuální (čeká na provedení):** - provedeno, nálezy níže
- [x] `?type=ledwall&displayRows=5` na 1920×1080
- [x] `?type=ledwall&displayRows=3` na 768×384
- [x] Vizuální kontrola škálovaného ledwallu
- [x] Performance test - FPS při škálování 

### 11.7 Dokumentace ✅

- [x] Aktualizovat README.md - nový parametr displayRows
- [x] Aktualizovat checklist s výsledky testování

---

## Release

- [x] Provést manuální testy Fáze 11 (výše)
- [x] **Tag:** `v2.0.0`

---
## z manualniho testovani - dulezite k oprave:
 - [x] vertical: odscrolloval hezky rychle jednu stránku a pak už se nepohnul :(
   - **Oprava:** Přidán `scrollTick` state pro triggerování dalšího scrollu
 - [x] vertical: přeskakování řádků mezi scrolly (22→24 místo 22→23)
   - **Oprava:** Snížen `PAGE_HEIGHT_RATIO` z 0.9 na 0.85 pro větší overlap
 - [x] vertical i ledwall: dva závodníci na trati - přeblikávání
   - **Oprava:** `comp` zprávy aktualizují pouze `currentCompetitor`, nikoliv `onCourse` seznam
   - Přidán `updateOnCourse` flag pro rozlišení `comp` vs `oncourse` zpráv
 - [x] ledwall: displayRows způsobuje scrollbary
   - **Oprava:** `overflow: hidden` na html/body/#root
 - [x] ledwall: scroll nefunguje správně když je závodník na trati
   - **Oprava:** Opravena logika scroll state machine
 - [x] scroll po dokončení jízdy nespolehlivý
   - **Oprava:** Po highlightu se nastaví `phase: IDLE` pro správný restart scroll automatu
 - [x] dokončení jízdy závodníka máme podle mě nějak předčasné
   - **Pozn.:** Highlight timing pochází z CLI `HighlightBib` v `top` zprávě - toto je správné chování podle analýzy (07-sitova-komunikace.md) - **není bug, uzavřeno**

 - [x] ledwall časy větší než 100s vytékají doprava, cca číslovka setin je mimo obrazovku, asi bych zarovnával vpravo, ne vlevo
   - **Oprava:** Zvětšena šířka time sloupce z 130px na 150px, snížen padding z 15px na 8px
 - [x] ledwall bez displayRows scrolluje dobře (při závodníkovi na trati i bez něj)
 - [x] vertical scrolluje dobře
 - [x] ledwall s displayRows nescrolluje vůbec
   - **Oprava:** ResultsList kontejner dostává pevnou výšku `displayRows * rowHeight` když je displayRows nastaven, což umožňuje scrollování uvnitř škálovaného layoutu
 - [x] nešlo by na obou layoutech nějak lépe dopočítat, kolik těch řádků je vidět a o kolik se má scrollovat? Ten koeficient z výšky obrazovky je podle mě nespolehlivý. Chtělo by to zohlednit i to, kolik oncourse se zobrazuje na vertical.
   - **Oprava:** `useAutoScroll` hook nyní měří skutečnou výšku ResultsList kontejneru (`container.clientHeight`) a skutečnou výšku řádku z prvního elementu (`firstRow.offsetHeight`). Tím se automaticky zohledňuje, kolik místa zabírají oncourse řádky na vertical layoutu.
 - [x] komponenty se objevují podle toho, jak je zapnu v CLI. My to ale chceme tak, že loga, footer, nadpis mají být zapnuté bez ohledu na CLI instrukce.
   - **Oprava:** V `SET_VISIBILITY` reduceru se nyní vždy forcuje `displayTopBar`, `displayTitle` a `displayFooter` na `true`, bez ohledu na CLI instrukce.
 - [x] když jsou dva (nebo více) závodníci na trati, tak na oboy layoutech se oba přepisují v tom jednom řádku, je to stále dokola, nedaří se ti to opravit. Je tam asi nějaký hlubší principiální problém. Má se to chovat takto: Ledwall vždy max. jeden závodník na trati, ten který vyjel dřív (má větší čas). Vertical by mohl zobrazovat všechny aktivní závodníky na trati (běží jim čas, nebo jsou čerstvě dojetí a probíhá jejich highlight).
   - **Oprava:** Přepracována logika výběru `currentCompetitor` v reduceru. Nyní se vždy vybírá závodník s nejnižším `dtStart` (nejdéle na trati). Také `comp` zprávy nyní správně aktualizují závodníka v `onCourse` seznamu místo přepisování celého seznamu.
 - [x] po dojetí závodníka se scrolluje na jeho pozici v results moc brzo!! Results ještě neobsahují nový výsledek, zobrazuje se něco, co nedává smysl. Scroll a highlight ve výsledcích musí proběhnout ve chvíli, kdy přijde nový výsledek v results. Zamysli se, prozkoumej, jak to chodí sousledně v datech, předělej ten automat.
   - **Oprava:** `useAutoScroll` hook nyní kontroluje, zda výsledek pro highlighted bib skutečně existuje v `results` seznamu. Scroll na highlighted řádek proběhne až poté, co se výsledek objeví v datech.
 - [x] na ledwall po dojetí závodníka nascrolluje tak nějak divně, ten highlight řádek je nahoře ale jakoby zasunutý, je třeba nascrollovat ještě o kousek níž, ideálně aby byl cca uprostřed plochy s výsledky
   - **Oprava:** Místo manuálního výpočtu scroll pozice se nyní používá `scrollIntoView({ block: 'center' })` pro spolehlivé umístění highlighted řádku doprostřed.
 - [x] ledwall se zapnutým displayRows nesrolluje vůbec nikdy :(
   - **Oprava:** (viz výše) ResultsList kontejner má fixní výšku při displayRows

## Post-implementace (po release)

- [x] C123Provider - přímé TCP připojení (vyžaduje WebSocket proxy)
  - Implementován `src/providers/C123Provider.ts` pro XML parsing
  - Proxy server `scripts/c123-proxy.js` pro TCP→WebSocket bridge
  - 22 unit testů pro C123Provider
  - Dokumentace v README.md
- [x] Produkční nasazení
  - Vite config s podporou base URL (`VITE_BASE_URL=/path/ npm run build`)
  - Vendor chunk splitting pro lepší caching
  - Dokumentace v README.md (sekce Deployment)
- [x] Performance optimalizace (pokud potřeba)
  - **Stav:** Není potřeba - FPS ~44, memory stable, load <1s
  - Bundle: 437 kB JS (120 kB gzip), 19 kB CSS (4 kB gzip)

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
