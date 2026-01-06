# Remote Configuration

Scoreboard V3 podporuje vzdálenou konfiguraci přes C123 Server pomocí WebSocket zpráv.

---

## ConfigPush

Zpráva `ConfigPush` umožňuje serveru vzdáleně měnit konfiguraci scoreboardu.

### Formát zprávy

```typescript
interface ConfigPushData {
  // Identifikace klienta
  clientId?: string

  // Layout
  type?: 'vertical' | 'ledwall'
  displayRows?: number
  customTitle?: string
  scrollToFinished?: boolean  // default: true

  // Assets (vnořený objekt)
  assets?: {
    logoUrl?: string
    partnerLogoUrl?: string
    footerImageUrl?: string
  }

  // Metadata (nepoužito scoreboardem)
  label?: string
  raceFilter?: string[]
  showOnCourse?: boolean
  showResults?: boolean
  custom?: Record<string, string | number | boolean>
}
```

### Podporovaná pole

| Pole | Typ | Popis |
|------|-----|-------|
| `clientId` | string | Identifikátor klienta - uloží se do localStorage |
| `type` | string | Layout mód: `vertical` nebo `ledwall` |
| `displayRows` | number | Počet zobrazených řádků (výchozí: 10) |
| `customTitle` | string | Vlastní název závodu (přepisuje eventName) |
| `scrollToFinished` | boolean | Scroll k závodníkovi po dojetí (výchozí: true) |
| `assets.logoUrl` | string | URL hlavního loga |
| `assets.partnerLogoUrl` | string | URL partnerského loga |
| `assets.footerImageUrl` | string | URL footer banneru |

### Chování

1. **URL parametry se aktualizují** - scoreboard přidá nové hodnoty do URL
2. **Page reload** - pokud se změnily URL parametry nebo assety
3. **ClientState response** - scoreboard odešle zpět potvrzení

### Příklad zprávy

```json
{
  "type": "ConfigPush",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "clientId": "scoreboard-1",
    "type": "vertical",
    "displayRows": 15,
    "customTitle": "MČR ve slalomu 2024",
    "scrollToFinished": true,
    "assets": {
      "logoUrl": "https://example.com/logo.png",
      "footerImageUrl": "/sponsors/banner.png"
    }
  }
}
```

---

## ClientState Response

Po přijetí ConfigPush scoreboard odešle zpět zprávu `ClientState` s aktuální konfigurací.

### Formát odpovědi

```typescript
interface ClientStateMessage {
  type: 'ClientState'
  timestamp: string
  data: {
    current: {
      clientId?: string
      type: string
      displayRows: number
      customTitle?: string
      scrollToFinished: boolean
      assets?: {
        logoUrl?: string
        partnerLogoUrl?: string
        footerImageUrl?: string
      }
    }
    version: string           // "3.0.0"
    capabilities: string[]    // podporované funkce
  }
}
```

### Capabilities

Scoreboard V3 hlásí tyto schopnosti:

| Capability | Popis |
|------------|-------|
| `configPush` | Přijímá ConfigPush zprávy |
| `forceRefresh` | Přijímá ForceRefresh zprávy |
| `clientIdPush` | Server může přiřadit clientId |
| `scrollToFinished` | Podporuje scrollToFinished parametr |
| `assetManagement` | Podporuje vzdálené nastavení assetů |

---

## ForceRefresh

Zpráva `ForceRefresh` vynutí reload stránky.

### Formát zprávy

```json
{
  "type": "ForceRefresh",
  "timestamp": "2024-01-15T10:35:00Z",
  "data": {
    "reason": "Configuration updated"
  }
}
```

### Použití

- **Deploy nové verze** - vynutí načtení nového kódu
- **Reset stavu** - vyčistí případné chyby
- **Konfigurace změněna mimo ConfigPush** - assety na serveru

---

## Asset Management

Scoreboard podporuje vlastní loga a bannery.

### Asset typy

| Asset | Pozice | Výchozí |
|-------|--------|---------|
| `logoUrl` | Levý horní roh | `/assets/logo.svg` |
| `partnerLogoUrl` | Pravý horní roh | `/assets/partners.png` |
| `footerImageUrl` | Footer banner | `/assets/footer.png` |

### Podporované formáty URL

- **Relativní**: `/assets/logo.png`, `images/logo.png`
- **Absolutní**: `https://example.com/logo.png`
- **Data URI**: `data:image/png;base64,...` (jen přes ConfigPush, ne URL param)

### Blokované schémata

Pro bezpečnost jsou odmítnuty:
- `javascript:`, `vbscript:`
- `ftp:`, `file:`
- `mailto:`, `tel:`

### Flow nastavení assetů

```
┌─────────────────────────────────────────────────────────────┐
│                      Asset Priority                          │
├─────────────────────────────────────────────────────────────┤
│  1. URL parametr (?logoUrl=...)                             │
│     ↓ (pokud není)                                          │
│  2. localStorage (z ConfigPush)                             │
│     ↓ (pokud není)                                          │
│  3. Výchozí hodnota (/assets/...)                           │
└─────────────────────────────────────────────────────────────┘
```

### localStorage persistence

Assety z ConfigPush se ukládají do `localStorage` pod klíčem `csb-assets`:

```json
{
  "logoUrl": "https://example.com/logo.png",
  "partnerLogoUrl": "/sponsors/partner.png",
  "footerImageUrl": "data:image/png;base64,..."
}
```

### Validace

Před uložením jsou assety validovány:

```typescript
function isValidAssetUrl(url: string): boolean {
  // Odmítne prázdné, javascript:, ftp:, file: atd.
  // Přijme http://, https://, data:image/, relativní cesty
}
```

---

## Client ID

Identifikace scoreboardu pro server.

### Účel

- **Rozlišení více klientů** - více scoreboardů na stejné síti
- **Cílená konfigurace** - server může poslat ConfigPush konkrétnímu klientu
- **Logging** - identifikace v server logách

### Fallback chain

```
┌─────────────────────────────────────────────────────────────┐
│                    clientId Priority                         │
├─────────────────────────────────────────────────────────────┤
│  1. URL parametr (?clientId=scoreboard-1)                   │
│     ↓ (pokud není)                                          │
│  2. localStorage (z ConfigPush)                             │
│     ↓ (pokud není)                                          │
│  3. null → server identifikuje podle IP                     │
└─────────────────────────────────────────────────────────────┘
```

### Server-assigned clientId

Server může přiřadit clientId přes ConfigPush:

1. Server pošle `ConfigPush` s `clientId: "scoreboard-main"`
2. Scoreboard uloží do `localStorage` (`c123-clientId`)
3. Scoreboard aktualizuje URL parametr a reloaduje
4. Při dalších připojeních použije uložené ID

### localStorage klíče

| Klíč | Popis |
|------|-------|
| `c123-server-url` | Cached URL serveru (auto-discovery) |
| `c123-clientId` | Server-assigned client ID |
| `csb-assets` | Asset URLs z ConfigPush |

---

## WebSocket připojení

### URL formát

```
ws://{server}:27123/ws
ws://{server}:27123/ws?clientId={id}
```

### Příklad

```typescript
// Bez clientId (identifikace podle IP)
const ws = new WebSocket('ws://192.168.1.50:27123/ws')

// S clientId
const ws = new WebSocket('ws://192.168.1.50:27123/ws?clientId=scoreboard-1')
```

### Handshake

Po připojení server pošle `Connected` zprávu:

```json
{
  "type": "Connected",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "version": "1.0.0",
    "c123Connected": true,
    "xmlLoaded": true
  }
}
```

---

## Implementace

### Relevantní soubory

| Soubor | Popis |
|--------|-------|
| `src/providers/C123ServerProvider.ts` | Hlavní provider, ConfigPush handling |
| `src/providers/utils/discovery-client.ts` | Auto-discovery, clientId management |
| `src/utils/assetStorage.ts` | Asset persistence, validace |
| `src/hooks/useAssets.ts` | React hook pro assety |
| `src/types/c123server.ts` | TypeScript typy pro zprávy |

### handleConfigPush flow

```typescript
// 1. Validace a uložení assetů
const newAssets = validateAssets(data.assets)
if (hasChanges(currentAssets, newAssets)) {
  saveAssets(newAssets)  // localStorage
}

// 2. Aktualizace URL parametrů
const url = new URL(window.location.href)
if (data.clientId) url.searchParams.set('clientId', data.clientId)
if (data.type) url.searchParams.set('type', data.type)
// ... další parametry

// 3. Reload pokud se změnilo URL nebo assety
if (url.href !== window.location.href || hasAssetChanges) {
  window.location.href = url.href
}

// 4. ClientState response
sendClientState(data)
```

---

## Troubleshooting

### ConfigPush se neaplikuje

1. Zkontrolujte WebSocket connection v DevTools
2. Ověřte formát zprávy (validní JSON, správná struktura)
3. Zkontrolujte console.log pro chyby validace

### Assety se nezobrazují

1. Ověřte, že URL je platná (ne javascript:, file: apod.)
2. Zkontrolujte CORS pro external URLs
3. Pro data URI - zkontrolujte base64 encoding

### clientId se neukládá

1. Zkontrolujte, že localStorage je dostupný
2. Ověřte, že prohlížeč není v private mode
3. Zkontrolujte `localStorage.getItem('c123-clientId')` v DevTools

---

## Viz také

- [URL Parameters Reference](url-parameters.md) - kompletní seznam parametrů
- [Architecture](architecture.md) - celková architektura
- [Troubleshooting](troubleshooting.md) - řešení problémů
