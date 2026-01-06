# Canoe Scoreboard V3

Real-time scoreboard pro kanoistické slalomové závody. Nová verze s plnohodnotnou podporou C123 Server a zobrazením obou jízd BR1/BR2.

## Hlavní změny oproti V2

- **C123ServerProvider** jako primární zdroj dat (WebSocket JSON protokol)
- **BR1/BR2 merge zobrazení** - při závodech se dvěma jízdami zobrazí oba časy
- **ConfigPush** - vzdálená konfigurace přes C123 Server (layout, assets, clientId)
- **Asset management** - loga a bannery přes ConfigPush nebo URL parametry
- **scrollToFinished** - volitelné vypnutí scrollu při dojetí závodníka
- **Server-assigned clientId** - persistence přes localStorage

## Quick Start

```bash
# Instalace
npm install

# Development s replay daty
npm run dev

# Production build
npm run build
```

Po spuštění `npm run dev` se scoreboard spustí na http://localhost:5173 s ukázkovými daty.

## Instalace

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [npm](https://www.npmjs.com/) v9+

### Setup

```bash
git clone <repository-url>
cd canoe-scoreboard-v3
npm install
```

## URL parametry

| Parametr | Hodnoty | Default | Popis |
|----------|---------|---------|-------|
| `type` | `vertical`, `ledwall` | auto | Layout mód (detekce podle aspect ratio) |
| `displayRows` | `3-20` | auto | Počet řádků výsledků (ledwall scaling) |
| `customTitle` | text | - | Vlastní titulek (přepíše event name) |
| `scrollToFinished` | `true`, `false` | `true` | Scroll na dojetého závodníka |
| `disableScroll` | `true` | `false` | Vypne auto-scroll (pro screenshoty) |
| `clientId` | text | - | Identifikace klienta pro C123 Server |
| `server` | `host:port` | auto-discover | Adresa C123 Serveru |
| `source` | `c123`, `cli`, `replay` | `c123` | Zdroj dat |
| `host` | `ip:port` | - | Adresa CLI serveru (legacy) |
| `speed` | number | `10` | Rychlost replay |
| `loop` | `true`, `false` | `true` | Opakování replay |
| `logoUrl` | URL | `/assets/logo.svg` | Logo (levý horní roh) |
| `partnerLogoUrl` | URL | `/assets/partners.png` | Partner logo (pravý horní roh) |
| `footerImageUrl` | URL | `/assets/footer.png` | Footer banner (vertical only) |

### Příklady URL

**C123 Server (doporučeno):**
```
?server=192.168.1.50:27123
```

**Vertical display s custom titulkem:**
```
?type=vertical&customTitle=MČR%202025&server=192.168.1.50:27123
```

**Ledwall s 5 velkými řádky:**
```
?type=ledwall&displayRows=5&server=192.168.1.50:27123
```

**Bez scrollu při dojetí (pouze highlight):**
```
?scrollToFinished=false&server=192.168.1.50:27123
```

**Legacy CLI source:**
```
?source=cli&host=192.168.1.100:8081
```

**Development replay:**
```
?source=replay&speed=1&loop=true
```

## Layout módy

### Vertical (Portrait)

Pro TV displeje na výšku (1080×1920 doporučeno).

- Plný TopBar s logem a partnery
- Všechny sloupce: Pořadí, Číslo, Jméno, Penalizace, Čas, Ztráta
- Footer se sponzory
- BR1/BR2: dva sloupce s časy obou jízd

### Ledwall (Landscape)

Pro LED panely (768×384 nebo podobný široký poměr).

- Kompaktní TopBar
- Optimalizované sloupce (bez ztráty)
- Bez footeru
- BR1/BR2: pouze penalizace aktuální jízdy skryty (mohou být z jiné jízdy)

**Detekce:** Aspect ratio ≥ 1.5 → ledwall, jinak vertical.

### Ledwall Scaling (displayRows)

Pro vzdálené diváky použijte `displayRows` pro větší řádky:

```
?type=ledwall&displayRows=5    # 5 velkých řádků
?type=ledwall&displayRows=8    # 8 středních řádků
```

Celý layout se škáluje tak, aby přesně vyplnil viewport.

## Zdroje dat (Data Sources)

### C123ServerProvider (Primární)

Připojuje se k C123 Server přes WebSocket (port 27123) a přijímá JSON zprávy.

**Funkce:**
- Auto-discovery serveru v síti
- Automatické reconnect s exponential backoff
- REST API sync po reconnectu
- BR1/BR2 merge - zobrazí oba časy při závodech se dvěma jízdami
- ConfigPush - vzdálená konfigurace
- ForceRefresh - vzdálený reload

**URL:**
```
?server=192.168.1.50:27123
```

### CLIProvider (Fallback)

Legacy WebSocket připojení k CanoeLiveInterface.

```
?source=cli&host=192.168.1.100:8081
```

### ReplayProvider (Development)

Přehrává nahrané závody pro vývoj a testování.

```
?source=replay&speed=10&loop=true
```

Nahrávky jsou v `public/recordings/`.

## Asset management

### Výchozí assety

| Soubor | Popis | Doporučená velikost |
|--------|-------|---------------------|
| `public/assets/logo.svg` | Event/Club logo (vlevo nahoře) | SVG nebo 200px výška |
| `public/assets/partners.png` | Partner loga (vpravo nahoře) | 400×100px |
| `public/assets/footer.png` | Footer banner (vertical only) | 1080×200px |

### Vlastní assety

**Priorita (nejvyšší první):**
1. localStorage (uloženo z ConfigPush)
2. URL parametry
3. Výchozí assety

**Přes URL parametry:**
```
?logoUrl=/custom/logo.png&partnerLogoUrl=https://example.com/partners.png
```

**Přes ConfigPush (z C123 Server):**
```json
{
  "type": "ConfigPush",
  "data": {
    "assets": {
      "logoUrl": "/custom/logo.png",
      "partnerLogoUrl": "https://example.com/partners.png",
      "footerImageUrl": "data:image/png;base64,..."
    }
  }
}
```

Data URI jsou povoleny pouze přes ConfigPush (URL parametry by byly příliš dlouhé).

## BR1/BR2 zobrazení

Při závodech se dvěma jízdami (Best Run) scoreboard automaticky:

1. **Detekuje BR2 závod** podle RaceId (`_BR2_` suffix)
2. **Načte BR1 data** z REST API
3. **Zobrazí oba časy** ve dvou sloupcích

**Vertical layout:**
- Dva sloupce: BR1 a BR2
- Horší jízda má tlumenou barvu (`.worseRun`)
- Penalizace zobrazeny u obou jízd

**Ledwall layout:**
- Zobrazuje pouze celkový čas (best of both)
- Penalizace skryty (mohou být z jiné jízdy než zobrazený čas)

**Detaily:** viz [docs/SolvingBR1BR2.md](docs/SolvingBR1BR2.md)

## Deployment

### Web Server

```bash
npm run build
# Deploy obsahu `dist/` na web server
```

**nginx konfigurace:**
```nginx
server {
    listen 80;
    root /var/www/scoreboard;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Subdirectory deployment:**
```bash
VITE_BASE_URL=/scoreboard/ npm run build
```

### Raspberry Pi (FullPageOS)

1. Build a nasaďte `dist/` na web server
2. Nainstalujte [FullPageOS](https://github.com/guysoft/FullPageOS) na Raspberry Pi
3. Konfigurujte URL v `/boot/firmware/fullpageos.txt`:
   ```
   http://[server]/scoreboard/?type=vertical&server=[c123-ip]:27123
   ```
4. Pro vertical display nastavte orientaci v `/home/timing/scripts/start_gui`:
   ```
   DISPLAY_ORIENTATION=left
   ```
5. Restartujte Raspberry Pi

## ConfigPush (Vzdálená konfigurace)

C123 Server může posílat konfiguraci přes WebSocket:

```json
{
  "type": "ConfigPush",
  "data": {
    "clientId": "display-1",
    "type": "vertical",
    "displayRows": 10,
    "customTitle": "MČR 2025",
    "scrollToFinished": true,
    "assets": {
      "logoUrl": "/custom/logo.png",
      "partnerLogoUrl": "/custom/partners.png",
      "footerImageUrl": "/custom/footer.png"
    }
  }
}
```

Scoreboard odpoví `ClientState` zprávou s aktuální konfigurací a capabilities.

**Podporované capabilities:**
- `configPush` - přijímá ConfigPush zprávy
- `forceRefresh` - přijímá ForceRefresh pro reload
- `clientIdPush` - přijímá server-assigned clientId
- `scrollToFinished` - podporuje vypnutí scrollu při dojetí
- `assetManagement` - přijímá custom assety

## Testování

```bash
# Unit testy (Vitest)
npm test

# E2E testy (Playwright)
npm run test:e2e

# Všechny testy
npm run test:all

# Watch mode
npm run test:watch
```

**Coverage:**
- 559+ unit testů
- 82+ E2E testů
- Visual regression testing s Playwright snapshoty

## Architektura

### DataProvider Pattern

```
DataProvider (interface)
├── C123ServerProvider  - WebSocket k C123 Server (primární)
├── CLIProvider         - WebSocket k CLI server (fallback)
└── ReplayProvider      - Přehrávání nahrávek (development)
```

### Struktura komponent

```
App
└── ScoreboardProvider (context)
    └── ScoreboardLayout
        ├── TopBar (logo, partners)
        ├── TimeDisplay (denní čas)
        ├── Title (event name, kategorie)
        ├── CurrentCompetitor (na trati s brankami)
        ├── OnCourseDisplay (další závodníci - vertical only)
        ├── ResultsList (scrollable tabulka výsledků)
        └── Footer (sponzoři - vertical only)
```

### Struktura projektu

```
src/
├── components/      # React komponenty
├── context/         # ScoreboardContext (state management)
├── hooks/           # Custom hooks (useLayout, useAutoScroll, useAssets)
├── providers/       # DataProvider implementace
│   └── utils/       # API client, mapper, BR2Manager
├── styles/          # CSS (variables, reset, fonts)
├── types/           # TypeScript definice
└── utils/           # Utility funkce (assetStorage)

public/
├── assets/          # Výchozí loga a bannery
└── recordings/      # JSONL replay soubory

tests/
├── e2e/             # Playwright E2E testy
└── benchmarks/      # Performance benchmarky
```

## Troubleshooting

Viz [docs/troubleshooting.md](docs/troubleshooting.md)

**Časté problémy:**
- Scoreboard se nepřipojuje → zkontrolujte `?server=` parametr nebo auto-discovery
- Špatné pořadí → C123 systém posílá data, čekejte na aktualizaci
- Chybí BR1 data → REST API zpožděné, čekejte pár sekund
- Assety se nenačítají → zkontrolujte URL a CORS hlavičky

## Dokumentace

| Dokument | Popis |
|----------|-------|
| [docs/architecture.md](docs/architecture.md) | Architektura a data flow |
| [docs/timing.md](docs/timing.md) | Timing konstanty a flow |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Řešení problémů |
| [docs/testing.md](docs/testing.md) | Testování |
| [docs/SolvingBR1BR2.md](docs/SolvingBR1BR2.md) | BR1/BR2 merge analýza |

## Requirements

- Node.js 18+
- Moderní prohlížeč (Chrome, Firefox, Safari, Edge)
- Pro produkci: C123 Server nebo CLI server

## License

Private - pro kanoistické slalomové závody.

## Acknowledgments

- CanoeLiveInterface a původní scoreboard: Martin „Mako" Šlachta (STiming)
- Canoe123 timing system: Siwidata
- Český svaz kanoistiky
