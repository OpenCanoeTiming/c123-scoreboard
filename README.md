# Canoe Scoreboard v2

Real-time scoreboard display for canoe slalom competitions. Visual replica of the original scoreboard with clean modern architecture.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (uses recorded demo data)
npm run dev
```

Open `http://localhost:5173` to see the scoreboard in action.

## Production Usage

### Connect to Live Timing Server

```bash
# Build for production
npm run build

# Serve static files (use any static file server)
npm run preview
```

Access with CLI server connection:
```
http://localhost:4173/?source=cli&host=192.168.1.100:8081
```

### Deployment on Raspberry Pi

1. Copy the `dist/` folder to Raspberry Pi
2. Serve with nginx or any static file server
3. Open in fullscreen browser (kiosk mode)

Example nginx config:
```nginx
server {
    listen 80;
    root /var/www/scoreboard;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## URL Parameters

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `type` | `vertical`, `ledwall` | auto | Force layout mode |
| `ledwallExactSize` | `true` | `false` | Use exact LED panel dimensions |
| `source` | `replay`, `cli` | `replay` | Data source |
| `host` | `ip:port` | `192.168.68.108:8081` | CLI server address |
| `speed` | number | `10` | Replay speed multiplier |
| `loop` | `true`, `false` | `true` | Loop replay |

### Common Configurations

**LED Wall (768x384):**
```
?type=ledwall&ledwallExactSize=true&source=cli&host=192.168.1.100:8081
```

**Vertical Display (1080x1920):**
```
?type=vertical&source=cli&host=192.168.1.100:8081
```

**Development with slow replay:**
```
?source=replay&speed=1
```

## Layouts

### Vertical (Portrait)
- For TV displays in portrait mode (1080x1920)
- Shows full TopBar with logo and partners
- All result columns visible: Rank, Bib, Name, Penalty, Time, Behind
- Footer with sponsors visible

### Ledwall (Landscape)
- For LED panels (768x384 or similar)
- Compact TopBar
- Optimized column layout
- Footer hidden

Layout is auto-detected based on aspect ratio, or forced via `type` parameter.

## Data Sources

### CLIProvider (Production)

Connects to the CLI WebSocket server for live timing data.

```
?source=cli&host=192.168.1.100:8081
```

Features:
- Automatic reconnection with exponential backoff
- Real-time race results and competitor data
- Visibility control from timing system
- Day time display

### ReplayProvider (Development)

Replays recorded race sessions for development and testing.

```
?source=replay&speed=10
```

Recorded sessions are stored in `public/recordings/`.

## Custom Assets

Replace these files in `public/assets/` to customize the display:

| File | Description | Recommended Size |
|------|-------------|------------------|
| `logo.svg` | Event/Club logo (top-left) | SVG or 200px height |
| `partners.png` | Partner logos (top-right) | 400x100px |
| `footer.png` | Footer banner | 1080x200px |

## Testing

```bash
npm test          # Unit tests (Vitest)
npm run test:e2e  # E2E tests (Playwright)
```

## Architecture

### DataProvider Pattern

Abstracts data sources for easy switching between live and replay modes:

```
DataProvider
├── CLIProvider    - WebSocket to CLI server
├── ReplayProvider - Recorded session playback
└── C123Provider   - Direct TCP to timing (future)
```

### Component Structure

```
App
└── ScoreboardProvider (context)
    └── ScoreboardLayout
        ├── TopBar (logo, partners)
        ├── TimeDisplay (day time)
        ├── Title (event name, category)
        ├── CurrentCompetitor (on-course with gates)
        ├── OnCourseDisplay (other competitors on course)
        ├── ResultsList (scrollable results table)
        └── Footer (sponsors)
```

### Key Features

- **Highlight Animation**: Competitor flashes when finishing
- **Auto-Scroll**: Results scroll through automatically
- **Gate Badges**: Visual penalty indicators (yellow=2s, red=50s)
- **Connection Status**: Overlay shows connection state
- **Error Boundaries**: Component failures don't crash app

## Project Structure

```
src/
├── components/      # React components
├── context/         # ScoreboardContext (state management)
├── hooks/           # Custom hooks (useLayout, useAutoScroll, etc.)
├── providers/       # DataProvider implementations
├── styles/          # CSS (variables, reset, fonts)
├── types/           # TypeScript definitions
└── utils/           # Utility functions

public/
├── assets/          # Images (logo, partners, footer)
└── recordings/      # JSONL replay files
```

## Requirements

- Node.js 18+
- Modern browser (Chrome, Firefox, Safari, Edge)
- For production: CLI WebSocket server on timing system

## License

Private - for canoe slalom competition use.
