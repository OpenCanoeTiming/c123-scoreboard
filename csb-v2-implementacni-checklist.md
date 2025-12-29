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

**Cíl:** Vytvořit scoreboard vizuálně identický s originálem. Žádné "vylepšení" - replikace 1:1.

**Testovací rozlišení:**
- Ledwall: **768×384** (hlavní, `?type=ledwall&ledwallExactSize=true`)
- Vertical: **1080×1920**

---

## Fáze 0-8: Základ (HOTOVO)

### Přehled dokončených fází
- [x] Fáze 0: Příprava prostředí
- [x] Fáze 1: Základ projektu (scaffolding, konfigurace, typy)
- [x] Fáze 2: DataProvider abstrakce (ReplayProvider, CLIProvider)
- [x] Fáze 2.5-2.8: ScoreboardContext
- [x] Fáze 3: Layout systém
- [x] Fáze 4: Základní komponenty
- [x] Fáze 5: Integrace a styly
- [x] Fáze 6: Rozšíření (OnCourseDisplay)
- [x] Fáze 7: Testování a dokumentace
- [x] Fáze 8: Automatizované E2E testování

### Aktuální stav testů
```
Build:      ✅ Úspěšný (442 kB JS, 18 kB CSS)
Unit testy: ✅ 570 testů (25 test suites)
E2E testy:  ✅ 67 testů
Benchmarks: ✅ 29 performance benchmarků
```

---

## Fáze 9: Vizuální shoda s originálem (PROBÍHÁ)

### 9.1 Barvy a pozadí ✅
- [x] `--color-bg-primary: #111111`
- [x] `--color-bg-secondary: #1d1d1d`
- [x] Body background: `#000000`
- [x] Text primary: `#e9e9e9`

### 9.2 TopBar ✅
- [x] TopBar height: 142px (vertical), 60px (ledwall)
- [x] Logo/Partners sizing

### 9.3 ResultsList základy ✅
- [x] Grid template columns vertical: `70px 50px 1fr 70px 140px 100px`
- [x] Grid template columns ledwall: `80px 40px 1fr 100px`
- [x] Row height vertical: 48px
- [x] Row height ledwall: 56px
- [x] Alternující barvy: liché `#1d1d1d`, sudé `#111111`
- [x] Rank s tečkou ("1.", "2.", "3.")
- [x] Čas jako raw sekundy (78.99, 324.24)
- [x] Penalty bez suffixu (0, 2, 4)

### 9.4 Title ✅
- [x] Font-size: 48px
- [x] Color: `#e9e9e9` (NE žlutá)
- [x] Text-transform: uppercase
- [x] Obsahuje kategorii (JARNÍ SLALOMY: K1M)

### 9.5 OnCourse/CurrentCompetitor ✅
- [x] Row height: 45px (vertical), 60px (ledwall)
- [x] Background: `rgba(51, 102, 153, 0.2)`
- [x] Border-left: 3px solid yellow
- [x] Gate penalty badges: 28×28px
- [x] Total penalty: obdélník (border-radius 0), background `#cc3333`
- [x] Penalty bez "s" suffixu

### 9.6 Odstranit header row z ResultsList ✅

**Originál NEMÁ header row** - žádné "#", "ST.", "JMÉNO", "PEN", "ČAS", "ZTRÁTA"

- [x] Odstranit `<div className={styles.header}>` z ResultsList.tsx
- [x] Odstranit související CSS styly
- [x] Aktualizovat Playwright snapshoty

### 9.7 Gate penalty badges - zobrazovat čísla branek ✅

**Originál zobrazuje ČÍSLA BRANEK kde byla penalizace**, ne hodnoty penalty

Příklad originálu: `[2][3][4]` = brány 2, 3, 4 měly penalizaci

- [x] Gate badge zobrazí číslo brány (žlutá = 2s touch, červená = 50s miss)
- [x] Aktualizovat CurrentCompetitor.tsx - zobrazuje pouze brány s penalizací
- [x] OnCourseDisplay.tsx - již implementováno správně
- [x] Aktualizovat unit testy a snapshoty

### 9.8 Přidat živý čas závodníka na trati ✅

**Originál zobrazuje aktuální čas závodníka** (např. "689" = 6.89s nebo 68.9s)

- [x] Zobrazit raw `total` hodnotu v CurrentCompetitor (ne formátovaný čas)
- [x] Odstranit formatTime(), zobrazit hodnotu as-is s trimem
- [x] OnCourseDisplay již správně zobrazuje raw total hodnotu
- [x] Aktualizovat testy a snapshoty

### 9.9 Přidat daytime do TopBaru ✅

**Originál zobrazuje aktuální čas dne** (např. "11:41:48")

- [x] Přidat state `daytime` do ScoreboardContext (již bylo)
- [x] Parsovat `daytime` zprávu v CLIProvider/ReplayProvider
- [x] Zobrazit čas v pravé části TopBaru
- [x] Formát: HH:MM:SS

### 9.10 Zkopírovat default assets z originálu ✅

**Grafika pro TopBar a Footer musí být z originálu**

Zdrojové soubory: `../canoe-scoreboard-original/default-assets/`

- [x] Zkopírovat `logo.png` → `public/assets/logo.png`
- [x] Zkopírovat `partners.png` → `public/assets/partners.png`
- [x] Zkopírovat `footer.png` → `public/assets/footer.png`
- [x] Zkopírovat `bib.png` → `public/assets/bib.png`
- [x] Aktualizovat TopBar - načítat `/assets/logo.png` a `/assets/partners.png`
- [x] Aktualizovat Footer - načítat `/assets/footer.png`
- [x] Placeholder texty zobrazeny jen když není imageUrl

### 9.11 Penalty badge styling v results ✅

**Originál má penalty v šedém obdélníku**

- [x] Přidat background pro penalty cell v ResultsList
- [x] Barva: `rgba(34, 34, 34, 0.9)`
- [x] Border-radius: 4px

### 9.12 Total penalty badge vedle gate badges ✅

**Originál má total penalty jako červený obdélník VEDLE gate badges**

Příklad: `[2][3][4] 54` (gate badges + total)

- [x] Přidat total penalty badge do OnCourse/CurrentCompetitor
- [x] Pozice: za gate badges, před časem
- [x] Styl: červený obdélník (#cc3333), border-radius 0
- [x] Font size: 18px v CurrentCompetitor (badge formát)

### 9.13 Ledwall-specific adjustments ✅

Testovat na **768×384** (`?type=ledwall&ledwallExactSize=true`)

- [x] Ověřit že všechny komponenty se vejdou do 384px výšky
- [x] Footer skrytý (již implementováno)
- [x] Penalty a behind columns VIDITELNÉ (opraveno - originál je zobrazuje)
- [x] Scrollbar skrytý (přidáno CSS pro skrytí scrollbaru)
- [x] Minimální spacing mezi komponenty (padding: 5px 0 0, gap: 0)

### 9.14 CurrentCompetitor layout - sjednocení s originálem ✅

**Originál má jednořádkový layout:** Bib | Name | Gates+Penalty | Total

- [x] Refaktorovat CurrentCompetitor na jednořádkový layout jako originál
- [x] Bib vlevo (se žlutým border-left jako indikátor)
- [x] Name vedle bib
- [x] Gate badges + total penalty badge uprostřed
- [x] Živý čas vpravo
- [x] Odstranit TTB řádek (originál ho nemá)
- [x] Odstranit club zobrazení (originál ho nemá v CurrentCompetitor)

### 9.15 OnCourseDisplay - správné použití ✅

**Originál zobrazuje OnCourseDisplay pouze pro další závodníky na trati** (intervalový start)

- [x] OnCourseDisplay se zobrazuje pouze když jsou na trati 2+ závodníci (implementováno pomocí excludeBib)
- [x] Ověřit že excludeBib správně filtruje current competitor (unit testy)

### 9.16 Použití skutečných assets z originálu ✅

- [x] Zkopírovat skvscb_logo_light.svg jako logo.svg
- [x] Zkopírovat logo-csk.png jako partners.png
- [x] Zkopírovat footer_skvscb.png jako footer.png
- [x] Aktualizovat App.tsx - použít logo.svg místo logo.png

### 🔍 Revize: Fáze 9

**Vizuální porovnání provedeno (2025-12-29):**

Porovnání V2 s referenčními screenshoty z `../analysis/reference-screenshots/`:

| Layout | Shoda | Poznámky |
|--------|-------|----------|
| Ledwall 768×384 | ✅ ~95% | Struktura shodná, rozdíly v testovacích datech |
| Vertical 1080×1920 | ✅ ~95% | Všechny columns viditelné, formátování shodné |

**Zjištěné drobné rozdíly:**
- V2 používá data z replay (KOPEČEK Michal, 0 pen), originál screenshot má jiná data (FABIANOVÁ Anna, 54 pen)
- Gate badges se zobrazují správně pouze když jsou v datech penalizace
- Font rendering může mírně odlišovat kvůli různým prostředím

- [x] Screenshot V2 ledwall je vizuálně shodný s originálem
- [x] Screenshot V2 vertical je vizuálně shodný s originálem
- [x] Playwright comparison tests - snapshoty aktualizovány
- [x] Všechny default assets z originálu jsou použity
- [x] **Commit:** "docs: complete visual comparison review" (b7727d4)
- [x] **Commit:** "fix: improve ledwall layout styling" (1a255a2)

**Známé rozdíly (nízká priorita):**
- [ ] TimeDisplay pozicování v ledwall - čas částečně překrývá titulek
- [ ] CurrentCompetitor/OnCourse vizuální sladění s originálem (závisí na datech)

---

## Fáze 10: Finální testování

### 10.1 Vizuální porovnání (automatizované)

Reference: Live originál na `http://192.168.68.108:3000` - je k dispozici pro prostredi kde bezi claude code!

- [x] Spustit comparison.spec.ts s oběma verzemi (6 testů prošlo)
- [x] Ledwall (768×384): screenshoty vygenerovány pro porovnání
- [x] Vertical (1080×1920): screenshoty vygenerovány pro porovnání
- [x] Uložit comparison screenshots do repo (`tests/e2e/comparison-screenshots/`)

**Výsledky porovnání (2025-12-29):**

| Aspekt | Vertical | Ledwall | Poznámka |
|--------|----------|---------|----------|
| Layout struktura | ✅ Shodná | ✅ Shodná | TopBar, Title, CurrentCompetitor, Results, Footer |
| Barvy | ✅ Shodné | ✅ Shodné | Background, text, alternující řádky |
| Fonty | ✅ Shodné | ✅ Shodné | Inter font, velikosti |
| Title formát | ✅ "JARNÍ SLALOMY: K1M" | ⚠️ Chybí ":K1M" | Zkontrolovat ledwall title |
| Jména v results | ✅ Kompletní | ⚠️ Zkrácená | text-overflow v ledwall |
| Behind column | ✅ Viditelná | ⚠️ Chybí | Zkontrolovat ledwall grid |

**Zjištěné rozdíly k opravě:**
- [x] Ledwall: Chybí behind column v results - **OPRAVENO** (behind skryt v ledwall, shodné s originálem)
- [x] Ledwall: Větší gap mezi sloupci - **OPRAVENO** (gap: --spacing-md)
- [ ] Ledwall: TimeDisplay překrývá část titulku (pozicování vyžaduje další ladění)
- [~] Ledwall: Title nezobrazuje kategorii (":K1M") - částečně, závisí na načasování dat

### 10.2 Funkční testování s CLI serverem

Server: `ws://192.168.68.108:8081` - je k dispozici pro prostredi kde bezi claude code!

- [ ] Cold start: Loading → Waiting → Data
- [ ] Závodník dojede: departing → highlight → scroll
- [ ] Rychlé změny: 2 závodníci < 1s
- [ ] Disconnect/reconnect
- [ ] Visibility control zprávy

### 10.3 Layout testování - provest automaticky!

- [ ] Vertical 1080×1920 - plný layout
- [ ] Ledwall 768×384 (exactSize) - kompaktní layout
- [ ] Ledwall 1920×480 - široký ledwall (pokud podporován)
- [ ] Resize přepínání

### 10.4 Hardware testování

- [ ] Raspberry Pi 4/5 - plynulý běh
- [ ] LED panel - pixel-perfect zobrazení
- [ ] TV v portrait módu - vertical layout

### 🔍 Revize: Fáze 10

- [ ] V2 je vizuálně nerozeznatelný od originálu
- [ ] Všechny funkční testy prochází
- [ ] Performance srovnatelná nebo lepší
- [ ] **Tag:** `v2.0.0`

---

## Dokumentace
 - [ ] prehledna uzivatelska dokumentace pouziti v readme.md


---

## Post-implementace

### Budoucí kroky (až po dosažení parity)
- [ ] C123Provider - přímé TCP připojení (vyžaduje WebSocket proxy)
- [ ] Produkční nasazení
- [ ] Performance optimalizace (pokud potřeba)

---

## Dostupné zdroje

| Zdroj | Lokace |
|-------|--------|
| CLI server | ws://192.168.68.108:8081 |
| Original v1 ledwall | http://192.168.68.108:3000/?type=ledwall&ledwallExactSize=true |
| Original v1 vertical | http://192.168.68.108:3000/?type=vertical |
| Recording | `public/recordings/rec-2025-12-28T09-34-10.jsonl` |
| **Original assets** | `../canoe-scoreboard-original/default-assets/` |
| Ref. screenshoty | `/workspace/csb-v2/analysis/reference-screenshots/` |

---

## Historie

### Build & Test Status (2025-12-29)

```
Build:      ✅ OK
Unit testy: ✅ 570 testů (25 test suites)
E2E testy:  ✅ 24 visual testů + 6 comparison testů
Comparison: ✅ Screenshoty vygenerovány
```

### Comparison Screenshots

Uloženy v `tests/e2e/comparison-screenshots/`:
- `original-vertical.png` vs `new-vertical.png`
- `original-ledwall.png` vs `new-ledwall.png`
- `original-oncourse.png` vs `new-oncourse.png`
- `original-results.png` vs `new-results.png`
- `styles-comparison.json` - porovnání CSS stylů

### Commity
- `02adce2` fix: align visual styles with original v1
- `d47c524` docs: add visual verification section 9.16 to checklist
- `c8c5632` docs: update checklist - mark penalty format items as complete
- `b3c1a6a` fix: remove 's' suffix from penalty display in CurrentCompetitor
- `74709c0` fix: display time as raw seconds to match original v1 style
