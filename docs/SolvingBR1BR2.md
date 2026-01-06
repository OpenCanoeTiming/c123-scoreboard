# Analýza BR1/BR2 Merge zobrazení

## Problém

Ve vodním slalomu existují závody se dvěma jízdami (Best Run = BR). Závodník jede BR1, pak BR2, a do výsledků se počítá lepší z obou časů.

**Současný stav scoreboardu:**
- Při BR2 zobrazuje jen "best run" výsledek
- Horší čas druhé jízdy se závodník nedozví
- Chceme zobrazit OBA časy s označením lepšího

---

## Analýza datových zdrojů

### 1. TCP Stream (C123 → Server)

**Co posílá pro BR2 Results:**
```xml
<Result Type="T"
  Time="82.36"    <!-- BR2 čas -->
  Pen="0"         <!-- BR2 penalizace -->
  Total="81.72"   <!-- NEJLEPŠÍ z obou jízd! -->
  Rank="1"        <!-- Celkové pořadí -->
/>
```

**Klíčový nález:** `Total` není BR2 total, ale **best of both runs**!

**Co můžeme odvodit:**
- BR2 total = Time + Pen
- Pokud BR2 total > Total → BR1 byla lepší, BR1 total = Total
- Pokud BR2 total == Total → BR2 byla lepší

**Co CHYBÍ v TCP streamu:**
- BR1 čas a penalizace zvlášť
- Pokud BR2 byla lepší → o BR1 nevíme nic

### 2. XML soubor

**BR2 Results v XML obsahují KOMPLETNÍ data:**
```xml
<Results>
  <RaceId>K1M_ST_BR2_6</RaceId>

  <!-- Aktuální jízda (BR2) -->
  <Time>79990</Time>           <!-- centisekundy -->
  <Pen>6</Pen>
  <Total>85990</Total>
  <Rnk>4</Rnk>

  <!-- Předchozí jízda (BR1) -->
  <PrevTime>76990</PrevTime>
  <PrevPen>2</PrevPen>
  <PrevTotal>78990</PrevTotal>
  <PrevRnk>1</PrevRnk>

  <!-- Celkový výsledek -->
  <TotalTotal>78990</TotalTotal>
  <TotalRnk>3</TotalRnk>
  <BetterRunNr>1</BetterRunNr>   <!-- 1=BR1 lepší, 2=BR2 lepší -->
</Results>
```

### 3. REST API

**Endpoint:** `GET /api/xml/races/:raceId/results?merged=true`

**Response:**
```json
{
  "results": [
    {
      "bib": "1",
      "run1": { "time": 7899, "pen": 2, "total": 7899, "rank": 1 },
      "run2": { "time": 7756, "pen": 0, "total": 7756, "rank": 2 },
      "bestTotal": 7756,
      "bestRank": 1
    }
  ],
  "merged": true,
  "classId": "K1M_ST"
}
```

---

## Navrhované řešení

### Architektura

```
C123 System ──TCP──► C123 Server ──WS──► Scoreboard
                          │
                          └──REST──► Scoreboard (BR1 data)
```

### Data flow

1. **BR1 jede:** Scoreboard cachuje BR1 výsledky z TCP
2. **BR2 jede:**
   - TCP přijde s Results (Time=BR2, Total=best)
   - Scoreboard zjistí že je BR2 (raceId obsahuje `_BR2_`)
   - Použije BR1 z cache, nebo fetchne z REST API

### Implementace (FINÁLNÍ - 2026-01-06)

**DŮLEŽITÉ - Zdroje dat a jejich problémy:**

| Zdroj | Data | Problém |
|-------|------|---------|
| **WebSocket Results** | `time`, `pen`, `total` | `pen` = penalizace LEPŠÍ jízdy! `total` = BEST of both! |
| **WebSocket OnCourse** | `pen` pro závodníky na trati | Správná BR2 penalizace, ale jen pro pár lidí |
| **REST API** | `run1`, `run2` kompletní | Zpožděné (XML se aktualizuje pomaleji než WS) |

**Klíčový problém s WebSocket `pen`:**
- Když BR1 byla lepší → `result.pen` obsahuje BR1 penalizaci!
- Když BR2 byla lepší → `result.pen` obsahuje BR2 penalizaci
- Nelze spolehlivě použít pro BR2 zobrazení

### Priority penalizací

```
1. OnCourse penalties   ← ŽIVÉ, nejpřesnější (i po dojetí)
2. REST API cache       ← Autoritativní, ale zpožděné
3. WebSocket pen        ← POZOR: může být z BR1!
```

**Kód:**
```typescript
const br2Pen = onCoursePen ?? cachedRun2?.pen ?? result.pen
```

### Grace period pro OnCourse

Závodník po dojetí zmizí z OnCourse, ale REST API ještě nemá data.
Bez grace period by se zobrazila špatná penalizace z WebSocket.

**Řešení:** OnCourse penalties zůstávají **10 sekund** po vypadnutí z trati.

```typescript
const ONCOURSE_PENALTY_GRACE_MS = 10_000

// Entry structure
interface OnCoursePenaltyEntry {
  pen: number
  lastSeen: number  // timestamp
}
```

### Data flow

1. **Závodník startuje BR2:**
   - OnCourse má jeho `pen` → ukládá se do `onCoursePenalties`

2. **Závodník dojede:**
   - Ještě je v OnCourse (s `dtFinish`) → penalty stále aktuální
   - Results přijdou → použije se `onCoursePenalties` (správná!)

3. **Závodník zmizí z OnCourse:**
   - Grace period 10s → penalty zůstává
   - REST API mezitím dožene → cache má správná data

4. **Po grace period:**
   - Entry smazána při dalším OnCourse update
   - Používá se REST cache (autoritativní)

5. **Pozdější opravy v C123:**
   - REST API refresh (debounce 1s, interval 30s)
   - Cache aktualizována → zobrazí se správná penalizace

### Detekce prázdných objektů

REST API může vrátit `run2: {}` místo `undefined`:

```typescript
// ŠPATNĚ - {} projde
if (!row) return undefined

// SPRÁVNĚ
if (!row || Object.keys(row).length === 0) return undefined
```

### Soubory implementace

| Soubor | Účel |
|--------|------|
| `src/providers/utils/br1br2Merger.ts` | BR2Manager, merge logika, OnCourse cache |
| `src/providers/C123ServerProvider.ts` | Propojení OnCourse → BR2Manager |
| `src/providers/utils/c123ServerApi.ts` | REST API client pro getMergedResults |
| `src/components/ResultsList/ResultRow.tsx` | UI s RunTimeCell pro BR1/BR2 sloupce |

### Konstanty

```typescript
const INITIAL_FETCH_DELAY_MS = 500      // Počáteční delay před prvním REST fetch
const DEBOUNCE_FETCH_MS = 1000          // Debounce pro REST fetch po Results
const BR1_REFRESH_INTERVAL_MS = 30_000  // Refresh interval pro REST data
const ONCOURSE_PENALTY_GRACE_MS = 10_000 // Grace period pro OnCourse penalties
```

---

## Testování

### TCP stream ověření (2026-01-05) - POTVRZENO

Testováno na živém C123 (192.168.68.108:27333):

| Bib | Time (BR2) | Pen | BR2 calc | Total v Results | Závěr |
|-----|------------|-----|----------|-----------------|-------|
| 1   | 79.99      | 2   | 81.99    | **78.99**       | BR1 lepší (Total < BR2) |
| 5   | 87.30      | 2   | 89.30    | **84.33**       | BR1 lepší (Total < BR2) |
| 9   | 51.20      | 6   | 57.20    | 57.20           | BR2 lepší (Total = BR2) |

**POTVRZENO:** TCP stream posílá `Total` = best of both runs, ne BR2 total!

---

## Soubory k úpravě

### C123 Server
- `src/state/BR1BR2Merger.ts` - odstranit nebo deaktivovat

### Scoreboard V3
- `src/providers/C123ServerProvider.ts` - BR1 cache, REST fetch
- `src/providers/utils/c123ServerMapper.ts` - merge BR1+BR2
- `src/types/result.ts` - už má run1/run2 prepared
- `src/components/ResultRow.tsx` - UI pro dva časy

---

## Reference

- XML struktura: `../analysis/captures/xboardtest02_jarni_v1.xml`
- Nahrávka: `../analysis/recordings/rec-2025-12-28T09-34-10.jsonl`
- REST API docs: `../c123-server/docs/REST-API.md`
