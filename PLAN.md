# Implementační plán: Canoe Scoreboard V3

## Stav projektu

| Fáze | Status |
|------|--------|
| Fáze A-E: Základní funkčnost, testy, opravy | ✅ Hotovo |
| **Fáze F: BR1/BR2 merge zobrazení** | 🔄 Aktuální |

---

## Fáze F - BR1/BR2 merge zobrazení

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

### Blok F1: Typy a detekce BR2

#### F1.1 Rozšíření Result typu
- [ ] Přidat volitelná pole do `Result`: `run1Total?`, `run2Total?`, `bestRun?: 1 | 2`
- [ ] Přidat typ `MergedResultRow` pro REST response

#### F1.2 Utility pro detekci BR2
- [ ] Funkce `isBR2Race(raceId: string): boolean` - detekce `_BR2_` v raceId
- [ ] Funkce `getClassId(raceId: string): string` - extrakce classId pro merged API

#### F1.3 Testy
- [ ] Unit testy pro `isBR2Race` a `getClassId`
- [ ] Type checking pro rozšířený Result

---

### Blok F2: REST API klient a mapper

#### F2.1 REST API klient
- [ ] Funkce `fetchMergedResults(serverUrl, raceId): Promise<MergedResult[]>`
- [ ] Error handling pro network errors
- [ ] Caching pro opakované požadavky (optional)

#### F2.2 Mapper pro merged results
- [ ] `mapMergedResults(data): Result[]` - převod REST response na Result[]
- [ ] Přidat run1/run2 pole do Result
- [ ] Zachovat kompatibilitu s existujícím ResultsList

---

### Blok F3: Context a data flow

#### F3.1 Rozšíření ScoreboardContext
- [ ] Nový state field: `isMergedView: boolean`
- [ ] Trigger pro fetch merged při BR2 results
- [ ] Merge logika: nahradit results merged daty

#### F3.2 Provider změny
- [ ] C123ServerProvider: detekce BR2, fetch merged
- [ ] Timing: fetch po každém Results update (debounced)

---

### Blok F4: UI komponenty

#### F4.1 Rozšíření ResultRow
- [ ] Podmíněné zobrazení extra sloupců (BR1, BR2)
- [ ] Highlight lepšího času
- [ ] Úprava CSS grid pro extra sloupce

#### F4.2 Podmíněné zobrazení sloupců
- [ ] Detekce `isMergedView` v ResultsList
- [ ] Přepínání mezi 1-run a 2-run layoutem

---

### Blok F5: Testy a dokumentace

#### F5.1 Unit testy
- [ ] Testy pro mapper
- [ ] Testy pro REST klient
- [ ] Testy pro ResultRow merged zobrazení

#### F5.2 Integrační testy
- [ ] E2E test pro BR2 merged view
- [ ] Snapshot testy

#### F5.3 Dokumentace
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
