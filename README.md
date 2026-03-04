# C123 Scoreboard

Real-time scoreboard for canoe slalom races. Connects to C123 Server for live timing data.

| Vertical Display Layout | LED-wall Layout |
|:---------------:|:--------------:|
| ![Vertical](docs/screenshots/vertical.png) | ![Ledwall](docs/screenshots/ledwall.png) |

## Features

- **Zero configuration** - Auto-discovers [C123 Server](https://github.com/OpenCanoeTiming/c123-server) on the network
- **Two layouts** - Vertical (portrait TV) and Ledwall (wide LED panels)
- **BR1/BR2 display** - Shows both run times for dual-run races
- **Remote configuration** - Manage displays from C123 Server admin
- **Custom assets** - Logos and banners via admin or URL parameters
- **Finish highlight** - Automatic scroll and highlight on competitor finish

## Quick Start

```bash
npm install
npm run dev
```

Opens at http://localhost:5173 with sample replay data.

### Connect to C123 Server

```
http://localhost:5173/?server=192.168.1.50:27123
```

Or let auto-discovery find the server:

```
http://localhost:5173/
```

## Deployment

### Build for Production

```bash
npm run build
```

Deploy the `dist/` folder to any web server.

### Raspberry Pi (FullPageOS)

For dedicated displays, [FullPageOS](https://github.com/guysoft/FullPageOS) turns a Raspberry Pi into a kiosk that shows the scoreboard fullscreen. See [docs/fullpageos.md](docs/fullpageos.md) for step-by-step setup instructions.

## URL Parameters

### Essential

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `server` | `host:port` | auto-discover | C123 Server address |
| `type` | `vertical`, `ledwall` | auto | Layout mode |
| `displayRows` | `3-20` | auto | Number of result rows |

### Customization

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `customTitle` | text | - | Override event name |
| `logoUrl` | URL | `/assets/logo.svg` | Top left logo |
| `partnerLogoUrl` | URL | `/assets/partners.png` | Top right logo |
| `footerImageUrl` | URL | `/assets/footer.png` | Footer banner (vertical) |

### Behavior

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `scrollToFinished` | `true`, `false` | `true` | Scroll to finished competitor |
| `clientId` | text | - | Client ID for remote config |

### Development

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `source` | `c123`, `replay` | `c123` | Data source |
| `speed` | number | `10` | Replay speed multiplier |
| `loop` | `true`, `false` | `true` | Loop replay |

### Examples

**Vertical display with custom title:**
```
?type=vertical&customTitle=Czech%20Cup%202025&server=192.168.1.50:27123
```

**Ledwall with 5 large rows:**
```
?type=ledwall&displayRows=5&server=192.168.1.50:27123
```

## LED Wall Wrapper

For LED walls where the controller crops a portion of the HDMI signal, a standalone wrapper is included at `/ledwall.html`. It places content in an iframe with exact pixel dimensions matching the physical panel:

```
http://[server]/ledwall.html?width=768&height=384
```

Without a `url` parameter, it loads the scoreboard automatically. Use `url` to wrap other content (H2R Graphics, etc.):

```
http://[server]/ledwall.html?url=http://other-source:8080/output&width=768&height=384
```

See [docs/ledwall-wrapper.md](docs/ledwall-wrapper.md) for details.

## Layout Modes

### Vertical (Portrait)

For portrait displays (1080x1920 recommended), but fully responsive:

- Full header with logo and partners
- All columns: Rank, Bib, Name, Penalties, Time, Gap
- Footer with sponsors
- BR1/BR2: Two columns showing both run times

### Ledwall (Landscape)

For LED panels (wide aspect ratio), but fully responsive:

- Compact header
- Essential columns only
- Scales to fill viewport based on `displayRows`

**Auto-detection:** Aspect ratio >= 1.5 uses ledwall, otherwise vertical.

## Remote Configuration

C123 Server admin can push configuration to connected scoreboards:

- Layout type and row count
- Custom title
- Asset URLs (logos, banners)
- Scroll behavior

Changes apply immediately without page reload. See C123 Server documentation for details.

## BR1/BR2 Display

For dual-run (Best Run) races, the scoreboard:

1. Detects BR2 race automatically
2. Fetches BR1 results from REST API
3. Displays both run times with the worse run muted

## Asset Management

### Default Assets

Place files in `public/assets/`:

| File | Description | Size |
|------|-------------|------|
| `logo.svg` | Event logo (top left) | SVG or 200px height |
| `partners.png` | Partner logos (top right) | 400x100px |
| `footer.png` | Footer banner (vertical) | 1080x200px |

### Custom Assets

**Priority (highest first):**
1. Remote config from C123 Server
2. URL parameters
3. Default assets

## Development

```bash
# Development server
npm run dev

# Build
npm run build

# Tests
npm test

# E2E tests
npm run test:e2e
```

## Architecture

```
src/
├── components/      # React components
├── context/         # State management
├── hooks/           # useLayout, useAutoScroll, useAssets
├── providers/       # C123ServerProvider, ReplayProvider
├── styles/          # CSS
├── types/           # TypeScript definitions
└── utils/           # Utilities

public/
├── assets/          # Default logos and banners
└── recordings/      # Replay files for development
```

## Requirements

- Node.js 18+
- Modern browser (Chrome, Firefox, Safari, Edge)
- C123 Server for production use

## Troubleshooting

**Scoreboard not connecting**
- Check `?server=` parameter or wait for auto-discovery
- Verify C123 Server is running and accessible

**Wrong ranking or missing data**
- C123 system sends data periodically, wait for next update
- For BR2, REST API may have slight delay

**Assets not loading**
- Check URL paths and CORS headers
- Try absolute URLs

## Documentation

- [docs/architecture.md](docs/architecture.md) - Architecture and data flow
- [docs/timing.md](docs/timing.md) - Timing constants
- [docs/troubleshooting.md](docs/troubleshooting.md) - Problem solving
- [docs/SolvingBR1BR2.md](docs/SolvingBR1BR2.md) - BR1/BR2 merge details
- [docs/fullpageos.md](docs/fullpageos.md) - FullPageOS deployment on Raspberry Pi
- [docs/ledwall-wrapper.md](docs/ledwall-wrapper.md) - LED wall wrapper usage

## License

MIT
