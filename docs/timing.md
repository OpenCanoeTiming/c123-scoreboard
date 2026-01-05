# Timing konstanty - Canoe Scoreboard V3

Všechny timeouty a grace period používané ve scoreboardu.

---

## Přehled konstant

| Konstanta | Hodnota | Soubor | Účel |
|-----------|---------|--------|------|
| `HIGHLIGHT_DURATION` | 5 000 ms | `constants.ts` | Jak dlouho je výsledek zvýrazněn (žlutý řádek) |
| `DEPARTING_TIMEOUT` | 3 000 ms | `constants.ts` | Jak dlouho se zobrazuje "odcházející" závodník |
| `FINISHED_GRACE_PERIOD` | 5 000 ms | `constants.ts` | Jak dlouho závodník s dtFinish zůstane v onCourse |

---

## Konstanty v useAutoScroll.ts

| Konstanta | Hodnota | Účel |
|-----------|---------|------|
| `pendingHighlightTimeout` | 10 000 ms | Max čekání na Results po detekci dtFinish |
| `highlightViewTime` | 5 000 ms | Doba zobrazení highlighted row |
| `pageInterval` (vertical) | 12 000 ms | Interval mezi scroll stránkami |
| `pageInterval` (ledwall) | 3 000 ms | Rychlejší scroll pro LED wall |

---

## Flow: Závodník dojede

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

---

## Použití v kódu

- **`useHighlight.ts`**: `useTimestamp(highlightTimestamp, HIGHLIGHT_DURATION)`
- **`useDeparting.ts`**: `useTimestamp(departedAt, DEPARTING_TIMEOUT)`
- **`ScoreboardContext.tsx`**: Grace period filtrování v SET_ON_COURSE reducer
- **`ScoreboardContext.tsx:211`**: `pendingAge < 10000` v SET_RESULTS reducer
