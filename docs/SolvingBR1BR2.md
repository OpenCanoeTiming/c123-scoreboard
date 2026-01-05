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

### Implementace

**C123 Server:**
- Odstranit/deaktivovat `BR1BR2Merger` (server má být tenký)
- REST API už funguje správně

**Scoreboard V3:**
1. Detekce BR2: `raceId.includes('_BR2_')`
2. Při každém Results pro BR2:
   - Odvodit BR1 raceId (`_BR2_` → `_BR1_`)
   - **Debounced fetch** BR1 z REST (~500ms)
   - Merge BR1 + BR2 do Result[] s run1/run2
3. UI: zobrazit dva sloupce času, highlight lepšího

### Proč REST (bez cache)

- BR1 data jsou v XML stabilní (BR1 skončila dávno před BR2)
- REST je spolehlivější než TCP cache
- Funguje i když scoreboard startuje během BR2
- Jednodušší implementace (žádný state pro cache)

### Debouncing

Při BR2 přichází Results zprávy často (po každém dojetí).
Debounce ~500ms zajistí, že REST voláme max 2x za sekundu.

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
