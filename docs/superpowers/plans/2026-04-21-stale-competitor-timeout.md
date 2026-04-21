# Stale Competitor Timeout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix scoreboard getting stuck on a finished category by removing stale on-course competitors that C123 stopped reporting.

**Architecture:** Add `lastSeenAt` tracking per competitor in `ScoreboardContext`. On each `SET_ON_COURSE` action, record which bibs appeared in the incoming message. Remove competitors not seen for `STALE_COMPETITOR_TIMEOUT` (15s). This causes `activeRaceId` to update naturally once stale competitors from a finished race are gone.

**Tech Stack:** React (useReducer), Vitest, TypeScript

**Closes:** #48

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/context/constants.ts` | Modify | Add `STALE_COMPETITOR_TIMEOUT` constant |
| `src/context/ScoreboardContext.tsx` | Modify | Add `onCourseLastSeenAt` state, stale removal logic in `SET_ON_COURSE` |
| `src/context/__tests__/ScoreboardContext.test.tsx` | Modify | Add stale competitor removal tests |

---

### Task 1: Add the constant

**Files:**
- Modify: `src/context/constants.ts`

- [ ] **Step 1: Add STALE_COMPETITOR_TIMEOUT constant**

```typescript
/**
 * Timeout for removing stale competitors from onCourse list (15 seconds)
 *
 * C123 sends OnCourse updates ~1/second per competitor. If a competitor
 * hasn't appeared in any message for this duration, they were removed
 * from the course (DNS/skip) without an explicit dtFinish signal.
 * Removing stale competitors allows activeRaceId to switch to the
 * current race.
 */
export const STALE_COMPETITOR_TIMEOUT = 15000
```

- [ ] **Step 2: Commit**

```bash
git add src/context/constants.ts
git commit -m "feat: add STALE_COMPETITOR_TIMEOUT constant"
```

---

### Task 2: Add state and stale removal logic

**Files:**
- Modify: `src/context/ScoreboardContext.tsx:28-144` (state interface and initial state)
- Modify: `src/context/ScoreboardContext.tsx:235-411` (SET_ON_COURSE handler)

**Context for the implementer:**

The `SET_ON_COURSE` reducer handler processes OnCourse messages from the C123 timing system. Each C123 message contains **1 competitor** with a `total` field indicating how many competitors are on course. The mapper (`c123ServerMapper.ts:81-107`) compares `total > activeCompetitors.length` — since each message has 1 competitor and total is usually > 1, almost every message is flagged as "partial" (`updateOnCourse: false`). Partial messages **merge** into the existing list instead of replacing it. This means competitors are never removed unless they get `dtFinish` (grace period removal) or a rare `total=1` message triggers a full replacement.

When a category ends and a competitor is removed/skipped by the timing official, C123 simply stops sending OnCourse for that competitor. Without explicit removal, the stale competitor stays in the list with an old `dtStart`, keeping `activeRaceId` pinned to the finished race. New category results get rejected.

The fix: track the last time each competitor's bib appeared in an incoming `SET_ON_COURSE` action. On every action, evict competitors not seen for 15 seconds. This follows the existing pattern of `onCourseFinishedAt` (tracks dtFinish timestamps for grace period).

- [ ] **Step 1: Write the failing test — stale competitors are removed after timeout**

Add to the `category change flow` describe block in `src/context/__tests__/ScoreboardContext.test.tsx`:

```typescript
    it('removes stale competitors not seen in OnCourse messages after timeout', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      // Competitor from race R1 on course (partial message — updateOnCourse: false)
      act(() => {
        mockProvider.triggerOnCourse({
          current: createOnCourseCompetitor({ bib: '10', raceId: 'R1', dtStart: '2025-12-28T10:00:00' }),
          onCourse: [createOnCourseCompetitor({ bib: '10', raceId: 'R1', dtStart: '2025-12-28T10:00:00' })],
          updateOnCourse: false,
        })
      })

      expect(result.current.onCourse).toHaveLength(1)
      expect(result.current.activeRaceId).toBe('R1')

      // Advance past STALE_COMPETITOR_TIMEOUT (15s)
      act(() => {
        vi.advanceTimersByTime(16000)
      })

      // New competitor from race R2 arrives (partial message)
      // This SET_ON_COURSE dispatch triggers the stale cleanup
      act(() => {
        mockProvider.triggerOnCourse({
          current: createOnCourseCompetitor({ bib: '20', raceId: 'R2', dtStart: '2025-12-28T10:05:00' }),
          onCourse: [createOnCourseCompetitor({ bib: '20', raceId: 'R2', dtStart: '2025-12-28T10:05:00' })],
          updateOnCourse: false,
        })
      })

      // Stale competitor from R1 should be removed, only R2 remains
      expect(result.current.onCourse).toHaveLength(1)
      expect(result.current.onCourse[0].bib).toBe('20')
      expect(result.current.activeRaceId).toBe('R2')
    })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/context/__tests__/ScoreboardContext.test.tsx -t "removes stale competitors"`

Expected: FAIL — `onCourse` has length 2 (both competitors), `activeRaceId` is still `R1`.

- [ ] **Step 3: Write the failing test — stale removal triggers category change**

Add after the previous test:

```typescript
    it('switches displayed results when stale competitors from old race are removed', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      // Set up: R1 competitor on course, R1 results displayed
      act(() => {
        mockProvider.triggerOnCourse({
          current: createOnCourseCompetitor({ bib: '10', raceId: 'R1', dtStart: '2025-12-28T10:00:00' }),
          onCourse: [createOnCourseCompetitor({ bib: '10', raceId: 'R1', dtStart: '2025-12-28T10:00:00' })],
          updateOnCourse: false,
        })
      })
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '10' })],
          raceName: 'C1M - Race 1',
          raceStatus: 'In Progress',
          highlightBib: null,
          raceId: 'R1',
        })
      })

      expect(result.current.raceName).toBe('C1M - Race 1')
      expect(result.current.activeRaceId).toBe('R1')

      // Time passes — C123 stops sending about bib 10 (removed/skipped)
      act(() => {
        vi.advanceTimersByTime(16000)
      })

      // R2 competitor arrives (partial)
      act(() => {
        mockProvider.triggerOnCourse({
          current: createOnCourseCompetitor({ bib: '20', raceId: 'R2', dtStart: '2025-12-28T10:05:00' }),
          onCourse: [createOnCourseCompetitor({ bib: '20', raceId: 'R2', dtStart: '2025-12-28T10:05:00' })],
          updateOnCourse: false,
        })
      })

      // activeRaceId should switch to R2, results cleared
      expect(result.current.activeRaceId).toBe('R2')
      expect(result.current.results).toEqual([])
      expect(result.current.raceName).toBe('')

      // R2 results should now be accepted
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '20' })],
          raceName: 'K1W - Race 2',
          raceStatus: 'In Progress',
          highlightBib: null,
          raceId: 'R2',
        })
      })

      expect(result.current.raceName).toBe('K1W - Race 2')
      expect(result.current.results).toHaveLength(1)
    })
```

- [ ] **Step 4: Run to verify it fails**

Run: `npx vitest run src/context/__tests__/ScoreboardContext.test.tsx -t "switches displayed results when stale"`

Expected: FAIL — `activeRaceId` still `R1`.

- [ ] **Step 5: Write the failing test — recently-seen competitors are NOT removed**

```typescript
    it('does not remove competitors that are still being reported', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      const comp10 = createOnCourseCompetitor({ bib: '10', raceId: 'R1', dtStart: '2025-12-28T10:00:00' })

      // Competitor on course
      act(() => {
        mockProvider.triggerOnCourse({
          current: comp10,
          onCourse: [comp10],
          updateOnCourse: false,
        })
      })

      // Advance 10 seconds (under the 15s threshold)
      act(() => {
        vi.advanceTimersByTime(10000)
      })

      // Same competitor reported again (refreshes lastSeenAt)
      act(() => {
        mockProvider.triggerOnCourse({
          current: { ...comp10, time: '45.00' },
          onCourse: [{ ...comp10, time: '45.00' }],
          updateOnCourse: false,
        })
      })

      // Advance another 10 seconds (20s since first seen, but only 10s since last seen)
      act(() => {
        vi.advanceTimersByTime(10000)
      })

      // Another message triggers cleanup check
      act(() => {
        mockProvider.triggerOnCourse({
          current: createOnCourseCompetitor({ bib: '20', raceId: 'R1', dtStart: '2025-12-28T10:01:00' }),
          onCourse: [createOnCourseCompetitor({ bib: '20', raceId: 'R1', dtStart: '2025-12-28T10:01:00' })],
          updateOnCourse: false,
        })
      })

      // Competitor 10 should still be in the list (seen 10s ago, under 15s threshold)
      expect(result.current.onCourse.find(c => c.bib === '10')).toBeDefined()
      expect(result.current.onCourse).toHaveLength(2)
    })
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/context/__tests__/ScoreboardContext.test.tsx -t "does not remove competitors that are still"`

Expected: FAIL — test passes vacuously because `lastSeenAt` tracking doesn't exist yet and the competitor stays regardless. Actually this test may pass. Run it and confirm; if it passes, it's fine — it guards the correct behavior post-implementation.

- [ ] **Step 7: Write the failing test — stale cleanup is skipped for full-replace messages**

Full-replace messages (`updateOnCourse: true`) replace the entire list, so stale cleanup should not also run (it's redundant and the new list is authoritative).

```typescript
    it('does not apply stale cleanup on full-replace messages', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      // Competitor from R1 via partial
      act(() => {
        mockProvider.triggerOnCourse({
          current: createOnCourseCompetitor({ bib: '10', raceId: 'R1', dtStart: '2025-12-28T10:00:00' }),
          onCourse: [createOnCourseCompetitor({ bib: '10', raceId: 'R1', dtStart: '2025-12-28T10:00:00' })],
          updateOnCourse: false,
        })
      })

      // Advance past timeout
      act(() => {
        vi.advanceTimersByTime(16000)
      })

      // Full-replace message that includes both old and new competitors
      // (e.g., CLI oncourse message that lists all competitors)
      const comp10 = createOnCourseCompetitor({ bib: '10', raceId: 'R1', dtStart: '2025-12-28T10:00:00' })
      const comp20 = createOnCourseCompetitor({ bib: '20', raceId: 'R2', dtStart: '2025-12-28T10:05:00' })
      act(() => {
        mockProvider.triggerOnCourse({
          current: comp10,
          onCourse: [comp10, comp20],
          updateOnCourse: true, // Full replace — list is authoritative
        })
      })

      // Both should remain — full replace is the truth, stale cleanup shouldn't remove bib 10
      expect(result.current.onCourse).toHaveLength(2)
    })
```

- [ ] **Step 8: Run to verify it fails (or passes)**

Run: `npx vitest run src/context/__tests__/ScoreboardContext.test.tsx -t "does not apply stale cleanup on full-replace"`

Expected: May pass since full-replace replaces the list regardless. Either way, it guards correct behavior.

- [ ] **Step 9: Implement — add `onCourseLastSeenAt` state**

In `src/context/ScoreboardContext.tsx`, add the import and state field:

Add to the import line at the top:
```typescript
import { DEPARTING_TIMEOUT, FINISHED_GRACE_PERIOD, STALE_COMPETITOR_TIMEOUT } from './constants'
```

Add to `ScoreboardState` interface after `onCourseFinishedAt`:
```typescript
  // Track when each competitor was last reported in an OnCourse message
  // Maps bib -> timestamp of last SET_ON_COURSE action containing this bib
  // Competitors not seen for STALE_COMPETITOR_TIMEOUT are removed (DNS/skip cleanup)
  onCourseLastSeenAt: Record<string, number>
```

Add to `initialState`:
```typescript
  onCourseLastSeenAt: {},
```

Add to `RESET_STATE` case — it already spreads `initialState`, so `onCourseLastSeenAt: {}` is included automatically. No change needed there.

- [ ] **Step 10: Implement — stale removal in SET_ON_COURSE**

In the `SET_ON_COURSE` case, **after** the existing grace period removal block (after the `newOnCourse = newOnCourse.filter(...)` at line ~311) and **before** the `activeOnCourse` computation (line ~317), add:

```typescript
      // Remove stale competitors that C123 stopped reporting
      // This handles DNS/skip at end of category: C123 just stops sending
      // OnCourse for removed competitors without an explicit dtFinish.
      // Only applies to partial/merge messages — full-replace messages
      // are authoritative and don't need stale cleanup.
      const newLastSeenAt: Record<string, number> = shouldUpdateOnCourse
        ? {} // Full replace — reset tracking, all competitors are fresh
        : { ...state.onCourseLastSeenAt }

      // Update lastSeenAt for bibs in the incoming message
      if (action.current) {
        newLastSeenAt[action.current.bib] = now
      }
      for (const comp of action.onCourse) {
        if (comp.dtStart) {
          newLastSeenAt[comp.bib] = now
        }
      }

      // For full-replace, seed all competitors in the new list
      if (shouldUpdateOnCourse) {
        for (const comp of newOnCourse) {
          newLastSeenAt[comp.bib] = now
        }
      }

      // Evict stale competitors (only from partial messages — full-replace is authoritative)
      if (!shouldUpdateOnCourse) {
        newOnCourse = newOnCourse.filter(c => {
          if (c.dtFinish) return true // Finished — managed by grace period, not stale timeout
          const lastSeen = newLastSeenAt[c.bib]
          if (!lastSeen) return true // No tracking — keep (newly added)
          if (now - lastSeen <= STALE_COMPETITOR_TIMEOUT) return true // Fresh — keep
          // Stale — remove
          delete newLastSeenAt[c.bib]
          return false
        })
      }

      // Clean up tracking for bibs no longer in the list
      const finalBibs = new Set(newOnCourse.map(c => c.bib))
      for (const bib of Object.keys(newLastSeenAt)) {
        if (!finalBibs.has(bib)) {
          delete newLastSeenAt[bib]
        }
      }
```

Then add `onCourseLastSeenAt: newLastSeenAt` to the `newState` object:

```typescript
      const newState: ScoreboardState = {
        ...state,
        currentCompetitor: newCurrent,
        onCourse: newOnCourse,
        onCourseFinishedAt: newFinishedAt,
        onCourseLastSeenAt: newLastSeenAt,   // ← add this line
        activeRaceId: newActiveRaceId,
        lastActiveRaceId: newActiveRaceId || state.lastActiveRaceId,
      }
```

- [ ] **Step 11: Run all tests**

Run: `npx vitest run src/context/__tests__/ScoreboardContext.test.tsx`

Expected: ALL PASS (including the new stale competitor tests and all existing tests).

- [ ] **Step 12: Commit**

```bash
git add src/context/constants.ts src/context/ScoreboardContext.tsx src/context/__tests__/ScoreboardContext.test.tsx
git commit -m "fix: remove stale competitors to unblock category switching

C123 sends individual OnCourse messages (1 competitor, total=N) which
the mapper always treats as partial (merge). When a competitor is
removed/skipped at end of a category, C123 simply stops sending
updates — but the competitor stays in the scoreboard's list with an
old dtStart, pinning activeRaceId to the finished race.

Track lastSeenAt per competitor and evict those not reported for 15s.
This allows activeRaceId to switch to the current race naturally.

Closes #48"
```

---

### Task 3: E2E verification with recorded data

**Files:** None (manual verification)

- [ ] **Step 1: Start the recording player**

```bash
cd ../c123-protocol-docs
node tools/player.js "$(node tools/recordings-cli.js path 2026-04-18-jarni-so-odp)" \
  --autoplay --xml-out /tmp/c123-replay.xml
```

- [ ] **Step 2: Start c123-server**

In another terminal:
```bash
cd ../c123-server
npm start -- --host localhost --port 27333 --xml /tmp/c123-replay.xml --no-discovery --no-tray
```

- [ ] **Step 3: Start scoreboard dev server**

```bash
npm run dev
```

- [ ] **Step 4: Open the scoreboard and fast-forward to category transition**

Open `http://localhost:5173/?server=localhost:27123` in a browser.

Use the player Control API to seek to just before the C1M_BR1→K1W_BR1 transition:

```bash
# Seek to 50 minutes into the recording
curl -X POST http://localhost:27340/seek -d '{"ts":3000000}' -H 'content-type: application/json'

# Play at 5x speed
curl -X POST http://localhost:27340/speed -d '{"speed":5}' -H 'content-type: application/json'
curl -X POST http://localhost:27340/play
```

Expected: Within ~15 seconds after C1M_BR1 messages stop (~54 min mark), the scoreboard should switch to the next active category. Previously it would stay stuck on C1M_BR1 for 28+ minutes.

- [ ] **Step 5: Verify with Sunday afternoon recording too**

Repeat steps 1-4 with `2026-04-19-jarni-ne-odp` recording to confirm the fix works on different data.
