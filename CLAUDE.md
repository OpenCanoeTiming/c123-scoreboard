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

Stávající, Vychází z V2

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
