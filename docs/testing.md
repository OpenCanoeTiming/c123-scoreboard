# Testování - Canoe Scoreboard V3

Kompletní přehled testování projektu včetně příkazů, struktury a pokynů pro psaní testů.

---

## Příkazy

```bash
# Unit testy (725+ testů) - watch mode
npm test

# Unit testy - single run
npm test -- --run

# Integrační test CLI vs C123 (vyžaduje mock servery)
npm run test:providers

# Vizuální testy Playwright
npm run test:visual

# E2E testy Playwright (všechny)
npm run test:e2e

# Lint kontrola
npm run lint

# Build
npm run build
```

---

## Testovací stack

| Technologie | Účel |
|-------------|------|
| **Vitest** | Unit testy, fast HMR, ESM native |
| **Testing Library** | React component testing |
| **Playwright** | E2E a vizuální testy |
| **jsdom** | DOM environment pro unit testy |

**Konfigurace:** `vitest.config.ts`

---

## Struktura testů

```
src/
├── __tests__/                    # Integrační testy
│   └── provider-comparison.test.ts
├── components/
│   ├── __tests__/                # Component testy
│   │   ├── Title.test.tsx
│   │   └── snapshots/            # Snapshot testy
│   │       ├── CurrentCompetitor.snapshot.test.tsx
│   │       ├── ResultRow.snapshot.test.tsx
│   │       └── ...
│   └── ComponentName/
│       └── __tests__/            # Testy specifické pro komponentu
│           └── ComponentName.test.tsx
├── hooks/
│   └── __tests__/                # Hook testy
│       ├── useHighlight.test.ts
│       ├── useAutoScroll.test.ts
│       └── ...
├── providers/
│   ├── __tests__/                # Provider testy
│   │   ├── CLIProvider.test.ts
│   │   └── c123ServerMapper.test.ts
│   └── utils/
│       └── __tests__/            # Utility testy
│           ├── br1br2Merger.test.ts
│           ├── clientId.test.ts
│           └── ...
└── utils/
    └── __tests__/                # Utility testy
        ├── raceUtils.test.ts
        ├── formatTime.test.ts
        └── ...
```

**Konvence:**
- Testovací soubory: `*.test.ts` nebo `*.test.tsx`
- Umístění: složka `__tests__/` vedle testovaného kódu
- Snapshot testy: `*.snapshot.test.tsx`

---

## Mock servery pro vývoj

```bash
# Mock TCP server (Canoe123 protokol)
npm run mock:tcp -- -f ../analysis/recordings/rec-2025-12-28T09-34-10.jsonl

# Mock WS server (CLI protokol)
npm run mock:ws -- -f ../analysis/recordings/rec-2025-12-28T09-34-10.jsonl
```

Mock servery přehrávají nahrávky ze závodů a umožňují testování bez živého C123 serveru.

---

## Nahrávky

| Nahrávka | Popis |
|----------|-------|
| `../analysis/recordings/rec-2025-12-28T09-34-10.jsonl` | Úvodní nahrávka s TCP (Canoe123) i WS (CLI) daty |

Formát JSONL obsahuje timestampy a data z obou protokolů pro synchronní replay.

---

## Testovací pokrytí

### Unit testy (725+)

| Modul | Testy | Popis |
|-------|-------|-------|
| `raceUtils.ts` | 45 | BR1/BR2 utility funkce |
| `c123ServerMapper.ts` | 36 | Mapování C123 zpráv |
| `C123ServerProvider.ts` | 31 | WebSocket provider |
| `CLIProvider.ts` | 27 | CLI fallback provider |
| `formatName.ts` | 25 | Formátování jmen závodníků |
| `assetStorage.ts` | 23 | LocalStorage pro assety |
| `parseGates.ts` | 21 | Parsování penalizací |
| `formatTime.ts` | 18 | Formátování časů |
| `clientId.ts` | 17 | Client ID management |
| `detectFinish.ts` | 16 | Detekce dojetí |
| `validation.ts` | 16 | Validace URL a dat |
| `messageHandlers.ts` | 15 | ConfigPush/ForceRefresh handlers |
| `br1br2Merger.ts` | 12 | BR2Manager a merge logika |
| `useAssets.ts` | 8 | Asset loading hook |
| Komponenty | ~100+ | React komponenty, snapshots |

### E2E testy (Playwright)

- **Vizuální srovnání CLI vs C123** - screenshot comparison
- **Layout módy** - vertical, ledwall
- **Scrolling behavior** - auto-scroll, highlight

---

## Jak psát testy

### Základní struktura

```typescript
import { describe, it, expect } from 'vitest'
import { myFunction } from '../myModule'

describe('myFunction', () => {
  it('returns expected result for valid input', () => {
    expect(myFunction('input')).toBe('expected')
  })

  it('handles edge case', () => {
    expect(myFunction('')).toBeNull()
  })
})
```

### Parametrizované testy

```typescript
describe('isBR2Race', () => {
  it.each([
    ['K1M_ST_BR2_6', true],
    ['C1W_LT_BR2_1', true],
    ['K1M_ST_BR1_6', false],
  ])('returns %s for race "%s"', (raceId, expected) => {
    expect(isBR2Race(raceId)).toBe(expected)
  })
})
```

### React komponenty

```typescript
import { render, screen } from '@testing-library/react'
import { MyComponent } from '../MyComponent'

describe('MyComponent', () => {
  it('renders title', () => {
    render(<MyComponent title="Test" />)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })
})
```

### Async testy

```typescript
it('fetches data', async () => {
  const result = await fetchData()
  expect(result).toEqual({ data: 'value' })
})
```

### Mocking

```typescript
import { vi } from 'vitest'

// Mock module
vi.mock('../api', () => ({
  fetchData: vi.fn().mockResolvedValue({ data: 'mocked' })
}))

// Mock function
const mockFn = vi.fn()
mockFn.mockReturnValue('result')

// Spy
const spy = vi.spyOn(object, 'method')
```

### Snapshot testy

```typescript
import { render } from '@testing-library/react'

it('matches snapshot', () => {
  const { container } = render(<MyComponent />)
  expect(container).toMatchSnapshot()
})
```

---

## Test setup

Globální setup v `src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
})
```

---

## Testování proti V2

Pro ověření kompatibility je doporučeno testovat V3 proti V2 na stejné sadě vstupních dat:

1. Pustit C123 server proti nahrávce
2. Spustit V2 a V3 scoreboard současně
3. Porovnat zobrazení - musí být ZCELA STEJNÉ (kromě BR1/BR2 merge)

```bash
# Terminal 1: C123 server s nahrávkou
cd ../c123-server && npm run dev -- --replay ../analysis/recordings/...

# Terminal 2: V2 scoreboard
cd ../canoe-scoreboard-v2 && npm run dev

# Terminal 3: V3 scoreboard
npm run dev
```

---

## Časté problémy

### Test timeout

```typescript
it('long running test', async () => {
  // ...
}, 10000) // 10s timeout
```

### React warnings

Pokud test způsobuje React warnings o state updates:

```typescript
import { act } from '@testing-library/react'

await act(async () => {
  // state-changing operation
})
```

### Mock cleanup

```typescript
import { beforeEach, afterEach, vi } from 'vitest'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})
```

---

## CI/CD

Testy běží automaticky při:

- **Pre-commit hook** (pokud nastaven): `npm run lint`
- **PR checks**: `npm test -- --run && npm run build`

Pro lokální simulaci CI:

```bash
npm run lint && npm test -- --run && npm run build
```
