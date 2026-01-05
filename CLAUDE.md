# Claude Code Instructions - Canoe Scoreboard V3

## Projekt

Real-time scoreboard pro kanoistické slalomové závody. Nová verze pracující plnohodnotně s daty poskytované vrstvou C123 server.

---

## Cesty a dokumentace

| Účel | Cesta |
|------|-------|
| **Tento projekt** | `/workspace/csb-v2/canoe-scoreboard-v3/` |
| **Implementační plán** | `./PLAN.md` |
| **Dokumentace** | `./docs/` |
| **Scoreboard V2** | `../canoe-scoreboard-v2/` (READONLY - reference) |
| **Starý projekt V1** | `../canoe-scoreboard-original/` (READONLY - reference) |
| **Analýza** | `../analysis/` (důležitá reference) |
| **C123 Server** | `../c123-server/` (důležitá reference) |

### Projektová dokumentace

| Dokument | Popis |
|----------|-------|
| [docs/architecture.md](docs/architecture.md) | Architektura, data flow, klíčové soubory |
| [docs/timing.md](docs/timing.md) | Timing konstanty a flow diagramy |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Řešení běžných problémů |
| [docs/testing.md](docs/testing.md) | Testovací příkazy a pokrytí |
| [docs/DEVLOG.md](docs/DEVLOG.md) | Deníček vývoje |

### Externí reference

- **`../c123-server/docs`** - dokumentace C123 rozhraní
- **`../analysis`** - dokumentace k implementaci V2
- **`../analysis/captures/xboardtest02_jarni_v1.xml`** - XML struktura, BR1/BR2 formát

---

## Jazyk

- Komunikace a dokumentace: **čeština**
- Kód, komentáře, commit messages: **angličtina**

---

## Architektura (stručně)

Scoreboard používá abstraktní `DataProvider` interface:
- **C123ServerProvider** - primární (WebSocket k C123 Server)
- **CLIProvider** - fallback (legacy CLI protokol)

Detaily viz [docs/architecture.md](docs/architecture.md).

---

## Vývoj a testování

**Proces:**
1. Aktualizovat dokumentaci jako plán a záměr
2. Doplnit kroky do `PLAN.md`
3. Realizovat po blocích (cca 70% kontextu per blok)
4. Commit nejpozději po každém bloku
5. Nedělat víc než jeden blok před clear/compact

**Testování:**
- Vždy testovat V3 proti V2 na stejných vstupních datech
- Obsah, chování a logika musí být ZCELA STEJNÁ (kromě BR1/BR2 merge)
- Příkazy viz [docs/testing.md](docs/testing.md)

**Nahrávka pro vývoj:**
```bash
../analysis/recordings/rec-2025-12-28T09-34-10.jsonl
```

**Deníček:** Zapisovat průběh do [docs/DEVLOG.md](docs/DEVLOG.md).

---

## Klíčové kvality

1. **Sledování flow závodu** - zobrazovat výsledky kategorie, která zrovna jede
2. **Zachování architektury a vzhledu** - V2 je vyladěný, změny vzácné
3. **XML je živá databáze** - obsah se průběžně mění, reagovat přes API
4. **CLI necháváme** - jako sekundární rozhraní pro zpětnou kompatibilitu

---

## Commit message formát

```
feat: add TcpSource with reconnect logic
fix: correct XML parsing for Results
test: add unit tests for FinishDetector
```

---

*Detailní plán implementace → viz `./PLAN.md`*
