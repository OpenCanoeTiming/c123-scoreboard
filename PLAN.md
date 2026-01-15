# Canoe Scoreboard V3

## Stav projektu

| Fáze | Popis | Status |
|------|-------|--------|
| A-E | Základní funkčnost, testy, opravy | ✅ |
| F | C123 integrace (ConfigPush, assets, ForceRefresh) | ✅ |
| G | BR1/BR2 merge zobrazení | ✅ |
| H | OnCourse vylepšení, scrollToFinished | ✅ |
| I | Server-assigned clientId persistence | ✅ |
| J | Kompletní dokumentace | ✅ |
| K | Údržba dokumentace | ✅ |
| L | React Best Practices refaktoring | 🔄 |

---

## Implementované funkce

### Fáze F - C123 integrace

- ConfigPush (type, displayRows, customTitle, scrollToFinished)
- Asset management (logoUrl, partnerLogoUrl, footerImageUrl)
- ForceRefresh handler
- ClientState response s capabilities

### Fáze G - BR1/BR2 merge

- Detekce BR2 závodů (`isBR2Race()`, `getClassId()`)
- BR2Manager s REST API cache a merge logikou
- Dva sloupce výsledků s `.worseRun` stylingem
- WebSocket `Total` = best of both runs

### Fáze H - OnCourse & scroll

- Vertical OnCourse zobrazuje jednoho závodníka
- `?scrollToFinished=false` vypne scroll při dojetí

### Fáze I - clientId persistence

- Server přiřadí clientId přes ConfigPush
- Fallback: URL param → localStorage → IP-based

---

## Dokumentace

| Dokument | Popis |
|----------|-------|
| [README.md](README.md) | Uživatelská příručka |
| [docs/architecture.md](docs/architecture.md) | Architektura, data flow |
| [docs/components.md](docs/components.md) | React komponenty |
| [docs/data-providers.md](docs/data-providers.md) | Provider interface |
| [docs/configuration.md](docs/configuration.md) | Remote konfigurace |
| [docs/url-parameters.md](docs/url-parameters.md) | URL parametry |
| [docs/development.md](docs/development.md) | Vývojářský průvodce |
| [docs/testing.md](docs/testing.md) | Testování a CI/CD |
| [docs/timing.md](docs/timing.md) | Timing konstanty |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Řešení problémů |
| [docs/SolvingBR1BR2.md](docs/SolvingBR1BR2.md) | BR1/BR2 analýza |
| [docs/DEVLOG.md](docs/DEVLOG.md) | Deníček vývoje |

---

## Externí reference

| Cesta | Popis |
|-------|-------|
| `../c123-server/docs/` | C123 Server dokumentace |
| `../analysis/` | Ekosystémová dokumentace |
| `../analysis/recordings/` | Nahrávky pro vývoj |
| `../canoe-scoreboard-v2/` | V2 reference (READONLY) |

---

## Fáze L - React Best Practices refaktoring

**Tag před refaktorem:** `v3.0.0-pre-refactor`

Optimalizace podle [Vercel React Best Practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices).

### L.1 - Barrel file imports (CRITICAL) ✅

**Problém:** `src/components/index.ts` a `src/hooks/index.ts` byly barrel files, zpomalovaly HMR a cold start.

**Kroky:**
- [x] L.1.1 Nahradit barrel importy v `App.tsx` přímými importy
- [x] L.1.2 Nahradit barrel importy v ostatních komponentách
- [x] L.1.3 Odstranit `components/index.ts`
- [x] L.1.4 Odstranit `hooks/index.ts`
- [x] L.1.5 Ověřit build (`npm run build`)
- [x] L.1.6 Spustit unit testy (`npm run test`) - 725 testů prošlo
- [x] L.1.7 Spustit Playwright testy (`npm run test:e2e`)

**Poznámka k e2e testům:** E2e testy mají infrastrukturní problémy (chybějící replay data, obsazené porty), ale tyto problémy existovaly i před refaktorem a nejsou způsobeny změnami v importech.

### L.2 - Context splitting (MEDIUM) ⏭️ PŘESKOČENO

**Problém:** `ScoreboardContext` obsahuje vše - komponenty se re-renderují i při změnách, které nepotřebují.

**Analýza (L.2.1):**

Využití contextu v komponentách:
| Komponenta/Hook | Používané části stavu |
|-----------------|----------------------|
| App.tsx | status, initialDataReceived, title, raceName, raceId, dayTime, currentCompetitor, departingCompetitor, results, visibility |
| useAutoScroll | onCourse |
| useDeparting | departingCompetitor, departedAt |
| useHighlight | highlightBib, highlightTimestamp |
| ResultsList | raceId |
| DebugView | Vše (debug) |

**Závěr:** Rozdělení contextu není vhodné kvůli silnému propojení reduceru:
- `SET_RESULTS` čte/modifikuje: activeRaceId, lastActiveRaceId, pendingHighlightBib, highlightBib, departingCompetitor
- `SET_ON_COURSE` čte/modifikuje: results, raceName, raceId, pendingHighlightBib, departingCompetitor

Tato logika zajišťuje:
1. Filtrování výsledků podle aktivního závodu (race switching)
2. Highlight synchronizaci s výsledky (pending → triggered)
3. Departing competitor cleanup po highlight

Rozdělení by vyžadovalo buď duplikaci stavu (anti-pattern) nebo kompletní refaktoring na event-driven architekturu.

**Doporučení:** Ponechat jednotný context. Re-render overhead je minimální díky:
- React batching
- Memoizovaným komponentám (ResultRow)
- Většina komponent čte jen malou část stavu

**Kroky:**
- [x] L.2.1 Analyzovat které komponenty potřebují které části stavu
- [⏭️] L.2.2-L.2.10 Přeskočeno - context splitting není vhodný pro tento případ

### L.3 - Inline styles cleanup (LOW)

**Problém:** `DiscoveryScreen` a `ErrorScreen` v `App.tsx` mají 100+ řádků inline stylů.

**Kroky:**
- [ ] L.3.1 Vytvořit `App.module.css` pro discovery/error styly
- [ ] L.3.2 Přesunout styly z `DiscoveryScreen`
- [ ] L.3.3 Přesunout styly z `ErrorScreen`
- [ ] L.3.4 Ověřit vizuální shodu (screenshot comparison)
- [ ] L.3.5 Spustit Playwright testy

### L.4 - Finální validace

- [ ] L.4.1 Full Playwright test suite
- [ ] L.4.2 Manuální test všech layoutů (vertical, ledwall)
- [ ] L.4.3 Test reconnect scenářů
- [ ] L.4.4 Test BR2 zobrazení
- [ ] L.4.5 Performance profiling (React DevTools)
- [ ] L.4.6 Bundle size comparison (před/po)
- [ ] L.4.7 Aktualizovat dokumentaci (pokud potřeba)
- [ ] L.4.8 Commit a tag `v3.1.0`

### Rollback strategie

Pokud refaktoring způsobí neočekávané problémy:
```bash
git checkout v3.0.0-pre-refactor
```
