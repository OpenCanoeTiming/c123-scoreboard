# Canoe Scoreboard v2

Real-time scoreboard display for canoe slalom competitions. Built with React 19, TypeScript, and Vite.

## Features

- Real-time results display with automatic updates
- Current competitor display with gate penalties visualization
- Highlight animation when competitor finishes
- Auto-scroll through results
- Responsive layouts: vertical (1080×1920) and ledwall (768×384)
- Reconnection handling with state management

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

This starts the development server at `http://localhost:5173`. The app uses ReplayProvider by default, which replays recorded race data for development.

## Building for Production

```bash
npm run build
npm run preview  # Preview the production build
```

## Testing

```bash
npm test          # Run unit tests with Vitest
npm run test:ui   # Run tests with UI
npm run test:e2e  # Run Playwright E2E tests
```

## URL Parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| `type` | `vertical`, `ledwall` | Force specific layout mode |

Example: `http://localhost:5173/?type=ledwall`

## Project Structure

```
src/
├── components/          # React components
│   ├── ConnectionStatus/  # Connection status overlay
│   ├── CurrentCompetitor/ # Current competitor display
│   ├── EventInfo/         # TopBar and Title
│   ├── Footer/            # Footer with sponsors
│   ├── Layout/            # Main scoreboard layout
│   ├── ResultsList/       # Results table
│   └── TimeDisplay/       # Day time display
├── context/             # React Context (ScoreboardContext)
├── hooks/               # Custom hooks
│   ├── useAutoScroll.ts   # Auto-scroll for results
│   ├── useDeparting.ts    # Departing competitor logic
│   ├── useHighlight.ts    # Highlight expiration
│   ├── useLayout.ts       # Layout calculations
│   └── useTimestamp.ts    # Shared timestamp logic
├── providers/           # Data providers
│   ├── ReplayProvider.ts  # Replay recorded data (dev)
│   └── types.ts           # DataProvider interface
├── styles/              # Global CSS
│   ├── fonts.css          # Font face declarations
│   ├── reset.css          # CSS reset
│   └── variables.css      # CSS custom properties
├── types/               # TypeScript types
└── utils/               # Utility functions
    ├── formatName.ts      # Name formatting
    └── formatTime.ts      # Time formatting
```

## Architecture

### DataProvider Pattern

The app uses a DataProvider abstraction for data sources:

```typescript
interface DataProvider {
  connect(): Promise<void>
  disconnect(): void
  onResults(callback: ResultsCallback): Unsubscribe
  onOnCourse(callback: OnCourseCallback): Unsubscribe
  onConfig(callback: ConfigCallback): Unsubscribe
  onConnectionChange(callback: ConnectionCallback): Unsubscribe
  readonly status: ConnectionStatus
}
```

Current implementations:
- **ReplayProvider**: Replays recorded JSONL data (for development)
- **CLIProvider**: WebSocket connection to CLI server (planned)
- **C123Provider**: Direct TCP connection to timing system (planned)

### ScoreboardContext

Central state management using React Context:
- Connection status and error handling
- Results and current competitor data
- Highlight and departing competitor logic
- Visibility flags for UI components

### Layout System

Responsive layout using CSS custom properties:
- Automatic layout detection based on aspect ratio
- Vertical layout: tall screens (height > width × 1.5)
- Ledwall layout: wide screens (aspect ratio ≈ 2:1)
- Dynamic row height and font size calculation

## Recordings

Test recordings are stored in `public/recordings/`. Format is JSONL with WebSocket messages.

## Related Documentation

- [Implementation Checklist](./csb-v2-implementacni-checklist.md)
- [Analysis Documents](../analysis/)
