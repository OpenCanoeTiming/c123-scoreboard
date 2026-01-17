# Claude Code Instructions - C123 Scoreboard

## Projekt

Real-time scoreboard pro kanoistické slalomové závody. Pracuje s daty z C123 serveru.

**GitHub:** OpenCanoeTiming/c123-scoreboard | **Licence:** MIT

---

## Cesty a dokumentace

| Účel | Cesta |
|------|-------|
| **Tento projekt** | `/workspace/timing/c123-scoreboard/` |
| **Implementační plán** | `./PLAN.md` |
| **Dokumentace** | `./docs/` |
| **C123 Server** | `../c123-server/` |
| **Protokol docs** | `../c123-protocol-docs/` |
| **Design system** | `../timing-design-system/` |
| **Legacy V1** | `/workspace/personal/canoe-scoreboard-original/` (archiv) |

### Projektová dokumentace

| Dokument | Popis |
|----------|-------|
| [docs/architecture.md](docs/architecture.md) | Architektura, data flow, klíčové soubory |
| [docs/timing.md](docs/timing.md) | Timing konstanty a flow diagramy |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Řešení běžných problémů |
| [docs/testing.md](docs/testing.md) | Testovací příkazy a pokrytí |
| [docs/DEVLOG.md](docs/DEVLOG.md) | Deníček vývoje |

### Externí reference

- **`../c123-server/docs`** - dokumentace C123 WebSocket API
- **`../c123-protocol-docs`** - dokumentace C123 protokolu a XML formátu
- **`../c123-protocol-docs/samples/`** - Statické XML vzorky pro referenci
- **`../c123-protocol-docs/recordings/`** - JSONL nahrávky pro vývoj a testování

---

## Jazyk

- Komunikace s uživatelem: **čeština**
- Dokumentace (README, docs): **angličtina**
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
../c123-protocol-docs/recordings/rec-2025-12-28T09-34-10.jsonl
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
