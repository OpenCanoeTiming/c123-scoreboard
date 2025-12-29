# Claude Code Instructions - Canoe Scoreboard V2

## Projekt

Real-time scoreboard pro kanoistické slalomové závody. Reimplementace původního projektu s čistou architekturou.

---

## Cesty a dokumentace

| Účel | Cesta |
|------|-------|
| **Tento projekt** | `/workspace/csb-v2/canoe-scoreboard-v2/` |
| **Checklist** | `./csb-v2-implementacni-checklist.md` |
| **Analýza** | `../analysis/` (READONLY) |
| **Originál** | `../canoe-scoreboard-original/` (READONLY) |
| **Prototyp** | `../canoe-scoreboard-v2-prototype/` (reference pro styly) |

### Klíčové dokumenty v analýze

- **`08-plan-reimplementace.md`** - architektura, DataProvider, edge cases, fáze
- **`07-sitova-komunikace.md`** - CLI/C123 protokoly, detekce dojetí
- **`06-styly.md`** - CSS variables, layouty, **ověřené computed styles**
- **`03-state-management.md`** - WebSocket, Layout, ScrollManager principy
- **`04-display-komponenty.md`** - ResultsList, CurrentCompetitor, atd.

---

## Jazyk

- Komunikace a dokumentace: **čeština**
- Kód, komentáře, commit messages: **angličtina**

---

## Implementační rozhodnutí (odlišnosti od analýzy)

Tato rozhodnutí platí pro tento projekt a mohou se lišit od doporučení v analýze:

### 1. ReplayProvider jako primární zdroj během vývoje

Celý vývoj probíhá na nahraných datech (`../analysis/recordings/rec-2025-12-28T09-34-10.jsonl`).
CLIProvider a případně C123Provider se přidají až když je grafika a interakce ověřená.

**Výhody:**
- Opakovatelné testování stejných scénářů
- Nezávislost na běžícím serveru
- Možnost testovat edge cases (rychlé dojezdy, reconnect)

### 2. Skutečná responsivita od začátku (ne transform: scale)

**Cíl:** Ledwall na jakékoliv rozlišení - více pixelů = více řádků, ne větší pixely.

**Implementace:**
- `useLayout` hook počítá dynamický počet řádků podle skutečné výšky viewportu
- CSS Variables nastavované JavaScriptem (`--visible-rows`, `--row-height`)
- Žádné `transform: scale()` - komponenty v nativním rozlišení
- Breakpointy pro strukturální změny (počet sloupců), kontinuální pro velikosti

**Příklad:**
```typescript
function useLayout() {
  const { width, height } = useViewport();
  const headerHeight = 60;
  const minRowHeight = 32;
  const maxRowHeight = 56;

  const availableHeight = height - headerHeight;
  const visibleRows = Math.floor(availableHeight / 45);
  const rowHeight = Math.min(maxRowHeight, Math.max(minRowHeight, availableHeight / visibleRows));

  return {
    visibleRows,
    rowHeight,
    showBehind: width > 600,
    showPenalty: width > 400,
    layoutMode: height > width * 1.5 ? 'vertical' : 'ledwall',
  };
}
```

### 3. Průběžné testy

Testy se píší průběžně pro každou dokončenou část, ne až na konci.
- Unit testy pro utility funkce ihned po jejich vytvoření
- Integration testy pro providery ihned po implementaci
- Vitest jako testovací framework

### 4. Timestamp-based highlight expiration

Žádné `setTimeout` pro highlight - pouze timestamp a výpočet v renderovací logice.
(Detailně v analýze `08-plan-reimplementace.md`)

---

## Workflow

1. Zkontrolovat checklist `csb-v2-implementacni-checklist.md`
2. Najít aktuální krok (první `[ ]`)
3. Implementovat podle dokumentace v `../analysis/`
4. **Napsat testy** pro dokončenou část
5. Testovat na ReplayProvider s nahranými daty
6. Označit v checklistu `[x]`
7. Pokračovat dalším krokem

Rozhodnuti z manualniho testovani mohou prebit puvodni projektove zamery a implementacni rozhodnuti, protoze se jedna o zjisteni na zaklade testovani skutecneho produktu behem vyvoje.

---

## Testovací data

```bash
# Nahrávka ~4 min, obsahuje dojezdy, přechody kategorií, penalizace
../analysis/recordings/rec-2025-12-28T09-34-10.jsonl
```

**Použití:**
```typescript
const provider = new ReplayProvider({
  source: '../analysis/recordings/rec-2025-12-28T09-34-10.jsonl',
  speed: 1.0,  // nebo 2.0 pro rychlejší playback
});
```

---

## Commit message formát

```
feat: add ResultsList component with highlight
fix: correct highlight expiration timing
test: add unit tests for formatTime
```

---

*Detaily implementace → viz `../analysis/08-plan-reimplementace.md`*
*Styly a hodnoty → viz `../analysis/06-styly.md` (sekce Ověřené styly)*
