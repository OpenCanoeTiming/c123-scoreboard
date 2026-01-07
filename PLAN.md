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
