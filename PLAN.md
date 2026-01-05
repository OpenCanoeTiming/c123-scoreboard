# Implementační plán: Canoe Scoreboard V3

## Stav projektu

| Fáze | Status |
|------|--------|
| Fáze A-E: Základní funkčnost, testy, opravy | ✅ Hotovo |
| **Fáze F: Vylepšení a integrace s C123** | 🔄 Aktuální |
| Fáze G: BR1/BR2 merge zobrazení | ⏳ Čeká |

---

## Fáze F - Vylepšení a integrace s C123 serverem

### Cíl

Dokončení integrace s C123 serverem (remote config, force refresh), vizuální vylepšení a asset management.

---

### Blok F1: Vizuální opravy penalizací

#### Problém
Barevné zvýraznění penalizací (0/2/50) je příliš výrazné - na ledwall může být nečitelné, na vertical působí "papouškovitě" vzhledem k celkovému designu.

#### F1.1 Analýza a návrh
- [ ] Projít stávající CSS pro penalty colors
- [ ] Navrhnout utilitární barevné schéma v duchu stávající grafiky
- [ ] Možnosti: odstíny šedé s opacity, tlumené barvy, pouze ikonky

#### F1.2 Implementace
- [ ] Upravit penalty CSS classes
- [ ] Testovat na vertical i ledwall layoutu
- [ ] Zajistit čitelnost na různých rozlišeních

---

### Blok F2: Client ID pro C123 server

#### Popis
Scoreboard může poslat `clientId` v URL při WebSocket připojení. Server pak identifikuje klienta podle ID místo IP adresy. Užitečné pro více scoreboardů na jednom stroji.

**Viz:** `../c123-server/docs/CLIENT-CONFIG.md`

#### F2.1 URL parametr
- [ ] Přidat podporu `?clientId=xxx` URL parametru
- [ ] Předat clientId do C123ServerProvider

#### F2.2 WebSocket URL
- [ ] Upravit WebSocket URL: `ws://server/ws?clientId=xxx`
- [ ] Fallback na IP-based identifikaci když clientId chybí

#### F2.3 Testy
- [ ] Unit test pro clientId parsing
- [ ] Test WebSocket URL construction

---

### Blok F3: Force Refresh

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
- [ ] Přidat handler pro `ForceRefresh` message type
- [ ] Implementovat `window.location.reload(true)` nebo ekvivalent

#### F3.2 Logování
- [ ] Log důvodu refreshe před reloadem
- [ ] Možnost zobrazit krátkou notifikaci (optional)

---

### Blok F4: ConfigPush - přejímání parametrů ze serveru

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
- [ ] Přidat `ConfigPushData` interface
- [ ] Přidat handler v C123ServerProvider

#### F4.2 Aplikace konfigurace
- [ ] Propojit s existujícím URL param systémem
- [ ] Priorita: ConfigPush > URL params > defaults
- [ ] Re-render po změně konfigurace

#### F4.3 ClientState response (optional)
- [ ] Po aplikaci ConfigPush poslat zpět `ClientState` zprávu
- [ ] Reportovat current config a version

#### F4.4 Flow při startu
- [ ] Inicializace z URL params / localStorage
- [ ] Čekat na ConfigPush po připojení
- [ ] Merge s existující konfigurací

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

Zobrazení sloučených výsledků z obou jízd (Best Run) při probíhající 2. jízdě. Umožňuje divákům vidět celkové pořadí již během BR2.

### Analýza (2026-01-04)

**C123 Server:** REST endpoint `GET /api/xml/races/:id/results?merged=true` je **hotový**.
- Vrací: `{ results: MergedResult[], merged: true, classId: string }`
- Každý výsledek obsahuje: `run1`, `run2`, `bestTotal`, `bestRank`

**Scoreboard:** Potřebuje implementaci:
1. Detekce BR2 závodů z raceId (`_BR2_`)
2. Fetch merged dat z REST API při BR2
3. Nová komponenta pro zobrazení merged výsledků (2 sloupce času)
4. Rozšíření Result typu o volitelná BR1/BR2 pole

**Rozhodnutí:** Unified view (varianta B) - rozšíření existujícího ResultsList o extra sloupce.

---

### Blok G1: Typy a detekce BR2

#### G1.1 Rozšíření Result typu
- [ ] Přidat volitelná pole do `Result`: `run1Total?`, `run2Total?`, `bestRun?: 1 | 2`
- [ ] Přidat typ `MergedResultRow` pro REST response

#### G1.2 Utility pro detekci BR2
- [ ] Funkce `isBR2Race(raceId: string): boolean` - detekce `_BR2_` v raceId
- [ ] Funkce `getClassId(raceId: string): string` - extrakce classId pro merged API

#### G1.3 Testy
- [ ] Unit testy pro `isBR2Race` a `getClassId`
- [ ] Type checking pro rozšířený Result

---

### Blok G2: REST API klient a mapper

#### G2.1 REST API klient
- [ ] Funkce `fetchMergedResults(serverUrl, raceId): Promise<MergedResult[]>`
- [ ] Error handling pro network errors
- [ ] Caching pro opakované požadavky (optional)

#### G2.2 Mapper pro merged results
- [ ] `mapMergedResults(data): Result[]` - převod REST response na Result[]
- [ ] Přidat run1/run2 pole do Result
- [ ] Zachovat kompatibilitu s existujícím ResultsList

---

### Blok G3: Context a data flow

#### G3.1 Rozšíření ScoreboardContext
- [ ] Nový state field: `isMergedView: boolean`
- [ ] Trigger pro fetch merged při BR2 results
- [ ] Merge logika: nahradit results merged daty

#### G3.2 Provider změny
- [ ] C123ServerProvider: detekce BR2, fetch merged
- [ ] Timing: fetch po každém Results update (debounced)

---

### Blok G4: UI komponenty

#### G4.1 Rozšíření ResultRow
- [ ] Podmíněné zobrazení extra sloupců (BR1, BR2)
- [ ] Highlight lepšího času
- [ ] Úprava CSS grid pro extra sloupce

#### G4.2 Podmíněné zobrazení sloupců
- [ ] Detekce `isMergedView` v ResultsList
- [ ] Přepínání mezi 1-run a 2-run layoutem

---

### Blok G5: Testy a dokumentace

#### G5.1 Unit testy
- [ ] Testy pro mapper
- [ ] Testy pro REST klient
- [ ] Testy pro ResultRow merged zobrazení

#### G5.2 Integrační testy
- [ ] E2E test pro BR2 merged view
- [ ] Snapshot testy

#### G5.3 Dokumentace
- [ ] Aktualizace docs/
- [ ] Deníček vývoje

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
