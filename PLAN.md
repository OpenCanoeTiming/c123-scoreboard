# Implementační plán: Canoe Scoreboard V3

## Stav projektu

| Fáze | Status |
|------|--------|
| Fáze A-E: Základní funkčnost, testy, opravy | ✅ Hotovo |
| Fáze F: Vylepšení a integrace s C123 | ✅ Hotovo (F5 odloženo) |
| **Fáze G: BR1/BR2 merge zobrazení** | 🔄 Aktuální |

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
Customizace log a obrázků bez rebuildů. ORIGINAL řešení bylo příliš složité.

#### F5.1 Analýza požadavků
- [ ] Definovat typy assets (logo organizace, sponzoři, pozadí)
- [ ] Prozkoumat možnosti: public folder, external URL, C123 server hosting

#### F5.2 Návrh řešení
Možné přístupy:
- **A) Public folder**: `/public/assets/` - jednoduché, vyžaduje přístup k serveru
- **B) External URLs**: ConfigPush s URL adresami - flexibilní, vyžaduje hosting
- **C) C123 server hosting**: Server servíruje assets - centralizované

- [ ] Vybrat přístup (doporučeno: kombinace A+B)
- [ ] Navrhnout strukturu a fallbacky

#### F5.3 Implementace
- [ ] Komponenta pro asset loading s fallbackem
- [ ] Konfigurace v ConfigPush (optional)
- [ ] Dokumentace pro uživatele

---

## Fáze G - BR1/BR2 merge zobrazení

### Cíl

Při BR2 závodech zobrazit OBA časy (BR1 i BR2) s grafickým rozlišením lepší/horší jízdy.

### Klíčová zjištění (2026-01-05)

**TCP stream chování:**
- `Total` v Results = **best of both runs** (NE BR2 total!)
- BR2 total se dá spočítat: `Time + Pen`
- BR1 data nejsou v TCP streamu dostupná

**Řešení:** Debounced REST fetch BR1 dat při každém Results během BR2.

**Viz:** `docs/SolvingBR1BR2.md` pro kompletní analýzu.

---

### Rozdíly mezi layouty

#### Ledwall layout
- **Beze změny** - zobrazuje jen nejlepší čas (Total z TCP)
- **Skrýt penalizace** - mohou náležet jiné jízdě než zobrazený čas
- Důvod: ledwall má omezený prostor, složitější zobrazení by bylo nečitelné

#### Vertical layout
- **Při BR1 a ostatních závodech:** zobrazení jako dosud (jeden sloupec času)
- **Při BR2:** dva sloupce - BR1 (pen + čas) a BR2 (pen + čas)
- BR2 sloupec se postupně plní, jak závodníci dojíždějí
- **Lepší jízda:** zvýrazněná (normální barva)
- **Horší jízda:** graficky potlačená (opacity/šedá)

---

### Předpoklady

**C123 Server:** `BR1BR2Merger` byla odstraněna - server už nemanipuluje TCP stream data.
Scoreboard přebírá odpovědnost za BR1/BR2 merge pomocí REST API.

---

### Blok G1: Typy a utility

#### G1.1 Rozšíření Result typu ✅
Typy už jsou připravené v `src/types/result.ts`:
- [x] `RunResult` interface s `total`, `pen`, `rank`, `status`
- [x] `Result.run1?: RunResult`, `Result.run2?: RunResult`
- [x] `Result.bestRun?: 1 | 2`

#### G1.2 Utility funkce
- [ ] `isBR2Race(raceId: string): boolean` - detekce `_BR2_` v raceId
- [ ] `getBR1RaceId(br2RaceId: string): string` - `_BR2_` → `_BR1_`
- [ ] `getClassId(raceId: string): string` - extrakce pro REST API

#### G1.3 Testy
- [ ] Unit testy pro všechny utility funkce
- [ ] Edge cases: prázdný raceId, nevalidní formát

---

### Blok G2: REST fetch a merge logika

#### G2.1 REST API klient
- [ ] Funkce `fetchBR1Results(serverUrl, br1RaceId): Promise<BR1Result[]>`
- [ ] Error handling (network, 404, timeout)
- [ ] Debouncing ~500ms pro omezení požadavků

#### G2.2 Merge BR1 + BR2
- [ ] Spojení BR1 výsledků s aktuálními BR2 daty podle bib
- [ ] Výpočet `bestRun` - porovnání run1.total vs run2.total
- [ ] Ošetření DNF/DNS/DSQ:
  - DNF/DNS/DSQ v jedné jízdě → druhá jízda je automaticky "lepší"
  - DNF/DNS/DSQ v obou jízdách → zobrazit stav, žádné zvýraznění
  - Časy null/undefined → nezobrazovat, neporovnávat

---

### Blok G3: C123ServerProvider změny

#### G3.1 Detekce BR2 v Results handleru
- [ ] Při Results zprávě kontrolovat `isBR2Race(raceId)`
- [ ] Pokud BR2 → spustit debounced fetch BR1

#### G3.2 Debounced fetch
- [ ] Implementovat debounce (~500ms) pro REST volání
- [ ] Při každém Results aktualizovat BR2 data okamžitě
- [ ] Po debounce: fetch BR1 + merge + emit merged results

#### G3.3 State management
- [ ] Flag `isBR2View: boolean` pro UI
- [ ] BR1 data cache (per session, není třeba persitovat)

---

### Blok G4: UI komponenty

#### G4.1 Ledwall: skrýt penalizace při BR2
- [ ] Podmínka: `isBR2View && layout === 'ledwall'` → skrýt penalty sloupec
- [ ] Zachovat ostatní zobrazení beze změny

#### G4.2 Vertical: dva sloupce při BR2
- [ ] Rozšířit ResultRow o volitelné BR1/BR2 sloupce
- [ ] CSS grid úprava pro extra sloupce
- [ ] Header: "1. jízda" / "2. jízda" (nebo "BR1" / "BR2")

#### G4.3 Grafické rozlišení lepší/horší jízdy
- [ ] CSS třída `.better-run` - normální zobrazení
- [ ] CSS třída `.worse-run` - opacity ~0.5 nebo šedá barva
- [ ] Aplikovat podle `bestRun` hodnoty

#### G4.4 Prázdné BR2 výsledky
- [ ] Závodník ještě nedojel BR2 → BR2 sloupec prázdný (pomlčka nebo prázdno)
- [ ] BR1 sloupec vždy vyplněn (data z REST)

---

### Blok G5: Testy a edge cases

#### G5.1 Unit testy
- [ ] Utility funkce
- [ ] Merge logika
- [ ] bestRun výpočet

#### G5.2 Edge cases testy
- [ ] DNF v BR1, platný čas v BR2
- [ ] Platný čas v BR1, DSQ v BR2
- [ ] Oba DNF
- [ ] Stejný čas v obou jízdách
- [ ] REST API nedostupné → fallback na TCP-only zobrazení

#### G5.3 Vizuální testy
- [ ] Vertical layout s BR2 daty
- [ ] Ledwall layout bez penalizací
- [ ] Responsivita na různých rozlišeních

---

### Blok G6: Dokumentace

- [ ] Aktualizace docs/architecture.md
- [ ] Zápis do docs/DEVLOG.md
- [ ] Aktualizace docs/troubleshooting.md (BR2 specific issues)

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
