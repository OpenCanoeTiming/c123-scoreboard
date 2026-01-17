# Development Log - Canoe Scoreboard V3

Chronological record of development, discoveries, and problem solutions.

---

## 2025-01-03 - Plan and Blocks T1-T3

- Designed architecture for automatic provider output comparison
- Mock TCP server simulating Canoe123 (reads recording, sends TCP data)
- Mock WS server for CLI replay
- Test: CLI 34 results, 1042 onCourse; C123 8 results, 756 onCourse

---

## 2026-01-03 - Mock TCP Protocol Fix

- Added pipe delimiter (`|`) between XML messages (Canoe123 protocol)
- Added 3s delay before replay
- C123 now collects data correctly

---

## 2026-01-03 - raceName Mapper Fix

**Problem:** CLI "K1m - střední trať - 2. jízda", C123 only "K1m - střední trať"

**Solution:** `buildRaceName()` extracts BR1/BR2 suffix from raceId

---

## 2026-01-04 - Playwright Tests

- Visual comparison CLI vs C123
- CLI: 20 rows (scrolling), C123: 105 rows (all)
- Differences expected

---

## 2026-01-04 - raceStatus Mapper

**Problem:** C123 returned "3"/"5" instead of "In Progress"/"Unofficial"

**Solution:** Human-readable values in mapper

---

## 2026-01-04 - Unit Tests

- 21 tests c123ServerMapper
- 31 tests C123ServerProvider
- Total 566 unit tests

---

## 2026-01-04 - Block 5 (REST Sync)

- XmlChange handling with checksum deduplication
- Sync state after reconnect via REST API

---

## 2026-01-04 - Block 7 (WebSocket Fixes)

- Fix React StrictMode - connect call deduplication
- Probe timeout 3000ms for explicit/cached servers
- New DiscoveryScreen design

---

## 2026-01-04 - Block 8 (OnCourse/Results Flow)

**Problem:** Competitors on course were disappearing

**Solution:** Filter competitors without dtStart

- Added raceId tracking - Results filtered by activeRaceId

---

## 2026-01-04 - Block 9 (Highlight, DNS/DNF, Title)

- **Highlight:** Changed from total comparison to timestamp-based detection
- **DNS/DNF/DSQ:** Status field + data detection
- **Title:** Fetch eventName from `/api/discover`

---

## 2026-01-04 - Live Testing Feedback

- DNS/DNF/DSQ: change to subtle style (not bold red)
- Don't infer DNS/DNF - if not in data, display `---`
- Flow: when category changes, hide previous results
- OnCourse blinking: show only competitor closest to finish
- Title: verify category addition, write TODO for C123 server

---

## 2026-01-04 - Block 10.1-10.3 (Visual Fixes)

- **10.1:** DNS/DNF/DSQ style changed to subtle (gray, italic, opacity)
- **10.2:** Removed status inference, empty time = `---`
- **10.3:** Results cleared on category change (activeRaceId)

---

## 2026-01-04 - Block 10.5 (Title in Header)

- **10.5:** Title component shows category as fallback when eventName missing
- Format: "TITLE: CATEGORY" or just "CATEGORY" if no title

---

## 2026-01-04 - Block 10.4 RESOLVED

**Problem:** C123 server sends OnCourse messages alternating (bib 10, then bib 11) - each message only one competitor.

**Three fixed problems:**

1. **Blinking with unstarted competitor:**
   - Message about unstarted (without dtStart) caused `updateOnCourse: true`
   - Fix: `isPartialMessage = total > activeCompetitors.length` (even for empty)

2. **Immediate disappearance of finished competitor:**
   - Competitor with dtFinish disappeared immediately without grace period
   - Fix: dtFinish filtered only for `current` selection, not for `onCourse` list

3. **Competitor never disappears (3+ on course):**
   - With partial messages, competitor with dtFinish stayed forever
   - Fix: Grace period tracking (`onCourseFinishedAt: Record<bib, timestamp>`)
   - After 5 seconds from dtFinish, competitor removed

**Key insight:** Difference between 2→1 (full message) and 3→2 (partial messages).

**Files:**
- `constants.ts`: `FINISHED_GRACE_PERIOD = 5000`
- `c123ServerMapper.ts`: Fixed partial message detection
- `ScoreboardContext.tsx`: Grace period logic + filtering for current

---

## 2026-01-04 - Phase E Complete (Blocks 11-14)

**Phase E Summary - Fortification and Stabilization:**

- **Block 11:** Committed changes + ESLint fixes (queueMicrotask for sync setState)
- **Block 12:** 37 new tests for partial OnCourse, DNS/DNF/DSQ, category flow, Title
- **Block 13:** Code review - all files clean, no dead code, consistent types
- **Block 14:** Documentation - CLAUDE.md extended with architecture, constants, troubleshooting

**Overall status after Phase E:**
- 603 tests passing
- 0 ESLint errors (3 warnings - fast refresh, doesn't affect production)
- Build successful
- Documentation current

---

## Lessons Learned

1. **Partial messages from C123 server** require merge logic, not replacement
2. **Grace period for dtFinish** is key for UX with multiple competitors on course
3. **Timestamp-based highlight** is more robust than diff-based
4. **React StrictMode double-mount** requires connect call deduplication

---

## 2026-01-04 - Phase F: Analysis and Plan

- **Goal:** BR1/BR2 merge display - combined results from both runs
- **C123 Server:** REST endpoint `/api/xml/races/:id/results?merged=true` already exists!
- **Scoreboard:** Needs implementation (5 blocks)
- **Decision:** Unified view (variant B) - extending existing ResultsList with extra columns
- Detailed plan split into blocks F1-F5

---

## 2026-01-05 - Phase G Complete: BR1/BR2 Merge Display

**Implemented:**

1. **G1: Types and Utilities**
   - `raceUtils.ts`: `isBR2Race()`, `isBR1Race()`, `getClassId()`, `getOtherRunRaceId()`
   - `Result` type extended with `run1`, `run2`, `bestRun`

2. **G2: REST Fetch and Merge Logic**
   - `C123ServerApi`: `getMergedResults(raceId)` - fetch from REST API
   - `br1br2Merger.ts`: `BR2Manager` class with debounced fetch (500ms)
   - `mergeBR1IntoBR2Results()`, `mergeBR1CacheIntoBR2Results()`

3. **G3: C123ServerProvider Integration**
   - `BR2Manager` instantiated at provider start
   - `processResults()` automatically merges BR1 data for BR2 races
   - BR1 data cache for fast response

4. **G4: UI Components**
   - `ResultRow`: `RunTimeCell` component for BR1/BR2 columns
   - CSS: `.br2Row` grid layout, `.worseRun` opacity styling
   - Ledwall: penalties hidden for BR2 (may be from different run)
   - Vertical: two columns (BR1, BR2) with visual distinction for better/worse

5. **G5: Tests**
   - Unit tests for raceUtils (45 tests)
   - Unit tests for br1br2Merger (12 tests)
   - Total 672 tests, all passing

**Key findings:**
- TCP stream sends `Total` = best of both runs (not BR2 total!)
- BR1 data must be fetched from REST API
- 500ms debounce protects against API overload during rapid Results messages

**Files:**
- `src/utils/raceUtils.ts` - BR1/BR2 utility functions
- `src/providers/utils/br1br2Merger.ts` - BR2Manager + merge logic
- `src/providers/utils/c123ServerApi.ts` - REST API client
- `src/components/ResultsList/ResultRow.tsx` - RunTimeCell for BR2
- `src/components/ResultsList/ResultsList.module.css` - BR2 styles

---

## 2026-01-06 - Phase J Complete: Documentation

**Phase J Summary - Complete Documentation:**

1. **J1: README.md** - Complete user guide rewrite
   - Quick start, installation, configuration
   - Layout modes, data sources, deployment

2. **J2: docs/url-parameters.md** - All URL parameters reference
   - Parameter table with types and defaults
   - ConfigPush override behavior

3. **J3: docs/configuration.md** - Remote configuration
   - ConfigPush, ClientState, ForceRefresh
   - Asset management, clientId flow

4. **J4: docs/data-providers.md** - Provider interface
   - C123ServerProvider, CLIProvider, ReplayProvider
   - Auto-discovery, reconnect logic

5. **J5: docs/components.md** - React components
   - App, ScoreboardContext, ResultsList
   - Hooks documentation

6. **J6: docs/development.md** - Developer guide
   - Setup, structure, coding standards
   - Git workflow

7. **J7: Existing docs updates**
   - testing.md - extended with coverage, CI/CD, how to write tests
   - architecture.md - added BR2Manager, raceUtils

**Overall status after Phase J:**
- Complete user documentation (README.md)
- 7 documents in docs/ folder
- 725 tests passing
- Project ready for future maintenance

---

## 2026-01-07 - Phase K: Documentation Maintenance

**K1: Check links to analysis/**
- All links valid after ecosystem documentation reorganization
- `../analysis/recordings/`, `../analysis/captures/` - OK

**K2: Extend testing.md**
- Added command `npm test -- --run --coverage`
- Extended CI/CD section with pre-commit checklist and coverage targets

**PLAN.md Consolidation**
- Reduced from 248 → 72 lines (71%)
- Removed completed checklists, kept only overview

---

## V3 Development Closure

Canoe Scoreboard V3 is functionally complete:

- **Full V2 compatibility** - same display, same logic
- **BR1/BR2 merge** - new functionality showing both runs
- **ConfigPush** - remote configuration from C123 server
- **Asset management** - logo and banner customization
- **725+ tests** - robust test coverage
- **Complete documentation** - for users and developers

---

## 2026-01-16 - Phase M: E2E Tests - Infrastructure Fixes

**Identified problems:**
1. Missing `source=replay` in URL - ReplayProvider didn't activate
2. Port conflicts in mock servers
3. Incorrect CSS selectors (`div[class*="row"]` → `[data-bib]`)
4. Low `pauseAfter` values (first `top` message is 33rd ws/tcp message)
5. Outdated grid columns expectations

**Fixes performed:**
- Added `source=replay` to visual, dynamic, layout, scroll, performance spec files
- Added port cleanup (`fuser -k`) to cli-vs-c123.spec.ts
- Updated selectors to `[data-bib]`
- Increased `pauseAfter` from 50 to 500
- Updated expectations (vertical: 5 columns, ledwall: 5 columns)
- Regenerated visual snapshots

**Results:**
- Before: ~45 passed, mostly timeouts
- After: 49 passed (single worker), 22 skipped, 5 failed

**Remaining problems** (documented in PLAN.md Phase M):
- M.1: cli-vs-c123 mock server infrastructure (C123 Server connection)
- M.2: layout dynamic resize test
- M.3: performance rapid updates timeout
- M.4: scroll tests timing issues
- M.5: displayRows scaling test

**Note:** Recording data (`rec-2025-12-28T09-34-10.jsonl`) has 5970 messages, first `top` message with results is on line 104 (33rd ws/tcp message after filtering).
