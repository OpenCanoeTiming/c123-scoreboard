# Canoe Scoreboard v2

A web application for displaying canoe slalom competition scoreboards. Visual replica of the original [Canoe Scoreboard](https://github.com/jakubbican/canoe-scoreboard) with clean modern architecture. Compatible with the CanoeLiveInterface by Martin „Mako" Šlachta (STiming) over Canoe123 system by Siwidata.

This application supports different display types including vertical displays (portrait TVs) and LED wall panels.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Development](#development)
- [Building for Production](#building-for-production)
- [Usage](#usage)
  - [URL Parameters](#url-parameters)
  - [Layout Modes](#layout-modes)
  - [Data Sources](#data-sources)
- [Deployment](#deployment)
  - [Web Server](#web-server)
  - [Raspberry Pi (FullpageOS)](#raspberry-pi-fullpageos)
- [Customization](#customization)
  - [Visual Assets](#visual-assets)
  - [Styling](#styling)
- [Testing](#testing)
- [Architecture](#architecture)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## Features

- **Real-time updates** via WebSocket connection to CLI server
- **Multiple display layouts** - vertical (portrait TV) and ledwall (LED panel)
- **Auto-scroll** - results scroll automatically with page-based animation
- **Highlight animation** - competitor flashes when finishing
- **Gate penalty badges** - visual indicators (yellow=2s touch, red=50s miss)
- **Connection status** - overlay shows connection state with auto-reconnect
- **Replay mode** - development/demo with recorded race sessions
- **Error boundaries** - component failures don't crash the app

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer)
- [npm](https://www.npmjs.com/) (v9 or newer)

### Setup

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd canoe-scoreboard-v2
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

## Development

Start the development server with demo replay data:

```bash
npm run dev
```

This starts a development server at http://localhost:5173 using recorded race data for testing.

To test with live CLI server:
```bash
# Open in browser with CLI source
http://localhost:5173/?source=cli&host=192.168.1.100:8081
```

## Building for Production

Build the application for production:

```bash
npm run build
```

This creates a `dist` directory with the production build.

Preview the production build:

```bash
npm run preview
```

## Usage

### URL Parameters

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `type` | `vertical`, `ledwall` | auto | Force layout mode |
| `source` | `replay`, `cli` | `replay` | Data source |
| `host` | `ip:port` | `192.168.68.108:8081` | CLI WebSocket server address |
| `speed` | number | `10` | Replay speed multiplier |
| `loop` | `true`, `false` | `true` | Loop replay playback |
| `disableScroll` | `true` | `false` | Disable auto-scroll (for screenshots) |

#### Example URLs

**LED Wall (768x384) with live data:**
```
?type=ledwall&source=cli&host=192.168.1.100:8081
```

**Vertical Display (1080x1920) with live data:**
```
?type=vertical&source=cli&host=192.168.1.100:8081
```

**Development with slow replay:**
```
?source=replay&speed=1
```

### Layout Modes

#### Vertical (Portrait)
- For TV displays in portrait mode (1080x1920 recommended)
- Shows full TopBar with logo and partners
- All result columns visible: Rank, Bib, Name, Penalty, Time, Behind
- Footer with sponsors visible
- Supports multiple competitors on course display

#### Ledwall (Landscape)
- For LED panels (768x384 or similar wide aspect ratio)
- Compact TopBar
- Optimized column layout without behind column
- Footer hidden
- Shows only primary competitor on course

Layout is auto-detected based on aspect ratio (>1.5 = ledwall), or forced via `type` parameter.

### Data Sources

#### CLIProvider (Production)

Connects to the CanoeLiveInterface WebSocket server for live timing data.

```
?source=cli&host=192.168.1.100:8081
```

Features:
- Automatic reconnection with exponential backoff
- Real-time race results and competitor data
- Visibility control from timing system
- Day time display

#### ReplayProvider (Development)

Replays recorded race sessions for development and testing.

```
?source=replay&speed=10
```

Recorded sessions are stored in `public/recordings/`.

## Deployment

### Web Server

1. Build the application:
   ```bash
   npm run build
   ```

2. Deploy the contents of the `dist` directory to any web server (nginx, Apache, etc.)

Example nginx configuration:
```nginx
server {
    listen 80;
    root /var/www/scoreboard;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Raspberry Pi (FullpageOS)

[FullpageOS](https://github.com/guysoft/FullPageOS) is recommended for serving the scoreboard on Raspberry Pi. Tested with Raspberry Pi 4 and Pi 5.

1. Build the application and serve `dist` from a web server

2. Deploy [FullpageOS](https://github.com/guysoft/FullPageOS) on your Raspberry Pi

3. Configure the URL in `/boot/firmware/fullpageos.txt`:
   ```
   http://[server-address]/scoreboard/?type=vertical&source=cli&host=[cli-ip]:8081
   ```

4. For vertical displays, adjust orientation in `/home/timing/scripts/start_gui`:
   ```
   DISPLAY_ORIENTATION=left
   ```

5. Reboot the Raspberry Pi

## Customization

### Visual Assets

Replace these files in `public/assets/` to customize the display:

| File | Description | Recommended Size |
|------|-------------|------------------|
| `logo.svg` | Event/Club logo (top-left) | SVG or 200px height |
| `partners.png` | Partner logos (top-right) | 400x100px |
| `footer.png` | Footer banner (vertical only) | 1080x200px |

### Styling

The application uses CSS variables for theming. Main variables are in `src/styles/variables.css`:

```css
:root {
  --color-bg-primary: #111111;
  --color-bg-secondary: #1d1d1d;
  --color-text-primary: #e9e9e9;
  --color-accent: #ffff00;
  --color-penalty-red: #cc3333;
  --color-oncourse-bg: rgba(51, 102, 153, 0.2);
}
```

## Testing

```bash
# Unit tests (Vitest)
npm test

# E2E tests (Playwright)
npm run test:e2e

# All tests
npm run test:all
```

Test coverage:
- 559+ unit tests
- 82+ E2E tests
- Visual regression testing with Playwright snapshots

## Architecture

### DataProvider Pattern

Abstracts data sources for easy switching between live and replay modes:

```
DataProvider (interface)
├── CLIProvider    - WebSocket connection to CLI server
├── ReplayProvider - Recorded session playback
└── C123Provider   - Direct TCP to Canoe123 (planned)
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
        ├── OnCourseDisplay (other competitors - vertical only)
        ├── ResultsList (scrollable results table)
        └── Footer (sponsors - vertical only)
```

### Project Structure

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

tests/
├── e2e/             # Playwright E2E tests
└── benchmarks/      # Performance benchmarks
```

## Requirements

- Node.js 18+
- Modern browser (Chrome, Firefox, Safari, Edge)
- For production: CLI WebSocket server on timing system

## License

Private - for canoe slalom competition use.

## Acknowledgments

- Original CanoeLiveInterface and scoreboard system by Martin „Mako" Šlachta (STiming)
- Canoe123 timing system by Siwidata
- Czech Canoe Union
- React framework and community
- Vite.js build tool
