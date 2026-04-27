# URL Category Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `?category=K1M` URL parameter to lock the scoreboard to a specific class, enabling multiple displays side by side.

**Architecture:** Parse `category` URL param in `App.tsx`, pass as `fixedCategory` prop to `ScoreboardProvider`, filter incoming data in the reducer. New `getCategoryFromRaceId()` utility in existing `raceUtils.ts`.

**Tech Stack:** React, TypeScript, Vitest

---

### Task 1: Add `getCategoryFromRaceId` utility

**Files:**
- Modify: `src/utils/raceUtils.ts:91` (append)
- Modify: `src/utils/__tests__/raceUtils.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `src/utils/__tests__/raceUtils.test.ts`:

```typescript
describe('getCategoryFromRaceId', () => {
  it('extracts category from standard race ID', () => {
    expect(getCategoryFromRaceId('K1M_ST_BR1_6')).toBe('K1M')
  })

  it('extracts category from non-BR race ID', () => {
    expect(getCategoryFromRaceId('C2M_LT_XF_3')).toBe('C2M')
  })

  it('returns empty string for empty input', () => {
    expect(getCategoryFromRaceId('')).toBe('')
  })

  it('returns the whole string if no underscore', () => {
    expect(getCategoryFromRaceId('K1M')).toBe('K1M')
  })
})
```

Also update the import at the top of the test file to include `getCategoryFromRaceId`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/raceUtils.test.ts`
Expected: FAIL — `getCategoryFromRaceId` is not exported

- [ ] **Step 3: Write implementation**

Append to `src/utils/raceUtils.ts`:

```typescript
/**
 * Extract the category (class) from a race ID.
 *
 * The category is the first segment before the first underscore.
 * Used for URL-based category filtering (?category=K1M).
 *
 * @param raceId - Race identifier (e.g., "K1M_ST_BR2_6")
 * @returns Category string (e.g., "K1M"), or empty string if input is empty
 */
export function getCategoryFromRaceId(raceId: string): string {
  if (!raceId) return ''
  const idx = raceId.indexOf('_')
  return idx === -1 ? raceId : raceId.substring(0, idx)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/raceUtils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/raceUtils.ts src/utils/__tests__/raceUtils.test.ts
git commit -m "feat: add getCategoryFromRaceId utility"
```

---

### Task 2: Add `fixedCategory` to ScoreboardProvider

**Files:**
- Modify: `src/context/ScoreboardContext.tsx:28-83` (state interface)
- Modify: `src/context/ScoreboardContext.tsx:125-150` (initial state)
- Modify: `src/context/ScoreboardContext.tsx:497-509` (RESET_STATE)
- Modify: `src/context/ScoreboardContext.tsx:523-527` (provider props)
- Modify: `src/context/ScoreboardContext.tsx:535-543` (provider component + useReducer init)

- [ ] **Step 1: Add `fixedCategory` to state interface**

In `src/context/ScoreboardContext.tsx`, add to `ScoreboardState` interface after `dayTime: string`:

```typescript
  // Fixed category filter from URL parameter (?category=K1M)
  // When set, only data matching this category prefix is accepted
  fixedCategory: string | null
```

- [ ] **Step 2: Add to initial state**

In `initialState`, add after `dayTime: ''`:

```typescript
  fixedCategory: null,
```

- [ ] **Step 3: Add `fixedCategory` prop to ScoreboardProviderProps**

Change `ScoreboardProviderProps`:

```typescript
interface ScoreboardProviderProps {
  provider: DataProvider
  fixedCategory?: string
  children: ReactNode
}
```

- [ ] **Step 4: Thread prop into useReducer initial state**

Update the `ScoreboardProvider` component signature and `useReducer` call:

```typescript
export function ScoreboardProvider({
  provider,
  fixedCategory,
  children,
}: ScoreboardProviderProps) {
  const [state, dispatch] = useReducer(scoreboardReducer, {
    ...initialState,
    status: provider.status,
    fixedCategory: fixedCategory?.toUpperCase() || null,
  })
```

- [ ] **Step 5: Preserve `fixedCategory` in RESET_STATE**

In the `RESET_STATE` case, add `fixedCategory` to preserved fields:

```typescript
    case 'RESET_STATE':
      return {
        ...initialState,
        status: state.status,
        visibility: state.visibility,
        title: state.title,
        infoText: state.infoText,
        dayTime: state.dayTime,
        fixedCategory: state.fixedCategory,
      }
```

- [ ] **Step 6: Run existing tests to verify nothing breaks**

Run: `npx vitest run src/context/__tests__/ScoreboardContext.test.ts`
Expected: All existing tests PASS (fixedCategory defaults to null, no behavior change)

- [ ] **Step 7: Commit**

```bash
git add src/context/ScoreboardContext.tsx
git commit -m "feat: add fixedCategory prop to ScoreboardProvider"
```

---

### Task 3: Filter SET_ON_COURSE by fixedCategory (TDD)

**Files:**
- Modify: `src/context/__tests__/ScoreboardContext.test.tsx` (add tests)
- Modify: `src/context/ScoreboardContext.tsx:241-467` (SET_ON_COURSE case)

**Reference:** Import `getCategoryFromRaceId` at the top of `ScoreboardContext.tsx`:
```typescript
import { getCategoryFromRaceId } from '@/utils/raceUtils'
```

- [ ] **Step 1: Update test helper to support fixedCategory**

In `src/context/__tests__/ScoreboardContext.test.tsx`, update the `createWrapper` function:

```typescript
function createWrapper(provider: DataProvider, fixedCategory?: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(ScoreboardProvider, { provider, fixedCategory, children })
  }
}
```

- [ ] **Step 2: Write failing tests for SET_ON_COURSE filtering**

Append a new describe block in the test file:

```typescript
  describe('fixed category filtering', () => {
    it('accepts on-course data when raceId matches fixedCategory', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider, 'K1M')

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      const competitor = createOnCourseCompetitor({
        bib: '10',
        raceId: 'K1M_ST_BR1_6',
        dtStart: '2025-12-28T10:00:00',
      })

      act(() => {
        mockProvider.triggerOnCourse({
          current: competitor,
          onCourse: [competitor],
          updateOnCourse: true,
        })
      })

      expect(result.current.currentCompetitor?.bib).toBe('10')
      expect(result.current.activeRaceId).toBe('K1M_ST_BR1_6')
    })

    it('clears on-course state when raceId does not match fixedCategory', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider, 'K1M')

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      // First, set a matching competitor
      const k1mComp = createOnCourseCompetitor({
        bib: '10',
        raceId: 'K1M_ST_BR1_6',
        dtStart: '2025-12-28T10:00:00',
      })
      act(() => {
        mockProvider.triggerOnCourse({
          current: k1mComp,
          onCourse: [k1mComp],
          updateOnCourse: true,
        })
      })
      expect(result.current.currentCompetitor?.bib).toBe('10')

      // Now send a non-matching competitor (C1W)
      const c1wComp = createOnCourseCompetitor({
        bib: '20',
        raceId: 'C1W_ST_BR1_6',
        dtStart: '2025-12-28T10:02:00',
      })
      act(() => {
        mockProvider.triggerOnCourse({
          current: c1wComp,
          onCourse: [c1wComp],
          updateOnCourse: true,
        })
      })

      // Should be empty — C1W does not match K1M
      expect(result.current.currentCompetitor).toBeNull()
      expect(result.current.onCourse).toEqual([])
      expect(result.current.activeRaceId).toBeNull()
    })

    it('is case-insensitive — lowercase URL param matches uppercase raceId', () => {
      const mockProvider = createMockProvider()
      // Note: ScoreboardProvider normalizes to uppercase, so 'k1m' → 'K1M'
      const wrapper = createWrapper(mockProvider, 'k1m')

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      const competitor = createOnCourseCompetitor({
        bib: '10',
        raceId: 'K1M_ST_BR1_6',
        dtStart: '2025-12-28T10:00:00',
      })

      act(() => {
        mockProvider.triggerOnCourse({
          current: competitor,
          onCourse: [competitor],
          updateOnCourse: true,
        })
      })

      expect(result.current.currentCompetitor?.bib).toBe('10')
    })

    it('allows run changes within the same category', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider, 'K1M')

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      // BR1 competitor
      const br1Comp = createOnCourseCompetitor({
        bib: '10',
        raceId: 'K1M_ST_BR1_6',
        dtStart: '2025-12-28T10:00:00',
      })
      act(() => {
        mockProvider.triggerOnCourse({
          current: br1Comp,
          onCourse: [br1Comp],
          updateOnCourse: true,
        })
      })
      expect(result.current.activeRaceId).toBe('K1M_ST_BR1_6')

      // Set results for BR1
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '10' })],
          raceName: 'K1M BR1',
          raceStatus: 'In Progress',
          highlightBib: null,
          raceId: 'K1M_ST_BR1_6',
        })
      })

      // BR2 competitor — same category, different run
      const br2Comp = createOnCourseCompetitor({
        bib: '11',
        raceId: 'K1M_ST_BR2_6',
        dtStart: '2025-12-28T11:00:00',
      })
      act(() => {
        mockProvider.triggerOnCourse({
          current: br2Comp,
          onCourse: [br2Comp],
          updateOnCourse: true,
        })
      })

      // Should accept — still K1M
      expect(result.current.currentCompetitor?.bib).toBe('11')
      expect(result.current.activeRaceId).toBe('K1M_ST_BR2_6')
    })
  })
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/context/__tests__/ScoreboardContext.test.ts`
Expected: The "clears on-course state" test FAILS (non-matching data is currently accepted)

- [ ] **Step 4: Implement SET_ON_COURSE filtering**

In `src/context/ScoreboardContext.tsx`, add the import at the top:

```typescript
import { getCategoryFromRaceId } from '@/utils/raceUtils'
```

At the beginning of the `SET_ON_COURSE` case (after `case 'SET_ON_COURSE': {`), add the fixedCategory guard:

```typescript
      // Fixed category filter: reject data from non-matching categories
      // When fixedCategory is set, actively clear on-course state for mismatches
      // to transition to the empty/waiting state
      if (state.fixedCategory) {
        // Determine the incoming category from the most authoritative source
        const incomingRaceId = action.current?.raceId
          || action.onCourse.find(c => c.raceId)?.raceId
          || ''
        const incomingCategory = getCategoryFromRaceId(incomingRaceId)

        if (incomingCategory && incomingCategory !== state.fixedCategory) {
          // Different category — clear to empty/waiting state
          return {
            ...state,
            currentCompetitor: null,
            onCourse: [],
            onCourseFinishedAt: {},
            onCourseLastSeenAt: {},
            activeRaceId: null,
            // Preserve lastActiveRaceId only if it matches the fixed category
            lastActiveRaceId: state.lastActiveRaceId &&
              getCategoryFromRaceId(state.lastActiveRaceId) === state.fixedCategory
              ? state.lastActiveRaceId
              : null,
            departingCompetitor: null,
            departedAt: null,
            pendingHighlightBib: null,
            pendingHighlightTimestamp: null,
          }
        }
      }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/context/__tests__/ScoreboardContext.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/context/ScoreboardContext.tsx src/context/__tests__/ScoreboardContext.test.tsx
git commit -m "feat: filter SET_ON_COURSE by fixedCategory"
```

---

### Task 4: Filter SET_RESULTS by fixedCategory (TDD)

**Files:**
- Modify: `src/context/__tests__/ScoreboardContext.test.tsx` (add tests)
- Modify: `src/context/ScoreboardContext.tsx:180-239` (SET_RESULTS case)

- [ ] **Step 1: Write failing tests**

Add inside the `describe('fixed category filtering', ...)` block:

```typescript
    it('accepts results when raceId matches fixedCategory', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider, 'K1M')

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '42' })],
          raceName: 'K1M Semifinal',
          raceStatus: 'In Progress',
          highlightBib: null,
          raceId: 'K1M_ST_BR1_6',
        })
      })

      expect(result.current.results).toHaveLength(1)
      expect(result.current.raceName).toBe('K1M Semifinal')
    })

    it('clears results when incoming raceId does not match fixedCategory', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider, 'K1M')

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      // Set matching results first
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '42' })],
          raceName: 'K1M Semifinal',
          raceStatus: 'In Progress',
          highlightBib: null,
          raceId: 'K1M_ST_BR1_6',
        })
      })
      expect(result.current.results).toHaveLength(1)

      // Non-matching results should clear state
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '99' })],
          raceName: 'C1W Final',
          raceStatus: 'In Progress',
          highlightBib: null,
          raceId: 'C1W_ST_BR1_6',
        })
      })

      expect(result.current.results).toEqual([])
      expect(result.current.raceName).toBe('')
    })

    it('accepts results for fixedCategory even before activeRaceId is set', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider, 'K1M')

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      // No on-course data yet — activeRaceId is null
      // Results for K1M should still be accepted (fixedCategory has precedence)
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '42' })],
          raceName: 'K1M Semifinal',
          raceStatus: 'In Progress',
          highlightBib: null,
          raceId: 'K1M_ST_BR1_6',
        })
      })

      expect(result.current.results).toHaveLength(1)
    })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/context/__tests__/ScoreboardContext.test.ts`
Expected: "clears results" and "accepts results before activeRaceId" FAIL

- [ ] **Step 3: Implement SET_RESULTS filtering**

In the `SET_RESULTS` case, add a fixedCategory guard **before** the existing `targetRaceId` check (after `case 'SET_RESULTS': {`):

```typescript
      // Fixed category filter: takes precedence over targetRaceId logic
      if (state.fixedCategory && action.raceId) {
        const incomingCategory = getCategoryFromRaceId(action.raceId)
        if (incomingCategory !== state.fixedCategory) {
          // Results for a different category — clear stale results
          return {
            ...state,
            results: [],
            raceName: '',
            raceStatus: '',
            raceId: '',
          }
        }
        // Category matches — skip the targetRaceId check below
        // (fixedCategory has precedence, handles initial load case)
      } else {
        // Original targetRaceId filtering (no fixedCategory)
```

Wrap the existing `targetRaceId` check in the `else` block. The existing code at lines 185-194 becomes:

```typescript
      // Fixed category filter: takes precedence over targetRaceId logic
      if (state.fixedCategory && action.raceId) {
        const incomingCategory = getCategoryFromRaceId(action.raceId)
        if (incomingCategory !== state.fixedCategory) {
          // Results for a different category — clear stale results
          return {
            ...state,
            results: [],
            raceName: '',
            raceStatus: '',
            raceId: '',
          }
        }
        // Category matches — proceed to update results below
      } else {
        // Original targetRaceId filtering (no fixedCategory set)
        const targetRaceId = state.activeRaceId || state.lastActiveRaceId
        if (targetRaceId && action.raceId && action.raceId !== targetRaceId) {
          return state
        }
      }
```

The rest of the SET_RESULTS case (building `newState`) stays unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/context/__tests__/ScoreboardContext.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/context/ScoreboardContext.tsx src/context/__tests__/ScoreboardContext.test.tsx
git commit -m "feat: filter SET_RESULTS by fixedCategory"
```

---

### Task 5: Parse `category` URL parameter and pass to provider

**Files:**
- Modify: `src/App.tsx:42-63` (getUrlParams)
- Modify: `src/App.tsx:338-341` (ScoreboardProvider usage)

- [ ] **Step 1: Add `category` to getUrlParams**

Add `category` to the return type and parsing:

```typescript
function getUrlParams(): {
  server: string | null
  source: 'replay' | null
  speed: number
  loop: boolean
  pauseAfter: number | null
  disableScroll: boolean
  category: string | null
} {
  const params = new URLSearchParams(window.location.search)

  const server = params.get('server')
  const sourceParam = params.get('source')
  const source: 'replay' | null = sourceParam === 'replay' ? 'replay' : null
  const speedParam = params.get('speed')
  const speed = speedParam ? parseFloat(speedParam) : 10.0
  const loop = params.get('loop') !== 'false'
  const pauseAfterParam = params.get('pauseAfter')
  const pauseAfter = pauseAfterParam ? parseInt(pauseAfterParam, 10) : null
  const disableScroll = params.get('disableScroll') === 'true'
  const category = params.get('category')

  return { server, source, speed, loop, pauseAfter, disableScroll, category }
}
```

- [ ] **Step 2: Pass `fixedCategory` to ScoreboardProvider**

Update the JSX in `App()`:

```typescript
  return (
    <ScoreboardProvider provider={discoveryState.provider} fixedCategory={urlParams.category ?? undefined}>
      <ScoreboardContent />
    </ScoreboardProvider>
  )
```

- [ ] **Step 3: Update JSDoc comment for getUrlParams**

Add to the parameter list in the comment block:

```
 * - category: string (fix scoreboard to specific class, e.g., "K1M")
```

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: parse category URL parameter and pass to ScoreboardProvider"
```

---

### Task 6: End-to-end scenario test

**Files:**
- Modify: `src/context/__tests__/ScoreboardContext.test.tsx` (add test)

- [ ] **Step 1: Write full-scenario test**

Add inside `describe('fixed category filtering', ...)`:

```typescript
    it('full scenario: K1M fixed, race transitions K1M → C1W → K1M', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider, 'K1M')

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      // === Phase 1: K1M is racing ===
      const k1mComp = createOnCourseCompetitor({
        bib: '10',
        raceId: 'K1M_ST_BR1_6',
        dtStart: '2025-12-28T10:00:00',
      })
      act(() => {
        mockProvider.triggerOnCourse({
          current: k1mComp,
          onCourse: [k1mComp],
          updateOnCourse: true,
        })
      })
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '10' })],
          raceName: 'K1M BR1',
          raceStatus: 'In Progress',
          highlightBib: null,
          raceId: 'K1M_ST_BR1_6',
        })
      })

      expect(result.current.currentCompetitor?.bib).toBe('10')
      expect(result.current.results).toHaveLength(1)

      // === Phase 2: Race switches to C1W ===
      const c1wComp = createOnCourseCompetitor({
        bib: '20',
        raceId: 'C1W_ST_BR1_6',
        dtStart: '2025-12-28T10:30:00',
      })
      act(() => {
        mockProvider.triggerOnCourse({
          current: c1wComp,
          onCourse: [c1wComp],
          updateOnCourse: true,
        })
      })

      // Scoreboard should show empty/waiting state
      expect(result.current.currentCompetitor).toBeNull()
      expect(result.current.onCourse).toEqual([])

      // C1W results should clear any stale K1M results
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '20' })],
          raceName: 'C1W BR1',
          raceStatus: 'In Progress',
          highlightBib: null,
          raceId: 'C1W_ST_BR1_6',
        })
      })
      expect(result.current.results).toEqual([])

      // === Phase 3: Race switches back to K1M ===
      const k1mComp2 = createOnCourseCompetitor({
        bib: '11',
        raceId: 'K1M_ST_BR2_6',
        dtStart: '2025-12-28T11:00:00',
      })
      act(() => {
        mockProvider.triggerOnCourse({
          current: k1mComp2,
          onCourse: [k1mComp2],
          updateOnCourse: true,
        })
      })

      // K1M is back — should show competitor
      expect(result.current.currentCompetitor?.bib).toBe('11')
      expect(result.current.activeRaceId).toBe('K1M_ST_BR2_6')

      // K1M results accepted again
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '11' })],
          raceName: 'K1M BR2',
          raceStatus: 'In Progress',
          highlightBib: null,
          raceId: 'K1M_ST_BR2_6',
        })
      })
      expect(result.current.results).toHaveLength(1)
      expect(result.current.results[0].bib).toBe('11')
    })

    it('without fixedCategory, scoreboard behaves as before', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider) // No fixedCategory

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      // Standard behavior — accepts any category
      const competitor = createOnCourseCompetitor({
        bib: '10',
        raceId: 'C1W_ST_BR1_6',
        dtStart: '2025-12-28T10:00:00',
      })
      act(() => {
        mockProvider.triggerOnCourse({
          current: competitor,
          onCourse: [competitor],
          updateOnCourse: true,
        })
      })

      expect(result.current.currentCompetitor?.bib).toBe('10')
      expect(result.current.activeRaceId).toBe('C1W_ST_BR1_6')
    })
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/context/__tests__/ScoreboardContext.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/context/__tests__/ScoreboardContext.test.tsx
git commit -m "test: add end-to-end scenario tests for fixed category"
```

---

### Task 7: Final verification and cleanup

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: No TypeScript errors, clean build

- [ ] **Step 3: Manual verification checklist**

Verify in code:
- `getUrlParams()` returns `category` field
- `ScoreboardProvider` accepts `fixedCategory` prop
- `fixedCategory` is normalized to uppercase in provider
- `fixedCategory` is preserved across `RESET_STATE`
- `SET_ON_COURSE` clears state on category mismatch
- `SET_RESULTS` clears results on category mismatch
- `SET_RESULTS` fixedCategory check runs before `targetRaceId` check
- Without `?category` param, scoreboard behaves identically to before
