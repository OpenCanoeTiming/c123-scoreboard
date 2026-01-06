# Development Guide - Canoe Scoreboard V3

This guide covers everything needed to develop and contribute to the Scoreboard V3 project.

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 20+ | LTS recommended |
| npm | 10+ | Comes with Node.js |
| Git | 2.x | Version control |

### Recommended IDE

**VS Code** with extensions:
- ESLint - linting integration
- TypeScript and JavaScript - language support
- Prettier - code formatting (optional)

---

## Quick Start

```bash
# Clone and install
cd /workspace/csb-v2/canoe-scoreboard-v3
npm install

# Start development server
npm run dev
# Opens at http://localhost:5173

# Run tests
npm test
```

---

## Project Structure

```
canoe-scoreboard-v3/
├── src/
│   ├── App.tsx              # Main application component
│   ├── main.tsx             # Entry point
│   ├── components/          # React components
│   │   ├── ConnectionStatus/
│   │   ├── CurrentCompetitor/
│   │   ├── DebugView/
│   │   ├── ErrorBoundary/
│   │   ├── EventInfo/
│   │   ├── Footer/
│   │   ├── Layout/
│   │   ├── OnCourseDisplay/
│   │   ├── ResultsList/
│   │   └── TimeDisplay/
│   ├── context/             # React context (state management)
│   │   └── ScoreboardContext/
│   ├── hooks/               # Custom React hooks
│   │   ├── useAssets.ts
│   │   ├── useAutoScroll.ts
│   │   ├── useDeparting.ts
│   │   ├── useHighlight.ts
│   │   └── useLayout.ts
│   ├── providers/           # Data providers
│   │   ├── C123ServerProvider.ts  # Primary - WebSocket
│   │   ├── CLIProvider.ts         # Fallback - legacy
│   │   ├── ReplayProvider.ts      # Development - recordings
│   │   ├── types.ts               # Provider interface
│   │   └── utils/                 # Mappers, utilities
│   ├── styles/              # CSS styles
│   ├── types/               # TypeScript types
│   ├── utils/               # Utility functions
│   ├── test/                # Test setup
│   └── test-utils/          # Test utilities
├── tests/
│   └── e2e/                 # Playwright E2E tests
├── scripts/                 # Development scripts
│   ├── mock-c123-tcp.ts     # Mock C123 TCP server
│   ├── mock-cli-ws.ts       # Mock CLI WebSocket server
│   └── c123-proxy.js        # Development proxy
├── docs/                    # Documentation
├── public/                  # Static assets
├── vite.config.ts           # Vite configuration
├── vitest.config.ts         # Vitest configuration
├── playwright.config.ts     # Playwright configuration
├── tsconfig.json            # TypeScript configuration
└── eslint.config.js         # ESLint configuration
```

---

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server (Vite) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:ui` | Run tests with UI |
| `npm run test:e2e` | Run E2E tests (Playwright) |
| `npm run test:providers` | Run provider comparison tests |
| `npm run test:visual` | Run visual regression tests |
| `npm run lint` | Run ESLint |
| `npm run mock:tcp` | Start mock C123 TCP server |
| `npm run mock:ws` | Start mock CLI WebSocket server |

---

## Development Workflow

### 1. Start with Mock Server

For development without a real C123 server:

```bash
# Terminal 1: Start mock TCP server with recording
npm run mock:tcp -- -f ../analysis/recordings/rec-2025-12-28T09-34-10.jsonl

# Terminal 2: Start development server
npm run dev

# Open browser: http://localhost:5173
```

### 2. Connect to Real C123 Server

```bash
# Start dev server
npm run dev

# Open with server parameter:
# http://localhost:5173?server=192.168.1.100
```

### 3. Test Changes

```bash
# Run all unit tests
npm test

# Watch mode (runs on file changes)
npm test -- --watch

# Run specific test file
npm test -- src/utils/__tests__/formatTime.test.ts
```

---

## Coding Standards

### TypeScript

- **Strict mode** enabled - no `any` types
- Use proper typing for all function parameters and returns
- Prefer interfaces over types for object shapes
- Use path aliases (`@/components/...`) for imports

```typescript
// Good
import { Result } from '@/types'
import { formatTime } from '@/utils'

// Avoid
import { Result } from '../../types'
```

### React Components

- **Function components** with hooks
- One component per file (matching component name)
- Co-locate tests in `__tests__/` subdirectory

```
ComponentName/
├── ComponentName.tsx
├── ComponentName.css
├── index.ts
└── __tests__/
    └── ComponentName.test.tsx
```

### CSS

- Component-scoped CSS files
- BEM-like naming convention
- CSS custom properties for theming

```css
/* ComponentName.css */
.component-name { }
.component-name__element { }
.component-name--modifier { }
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `ResultsList.tsx` |
| Hooks | camelCase with `use` prefix | `useAutoScroll.ts` |
| Utilities | camelCase | `formatTime.ts` |
| Types/Interfaces | PascalCase | `Result`, `DataProvider` |
| Constants | UPPER_SNAKE_CASE | `SCROLL_SPEED` |
| CSS files | Component name | `ResultsList.css` |

---

## Testing

### Test Framework

- **Vitest** - unit tests (Jest-compatible)
- **Playwright** - E2E and visual tests
- **Testing Library** - React component testing

### Running Tests

```bash
# Unit tests
npm test                    # Run once
npm test -- --watch         # Watch mode
npm test -- --coverage      # With coverage

# E2E tests
npm run test:e2e            # All E2E tests
npm run test:visual         # Visual regression only

# Provider comparison (requires mock servers)
npm run test:providers
```

### Writing Unit Tests

```typescript
// src/utils/__tests__/formatTime.test.ts
import { describe, it, expect } from 'vitest'
import { formatTime } from '../formatTime'

describe('formatTime', () => {
  it('formats seconds with two decimal places', () => {
    expect(formatTime(123.456)).toBe('123.45')
  })

  it('handles null gracefully', () => {
    expect(formatTime(null)).toBe('-')
  })
})
```

### Writing Component Tests

```typescript
// src/components/Title/__tests__/Title.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Title } from '../Title'

describe('Title', () => {
  it('renders event name', () => {
    render(<Title eventName="Test Event" />)
    expect(screen.getByText('Test Event')).toBeInTheDocument()
  })
})
```

### Test Directory Structure

```
src/
├── components/
│   └── ComponentName/
│       └── __tests__/
│           └── ComponentName.test.tsx
├── hooks/
│   └── __tests__/
│       └── useHookName.test.ts
├── utils/
│   └── __tests__/
│       └── utilityName.test.ts
├── providers/
│   └── __tests__/
│       └── providerName.test.ts
└── __tests__/
    └── provider-comparison.test.ts  # Integration tests
```

---

## Mock Servers

Development mock servers replay recorded data for testing without live dependencies.

### Mock C123 TCP Server

Simulates the C123 server TCP protocol:

```bash
# With recording file
npm run mock:tcp -- -f ../analysis/recordings/rec-2025-12-28T09-34-10.jsonl

# Custom port
npm run mock:tcp -- -f recording.jsonl -p 4001
```

### Mock CLI WebSocket Server

Simulates legacy CLI protocol:

```bash
# With recording file
npm run mock:ws -- -f ../analysis/recordings/rec-2025-12-28T09-34-10.jsonl

# Custom port
npm run mock:ws -- -f recording.jsonl -p 8080
```

### Creating Recordings

Recordings are JSONL files with timestamped messages from live sessions. See existing recordings in `../analysis/recordings/`.

---

## Debugging

### Browser DevTools

1. **React DevTools** - component tree, state inspection
2. **Network tab** - WebSocket messages
3. **Console** - provider and state logs

### Debug View

Enable debug panel in the app:
```
http://localhost:5173?debug=true
```

### Console Logging

Key prefixes in console:
- `[C123Provider]` - C123 server provider events
- `[CLIProvider]` - CLI provider events
- `[ScoreboardContext]` - state updates

### Common Issues

See [troubleshooting.md](troubleshooting.md) for common problems and solutions.

---

## Git Workflow

### Branch Naming

```
feature/short-description
fix/issue-description
docs/documentation-topic
```

### Commit Messages

Use conventional commits format:

```
feat: add TcpSource with reconnect logic
fix: correct XML parsing for Results
test: add unit tests for FinishDetector
docs: update architecture documentation
refactor: simplify provider interface
```

### Pre-Commit Checklist

Before committing:
1. `npm run lint` - no lint errors
2. `npm test` - all tests pass
3. `npm run build` - build succeeds

---

## Path Aliases

TypeScript path aliases configured in `tsconfig.app.json`:

| Alias | Path |
|-------|------|
| `@/*` | `src/*` |
| `@/components/*` | `src/components/*` |
| `@/context/*` | `src/context/*` |
| `@/providers/*` | `src/providers/*` |
| `@/hooks/*` | `src/hooks/*` |
| `@/styles/*` | `src/styles/*` |
| `@/types/*` | `src/types/*` |
| `@/utils/*` | `src/utils/*` |

---

## Build Configuration

### Vite

Development and build tool. Configuration in `vite.config.ts`:
- React plugin for JSX
- Path alias resolution
- Chunk optimization (vendor split)

### Environment Variables

| Variable | Usage | Example |
|----------|-------|---------|
| `VITE_BASE_URL` | Deployment base path | `/scoreboard/` |

```bash
# Build with custom base URL
VITE_BASE_URL=/scoreboard/ npm run build
```

---

## Related Documentation

- [Architecture](architecture.md) - system design, data flow
- [Components](components.md) - React component reference
- [Data Providers](data-providers.md) - provider interface
- [Configuration](configuration.md) - remote config
- [URL Parameters](url-parameters.md) - URL parameter reference
- [Testing](testing.md) - test commands
- [Troubleshooting](troubleshooting.md) - common issues
