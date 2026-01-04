# Claude Code Instructions - Canoe Scoreboard V3 - native Canoe123 support

## Projekt

Real-time scoreboard pro kanoistické slalomové závody. Nová verze pracující plnohodnotně s daty poskytované vrstvou C123 server.

---

## Cesty a dokumentace

| Účel | Cesta |
|------|-------|
| **Tento projekt** | `/workspace/csb-v2/canoe-scoreboard-v3/` - na startu kopie V2 včetně GIT atd |
| **Implementační plán** | `./PLAN.md` |
| **Scoreboard projekt s podporou CLI** | `../canoe-scoreboard-v2/` (READONLY - reference) |
| **Starý projekt V1** | `../canoe-scoreboard-original/` (READONLY - reference) |
| **Analýza** | `../analysis/` (důležitá reference, zápis změn jen po explicitním souhlasu od uživatele) |
| **C123 Server** | `../c123-server/` (důležitá reference, zápis změn jen po explicitním souhlasu od uživatele) |

### Klíčové reference

- **`../c123-server/docs`** - dokumentace C123 rozhraní, interace do scoreboardu a další, DULEZITE!
- **`../analysis`** - složka s rozsáhlou dokumentací k implementaci V2
- **`../analysis/captures/xboardtest02_jarni_v1.xml`** - XML struktura, BR1/BR2 formát

---

## Jazyk

- Komunikace a dokumentace: **čeština**
- Kód, komentáře, commit messages: **angličtina**

---

## Architektura

### Provider systém

Scoreboard používá abstraktní `DataProvider` interface s automatickým výběrem:

```
URL ?server=host:port
         │
         ▼
1. Probe server → /api/discover
    ├── ANO (C123 Server): C123ServerProvider (primární)
    └── NE: CLIProvider (fallback)

2. Pokud URL nezadáno:
    ├── localStorage cache
    ├── Autodiscover na síti
    └── Manuální konfigurace
```

**Klíčové soubory:**
| Soubor | Účel |
|--------|------|
| `src/providers/C123ServerProvider.ts` | Primární - WebSocket k C123 Server |
| `src/providers/CLIProvider.ts` | Fallback - legacy CLI protokol |
| `src/providers/utils/c123ServerMapper.ts` | Mapování C123 → scoreboard typy |
| `src/providers/utils/discovery-client.ts` | Auto-discovery C123 serveru |
| `src/context/ScoreboardContext.tsx` | State management, flow logika |

### Data flow

```
C123 Server (WebSocket)          CLI (WebSocket)
         │                              │
         ▼                              ▼
  c123ServerMapper.ts            cliMapper.ts
         │                              │
         └──────────┬──────────────────┘
                    ▼
          ScoreboardContext (reducer)
                    │
                    ▼
         React komponenty (Results, OnCourse, Title...)
```

---

## Timing konstanty

Soubor: `src/context/constants.ts`

| Konstanta | Hodnota | Účel |
|-----------|---------|------|
| `HIGHLIGHT_DURATION` | 5 000 ms | Jak dlouho je výsledek zvýrazněn (žlutý řádek) |
| `DEPARTING_TIMEOUT` | 3 000 ms | Jak dlouho se zobrazuje "odcházející" závodník |
| `FINISHED_GRACE_PERIOD` | 5 000 ms | Jak dlouho závodník s dtFinish zůstane v onCourse |

Další timing v `src/hooks/useAutoScroll.ts`:
- `pendingHighlightTimeout`: 10 000 ms - max čekání na Results po detekci dtFinish
- `highlightViewTime`: 5 000 ms - doba zobrazení highlighted row
- `pageInterval` (vertical): 12 000 ms - interval mezi scroll stránkami
- `pageInterval` (ledwall): 3 000 ms - rychlejší scroll pro LED wall

---

## Troubleshooting

### Scoreboard se nepřipojí k serveru
1. Zkontrolujte že C123 server běží: `curl http://host:port/api/discover`
2. Zkontrolujte CORS nastavení na serveru
3. Ověřte WebSocket port (typicky stejný jako HTTP)

### Závodník na trati bliká/mizí
- Problém partial messages: C123 server posílá OnCourse po jednom závodníkovi
- Řešení v `c123ServerMapper.ts`: detekce `total > competitors.length`
- Context merguje partial do existujícího seznamu místo nahrazení

### Výsledky se nezobrazují
1. Zkontrolujte `activeRaceId` - Results jsou filtrovány podle aktuální kategorie
2. Ověřte že Results message obsahuje správný `raceId`
3. Při změně kategorie se Results mažou (očekávané chování)

### Highlight nefunguje po dojetí
- Highlight je timestamp-based, ne diff-based
- Flow: dtFinish → pendingHighlightBib → čeká na Results → highlightBib
- Timeout 10s pokud Results nepřijdou
- Zkontrolujte `onCourseFinishedAt` v dev tools

### DNS/DNF/DSQ zobrazení
- Zobrazuje se pouze explicitní status z dat (ne inference)
- Prázdný čas bez statusu = `---`
- Styl: šedá, italic, opacity 0.7

---

## Vývoj a testování


Proces: Vždy, zejména u dodatečných požadavků a změn, nejprve aktualizovat dokumentaci jako plán a záměr, doplnit případné kroky do plánu a ty pak postupně realizovat. Snažit se plánované úkoly dělit do bloků, které jdou zvládnout pomocí claude code s opus 4.5 do cca 70% použitého kontextu, protože budeme pouštět na bloky postupně čerstvé instance. Commit nejpozději po každém bloku. Nedělat víc než jeden blok před clear nebo compact.

Změny do C123 Server jsou možné - zejména optimalizovat API pro využití ve scoreboardu. Udělá se to tak, že se vyhodí seznam požadavků na vedlejší projekt a v tom to provedeme. 

Výrazně doporučujeme testovat V3 scoreboard proti V2 na stejné sadě vstupních dat (třeba nahrávce). Kromě zobrazování výsledků dvou jízd musí být obsah, chování a logika ZCELA STEJNÁ (tedy je vhodné nejprve replikovat chování na jednu jízd a pak doručit zbytek - až po manuálním otestování uživatelem!). Pro soubežné testování je možné si pustit C123 server proti nahrávce, nebo jednotázově obohatit nahrávku o data přehraná přes C123 server ... to nějak vyřešíš. 

Pokud se zjistí nějaká odchylka od požadovaného chování, nebo se nedaří nějaký problém vyřešit nebo se ukáže že je větší, tak další postup je takový, že aktualizuješ plán o nové sekce a kroky dle potřeby a skončíš a necháš další práci na čerstvé instance.

Vývoj běží proti **nahraným datům z analýzy**:

```bash
# Úvodní Nahrávka obsahuje nativní TCP (Canoe123) i WS (CLI) data, ale ne C123-server data
../analysis/recordings/rec-2025-12-28T09-34-10.jsonl
```

Je ale možné testovat po domluvě i proti živému systému, ale vždy až nakonec, až je vše ostatní hotové. 

Piš si deníček vývoje - co šlo, co nešlo, co se zkusilo, atd. Ať se neprozkoumávají slepé uličky.

---

## Klíčové kvality

1. **Sledování flow závodu** - zobrazovat výsledky kategorie, která zrovna jede - tedy ta kde jede závodník, nebo když závodník nejede tak tu co poslední dojela.
2. **Zachování architektury a vzhledu SB** - V2 je dostatečně vyladěný, změny architektury by měly být spíš vzácné
3. **XML je živá databáze** - obsah se průběžně mění, je třeba reagvat přes api
4. **CLI necháváme** - jako sekundární rozhraní pro zpětnou kompatibilitu a specifické případy, C123 bude primární, může mít bohatší obsah a chování, CLI ale musí chovat tak jako V2


---

## Commit message formát

```
feat: add TcpSource with reconnect logic
fix: correct XML parsing for Results
test: add unit tests for FinishDetector
```

---

*Detailní plán implementace → viz `./PLAN.md`*
