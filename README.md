# Canoe Scoreboard V3

Real-time scoreboard for canoe slalom races. New version with full C123 Server support and dual run BR1/BR2 display.

## Key Changes from V2

- **C123ServerProvider** as primary data source (WebSocket JSON protocol)
- **BR1/BR2 merge display** - shows both times for dual-run races
- **ConfigPush** - remote configuration via C123 Server (layout, assets, clientId)
- **Asset management** - logos and banners via ConfigPush or URL parameters
- **scrollToFinished** - optional disable scroll on competitor finish
- **Server-assigned clientId** - persistence via localStorage

## Quick Start

```bash
# Install
npm install

# Development with replay data
npm run dev

# Production build
npm run build
```

After running `npm run dev`, the scoreboard starts at http://localhost:5173 with sample data.

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [npm](https://www.npmjs.com/) v9+

### Setup

```bash
git clone <repository-url>
cd canoe-scoreboard-v3
npm install
```

## URL Parameters

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `type` | `vertical`, `ledwall` | auto | Layout mode (auto-detected by aspect ratio) |
| `displayRows` | `3-20` | auto | Number of result rows (ledwall scaling) |
| `customTitle` | text | - | Custom title (overrides event name) |
| `scrollToFinished` | `true`, `false` | `true` | Scroll to finished competitor |
| `disableScroll` | `true` | `false` | Disable auto-scroll (for screenshots) |
| `clientId` | text | - | Client identification for C123 Server |
| `server` | `host:port` | auto-discover | C123 Server address |
| `source` | `c123`, `cli`, `replay` | `c123` | Data source |
| `host` | `ip:port` | - | CLI server address (legacy) |
| `speed` | number | `10` | Replay speed |
| `loop` | `true`, `false` | `true` | Replay loop |
| `logoUrl` | URL | `/assets/logo.svg` | Logo (top left corner) |
| `partnerLogoUrl` | URL | `/assets/partners.png` | Partner logo (top right corner) |
| `footerImageUrl` | URL | `/assets/footer.png` | Footer banner (vertical only) |

### URL Examples

**C123 Server (recommended):**
```
?server=192.168.1.50:27123
```

**Vertical display with custom title:**
```
?type=vertical&customTitle=National%20Championship%202025&server=192.168.1.50:27123
```

**Ledwall with 5 large rows:**
```
?type=ledwall&displayRows=5&server=192.168.1.50:27123
```

**Without scroll on finish (highlight only):**
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

## Layout Modes

### Vertical (Portrait)

For portrait TV displays (1080×1920 recommended).

- Full TopBar with logo and partners
- All columns: Rank, Bib, Name, Penalties, Time, Gap
- Footer with sponsors
- BR1/BR2: two columns with times from both runs

### Ledwall (Landscape)

For LED panels (768×384 or similar wide aspect ratio).

- Compact TopBar
- Optimized columns (without gap)
- No footer
- BR1/BR2: only current run penalties hidden (may be from different run)

**Detection:** Aspect ratio ≥ 1.5 → ledwall, otherwise vertical.

### Ledwall Scaling (displayRows)

For distant viewers, use `displayRows` for larger rows:

```
?type=ledwall&displayRows=5    # 5 large rows
?type=ledwall&displayRows=8    # 8 medium rows
```

The entire layout scales to exactly fill the viewport.

## Data Sources

### C123ServerProvider (Primary)

Connects to C123 Server via WebSocket (port 27123) and receives JSON messages.

**Features:**
- Auto-discovery of server on network
- Automatic reconnect with exponential backoff
- REST API sync after reconnect
- BR1/BR2 merge - displays both times for dual-run races
- ConfigPush - remote configuration
- ForceRefresh - remote reload

**URL:**
```
?server=192.168.1.50:27123
```

### CLIProvider (Fallback)

Legacy WebSocket connection to CanoeLiveInterface.

```
?source=cli&host=192.168.1.100:8081
```

### ReplayProvider (Development)

Plays back recorded races for development and testing.

```
?source=replay&speed=10&loop=true
```

Recordings are in `public/recordings/`.

## Asset Management

### Default Assets

| File | Description | Recommended Size |
|------|-------------|------------------|
| `public/assets/logo.svg` | Event/Club logo (top left) | SVG or 200px height |
| `public/assets/partners.png` | Partner logos (top right) | 400×100px |
| `public/assets/footer.png` | Footer banner (vertical only) | 1080×200px |

### Custom Assets

**Priority (highest first):**
1. localStorage (saved from ConfigPush)
2. URL parameters
3. Default assets

**Via URL parameters:**
```
?logoUrl=/custom/logo.png&partnerLogoUrl=https://example.com/partners.png
```

**Via ConfigPush (from C123 Server):**
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

Data URIs are only allowed via ConfigPush (URL parameters would be too long).

## BR1/BR2 Display

For dual-run (Best Run) races, the scoreboard automatically:

1. **Detects BR2 race** by RaceId (`_BR2_` suffix)
2. **Loads BR1 data** from REST API
3. **Displays both times** in two columns

**Vertical layout:**
- Two columns: BR1 and BR2
- Worse run has muted color (`.worseRun`)
- Penalties shown for both runs

**Ledwall layout:**
- Shows only overall time (best of both)
- Penalties hidden (may be from different run than displayed time)

**Details:** see [docs/SolvingBR1BR2.md](docs/SolvingBR1BR2.md)

## Deployment

### Web Server

```bash
npm run build
# Deploy `dist/` contents to web server
```

**nginx configuration:**
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

1. Build and deploy `dist/` to web server
2. Install [FullPageOS](https://github.com/guysoft/FullPageOS) on Raspberry Pi
3. Configure URL in `/boot/firmware/fullpageos.txt`:
   ```
   http://[server]/scoreboard/?type=vertical&server=[c123-ip]:27123
   ```
4. For vertical display, set orientation in `/home/timing/scripts/start_gui`:
   ```
   DISPLAY_ORIENTATION=left
   ```
5. Restart Raspberry Pi

## ConfigPush (Remote Configuration)

C123 Server can send configuration via WebSocket:

```json
{
  "type": "ConfigPush",
  "data": {
    "clientId": "display-1",
    "type": "vertical",
    "displayRows": 10,
    "customTitle": "National Championship 2025",
    "scrollToFinished": true,
    "assets": {
      "logoUrl": "/custom/logo.png",
      "partnerLogoUrl": "/custom/partners.png",
      "footerImageUrl": "/custom/footer.png"
    }
  }
}
```

Scoreboard responds with `ClientState` message containing current configuration and capabilities.

**Supported capabilities:**
- `configPush` - accepts ConfigPush messages
- `forceRefresh` - accepts ForceRefresh for reload
- `clientIdPush` - accepts server-assigned clientId
- `scrollToFinished` - supports disable scroll on finish
- `assetManagement` - accepts custom assets

## Testing

```bash
# Unit tests (Vitest)
npm test

# E2E tests (Playwright)
npm run test:e2e

# All tests
npm run test:all

# Watch mode
npm run test:watch
```

**Coverage:**
- 559+ unit tests
- 82+ E2E tests
- Visual regression testing with Playwright snapshots

## Architecture

### DataProvider Pattern

```
DataProvider (interface)
├── C123ServerProvider  - WebSocket to C123 Server (primary)
├── CLIProvider         - WebSocket to CLI server (fallback)
└── ReplayProvider      - Recording playback (development)
```

### Component Structure

```
App
└── ScoreboardProvider (context)
    └── ScoreboardLayout
        ├── TopBar (logo, partners)
        ├── TimeDisplay (time of day)
        ├── Title (event name, category)
        ├── CurrentCompetitor (on course with gates)
        ├── OnCourseDisplay (next competitors - vertical only)
        ├── ResultsList (scrollable results table)
        └── Footer (sponsors - vertical only)
```

### Project Structure

```
src/
├── components/      # React components
├── context/         # ScoreboardContext (state management)
├── hooks/           # Custom hooks (useLayout, useAutoScroll, useAssets)
├── providers/       # DataProvider implementations
│   └── utils/       # API client, mapper, BR2Manager
├── styles/          # CSS (variables, reset, fonts)
├── types/           # TypeScript definitions
└── utils/           # Utility functions (assetStorage)

public/
├── assets/          # Default logos and banners
└── recordings/      # JSONL replay files

tests/
├── e2e/             # Playwright E2E tests
└── benchmarks/      # Performance benchmarks
```

## Troubleshooting

See [docs/troubleshooting.md](docs/troubleshooting.md)

**Common issues:**
- Scoreboard not connecting → check `?server=` parameter or auto-discovery
- Wrong ranking → C123 system sends data, wait for update
- Missing BR1 data → REST API delayed, wait a few seconds
- Assets not loading → check URL and CORS headers

## Documentation

| Document | Description |
|----------|-------------|
| [docs/architecture.md](docs/architecture.md) | Architecture and data flow |
| [docs/timing.md](docs/timing.md) | Timing constants and flow |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Problem solving |
| [docs/testing.md](docs/testing.md) | Testing |
| [docs/SolvingBR1BR2.md](docs/SolvingBR1BR2.md) | BR1/BR2 merge analysis |

## Requirements

- Node.js 18+
- Modern browser (Chrome, Firefox, Safari, Edge)
- For production: C123 Server or CLI server

## License

MIT - for canoe slalom races.

## Acknowledgments

- CanoeLiveInterface and original scoreboard: Martin "Mako" Šlachta (STiming)
- Canoe123 timing system: Siwidata
- Czech Canoe Federation
