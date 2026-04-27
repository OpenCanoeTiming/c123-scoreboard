# URL Category Filter — Design Spec

**Issue:** #49 — allow to pre-select and fix (day+)category by URL parameter
**Date:** 2026-04-27

## Problem

The scoreboard automatically follows whatever category is currently racing. When multiple displays are set up side by side — each dedicated to a different category — results disappear when the race switches to the next category. There is no way to lock a display to a specific category.

## Solution

A new URL parameter `?category=K1M` that fixes the scoreboard to a specific class. The scoreboard ignores all data from other categories and shows an empty/waiting state when the fixed category is not active.

## URL Parameter

- **Name:** `category`
- **Value:** Class prefix (e.g., `K1M`, `C1W`, `C2M`)
- **Example:** `http://localhost:5173/?category=K1M&type=ledwall`
- **Parsed in:** `getUrlParams()` in `App.tsx`, normalized to uppercase, passed to `ScoreboardProvider`

## Matching Logic

Race IDs follow the format `{CLASS}_{COURSE}_{RUN}_{VERSION}` (e.g., `K1M_ST_BR2_6`).

Match condition: `raceId.startsWith(fixedCategory + '_')`

This means:
- Day (version suffix) is always current — follows whatever is in the data
- Run (BR1/BR2) follows the current race flow automatically
- Only the class is fixed

## Behavior in ScoreboardContext Reducer

When `fixedCategory` is set:

1. **SET_ON_COURSE** — Updates on-course data only if the competitor's `raceId` matches the fixed category. If it doesn't match → **actively clears** on-course state (`current: null`, `onCourse: []`) and sets `activeRaceId: null`. This ensures transition to the empty/waiting state rather than leaving stale data.
2. **SET_RESULTS** — Accepts results only if `raceId` matches the fixed category. If the results are for a different category → **clears results** (empty array) rather than just ignoring. This prevents stale results from the fixed category lingering after the race moves on.
3. **activeRaceId** — Changes only within the fixed category (e.g., from `K1M_ST_BR1_6` to `K1M_ST_BR2_6` when switching runs). When incoming data is for a different class, `activeRaceId` is set to `null` (not kept as the old value).
4. **Filter precedence** — The `fixedCategory` check runs **before** the existing `activeRaceId`/`targetRaceId` logic. This ensures results for the fixed category are accepted even on initial load before `activeRaceId` is established.
5. **Category not active** — The scoreboard shows an empty state: no competitor on course, no results. Standard "waiting" appearance.

## What Does NOT Change

- **UI components** — No changes. They react to the same context state.
- **DataProvider** — Still delivers all data. Filtering happens in the context reducer.
- **Other URL parameters** — No changes. `category` is independent and composable with `type`, `server`, `displayRows`, etc.
- **Visual indication** — Category name already appears in the title. No additional lock icon or indicator needed.
- **No `category` parameter** — Scoreboard behaves exactly as today (automatic category tracking).

## Files to Change

| File | Change |
|------|--------|
| `src/App.tsx` | Parse `category` URL param in `getUrlParams()`, pass to provider |
| `src/context/ScoreboardContext.tsx` | Add `fixedCategory` to state, add matching logic to `SET_ON_COURSE` and `SET_RESULTS` reducers |
| `src/context/__tests__/ScoreboardContext.test.tsx` | Tests for fixed category filtering |
