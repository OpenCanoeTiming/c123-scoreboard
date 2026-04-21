# Browse Scroll After Highlight — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After ledwall highlights a finished competitor, slowly scroll down through results to show spectators the context around the finisher's position.

**Architecture:** Extend the existing `useAutoScroll` state machine with two new phases (`BROWSE_SCROLLING`, `BROWSE_PAUSED_AT_BOTTOM`). Add a `lastTopShownAtRef` to track when the top of results was last visible — if >3 minutes, skip browse and return to top instead. Continuous pixel scroll via `requestAnimationFrame` at 20px/s. New `browseAfterHighlight` URL param (opt-in, default false) parsed in `useLayout`.

**Tech Stack:** React 18, TypeScript, Vitest, CSS Modules

---

### Task 1: Add `browseAfterHighlight` to `useLayout`

**Files:**
- Modify: `src/hooks/useLayout.ts`
- Modify: `src/hooks/__tests__/useLayout.test.ts`

- [ ] **Step 1: Write failing tests for `browseAfterHighlight` URL param**

Add a new `describe` block in `src/hooks/__tests__/useLayout.test.ts` after the existing `scrollToFinished parameter` block:

```typescript
describe('browseAfterHighlight parameter', () => {
  it('defaults to false when not specified', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '' },
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useLayout())

    expect(result.current.browseAfterHighlight).toBe(false)
  })

  it('returns true when browseAfterHighlight=true', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '?browseAfterHighlight=true' },
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useLayout())

    expect(result.current.browseAfterHighlight).toBe(true)
  })

  it('returns false when browseAfterHighlight=false', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '?browseAfterHighlight=false' },
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useLayout())

    expect(result.current.browseAfterHighlight).toBe(false)
  })

  it('returns false for invalid values (defaults to false)', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '?browseAfterHighlight=invalid' },
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useLayout())

    expect(result.current.browseAfterHighlight).toBe(false)
  })

  it('works combined with other URL parameters', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '?type=ledwall&browseAfterHighlight=true&scrollToFinished=true' },
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useLayout())

    expect(result.current.layoutMode).toBe('ledwall')
    expect(result.current.browseAfterHighlight).toBe(true)
    expect(result.current.scrollToFinished).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/hooks/__tests__/useLayout.test.ts`
Expected: FAIL — `browseAfterHighlight` property does not exist on `LayoutConfig`

- [ ] **Step 3: Add `browseAfterHighlight` to `LayoutConfig` and parsing**

In `src/hooks/useLayout.ts`:

1. Add to `LayoutConfig` interface (after `scrollToFinished`):
```typescript
/** Whether to browse-scroll through results after highlight on ledwall (default: false). */
browseAfterHighlight: boolean
```

2. Add to `LayoutURLParams` interface (after `scrollToFinished`):
```typescript
/** Whether to browse-scroll after highlight (default: false) */
browseAfterHighlight: boolean
```

3. In `getLayoutParamsFromURL()`, add after `scrollToFinished` parsing:
```typescript
// Parse browseAfterHighlight - default false, explicit 'true' enables
const browseAfterHighlight = params.get('browseAfterHighlight') === 'true'
```

4. Add `browseAfterHighlight` to the return object of `getLayoutParamsFromURL()`:
```typescript
return {
  type: type === 'vertical' || type === 'ledwall' ? type : null,
  disableScroll,
  displayRows,
  scrollToFinished,
  browseAfterHighlight,
}
```

5. Add `browseAfterHighlight` to the `LayoutConfig` return in the `config` useMemo:
```typescript
return {
  // ... existing fields ...
  scrollToFinished: urlParams.scrollToFinished,
  browseAfterHighlight: urlParams.browseAfterHighlight,
}
```

6. Add `urlParams.browseAfterHighlight` to the `useMemo` dependency array for `config`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/hooks/__tests__/useLayout.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useLayout.ts src/hooks/__tests__/useLayout.test.ts
git commit -m "feat: add browseAfterHighlight URL parameter to useLayout (#50)"
```

---

### Task 2: Add `browseAfterHighlight` to ConfigPush types and provider

**Files:**
- Modify: `src/types/c123server.ts`
- Modify: `src/providers/C123ServerProvider.ts`

- [ ] **Step 1: Add `browseAfterHighlight` to `C123ConfigPushData`**

In `src/types/c123server.ts`, add after `scrollToFinished` in `C123ConfigPushData`:

```typescript
/** Whether to browse-scroll through results after highlight on ledwall (default: false). */
browseAfterHighlight?: boolean
```

- [ ] **Step 2: Add ConfigPush handling in `C123ServerProvider.ts`**

Find the ConfigPush handler section where `scrollToFinished` is handled (around line 653-656). Add immediately after:

```typescript
// Apply browseAfterHighlight
if (data.browseAfterHighlight !== undefined) {
  url.searchParams.set('browseAfterHighlight', String(data.browseAfterHighlight))
}
```

Find the `sendClientState` method (around line 678-698). Add `browseAfterHighlight` to the `current` object, after `scrollToFinished`:

```typescript
const browseAfterHighlightParam = params.get('browseAfterHighlight')
```

And in the `current` object:
```typescript
browseAfterHighlight: browseAfterHighlightParam === 'true' || (appliedConfig.browseAfterHighlight ?? false),
```

Add `'browseAfterHighlight'` to the `capabilities` array:
```typescript
capabilities: ['configPush', 'forceRefresh', 'clientIdPush', 'scrollToFinished', 'browseAfterHighlight', 'assetManagement'],
```

- [ ] **Step 3: Run all tests to verify nothing broke**

Run: `npm test -- --run`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/types/c123server.ts src/providers/C123ServerProvider.ts
git commit -m "feat: add browseAfterHighlight to ConfigPush types and provider (#50)"
```

---

### Task 3: Add CSS override for browse scroll mode

**Files:**
- Modify: `src/components/ResultsList/ResultsList.module.css`

- [ ] **Step 1: Add `data-browsing` attribute CSS rule**

In `src/components/ResultsList/ResultsList.module.css`, add after the `.container.hidden` block (after line 27):

```css
/* Override smooth scroll during browse mode (rAF pixel scrolling) */
.container[data-browsing="true"] {
  scroll-behavior: auto;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ResultsList/ResultsList.module.css
git commit -m "feat: add data-browsing CSS override for continuous scroll (#50)"
```

---

### Task 4: Implement browse scroll in `useAutoScroll`

**Files:**
- Modify: `src/hooks/useAutoScroll.ts`

This is the core task. It adds:
- Two new phases: `BROWSE_SCROLLING` and `BROWSE_PAUSED_AT_BOTTOM`
- `lastTopShownAtRef` for tracking when top was last visible
- `rafRef` for requestAnimationFrame lifecycle
- Decision logic after highlight expires
- `data-browsing` attribute management on the container

- [ ] **Step 1: Add new phases to `ScrollPhase` type**

In `src/hooks/useAutoScroll.ts`, update the `ScrollPhase` type (line 9-16):

```typescript
type ScrollPhase =
  | 'IDLE'
  | 'WAITING'
  | 'SCROLLING'
  | 'PAUSED_AT_BOTTOM'
  | 'RETURNING_TO_TOP'
  | 'HIGHLIGHT_VIEW'
  | 'SCROLLING_TO_TOP_FOR_COMPETITOR'
  | 'BROWSE_SCROLLING'
  | 'BROWSE_PAUSED_AT_BOTTOM'
```

- [ ] **Step 2: Add browse scroll constants**

Add after `BOTTOM_THRESHOLD_PX` (line 27):

```typescript
// Browse scroll constants (ledwall only)
const BROWSE_SPEED_PX_PER_SEC = 20
const BROWSE_TOP_THRESHOLD = 3 * 60 * 1000 // 3 minutes
const BROWSE_BOTTOM_PAUSE = 1500 // 1.5s pause at bottom, matches ledwall.bottomPauseTime
```

- [ ] **Step 3: Add new refs and read `browseAfterHighlight` from layout**

In the hook body, after `const currentRowIndexRef = useRef(0)` (line 108), add:

```typescript
// Browse scroll: track when top of results was last shown to spectators
const lastTopShownAtRef = useRef<number>(Date.now())
// Browse scroll: rAF handle for continuous pixel scrolling
const browseRafRef = useRef<number | null>(null)
```

Update the `useLayout()` destructuring (line 117) to include `browseAfterHighlight`:

```typescript
const { layoutMode, rowHeight, scrollToFinished, browseAfterHighlight } = useLayout()
```

- [ ] **Step 4: Add `stopBrowseScroll` helper**

Add after the `scrollToTop` callback (after line 166):

```typescript
/** Stop the browse scroll rAF loop and remove data-browsing attribute */
const stopBrowseScroll = useCallback(() => {
  if (browseRafRef.current !== null) {
    cancelAnimationFrame(browseRafRef.current)
    browseRafRef.current = null
  }
  if (containerRef.current) {
    containerRef.current.removeAttribute('data-browsing')
  }
}, [])
```

- [ ] **Step 5: Add `updateLastTopShown` helper**

Add after `stopBrowseScroll`:

```typescript
/** Mark that the top of results is currently visible */
const updateLastTopShown = useCallback(() => {
  lastTopShownAtRef.current = Date.now()
}, [])
```

- [ ] **Step 6: Update `reset()` to track top shown and stop browse**

Update the `reset` callback to also call `stopBrowseScroll` and `updateLastTopShown`:

```typescript
const reset = useCallback(() => {
  setManuallyPaused(false)
  setPhase('IDLE')
  setScrollTick(0)
  currentRowIndexRef.current = 0
  stopBrowseScroll()
  updateLastTopShown()
  if (containerRef.current) {
    containerRef.current.scrollTop = 0
  }
}, [stopBrowseScroll, updateLastTopShown])
```

- [ ] **Step 7: Modify highlight-end effect to support browse**

Replace the existing "Return to normal after highlight ends" effect (lines 228-240) with:

```typescript
/**
 * Return to normal after highlight ends
 * On ledwall with browseAfterHighlight: start browse scroll if top was shown recently
 */
useEffect(() => {
  if (!isHighlightActive && phase === 'HIGHLIGHT_VIEW') {
    const timeSinceTopShown = Date.now() - lastTopShownAtRef.current
    const shouldBrowse = layoutMode === 'ledwall'
      && browseAfterHighlight
      && timeSinceTopShown <= BROWSE_TOP_THRESHOLD

    const timeoutId = setTimeout(() => {
      if (shouldBrowse) {
        setPhase('BROWSE_SCROLLING')
      } else {
        scrollToTop()
        currentRowIndexRef.current = 0
        setPhase('IDLE')
      }
    }, 500) // Small delay for highlight to fade

    return () => clearTimeout(timeoutId)
  }
}, [isHighlightActive, phase, scrollToTop, layoutMode, browseAfterHighlight])
```

- [ ] **Step 8: Add browse scroll phases to state machine effect**

In the main auto-scroll state machine effect, add handling for the two new phases. Add before the `switch (phase)` statement (around line 360), after the `shouldScroll` early-return block:

```typescript
// Handle BROWSE_SCROLLING phase
// Runs independently of shouldScroll — it has its own lifecycle
if (phase === 'BROWSE_SCROLLING') {
  if (!container) {
    queueMicrotask(() => setPhase('IDLE'))
    return
  }

  // Set data-browsing attribute to disable CSS smooth scroll
  container.setAttribute('data-browsing', 'true')

  let lastTime = performance.now()

  const step = (now: number) => {
    const dt = now - lastTime
    lastTime = now
    container.scrollTop += (BROWSE_SPEED_PX_PER_SEC * dt) / 1000

    if (isAtBottom()) {
      stopBrowseScroll()
      setPhase('BROWSE_PAUSED_AT_BOTTOM')
      return
    }
    browseRafRef.current = requestAnimationFrame(step)
  }

  browseRafRef.current = requestAnimationFrame(step)

  return () => {
    stopBrowseScroll()
  }
}

// Handle BROWSE_PAUSED_AT_BOTTOM phase
if (phase === 'BROWSE_PAUSED_AT_BOTTOM') {
  const timeoutId = setTimeout(() => {
    scrollToTop()
    updateLastTopShown()
    currentRowIndexRef.current = 0
    setPhase('IDLE')
  }, BROWSE_BOTTOM_PAUSE)

  return () => clearTimeout(timeoutId)
}
```

**Important:** These two blocks must appear BEFORE the `if (!shouldScroll)` early-return check, but AFTER the `SCROLLING_TO_TOP_FOR_COMPETITOR` and competitor-started-running blocks. The browse phases manage their own lifecycle and should not be interrupted by `shouldScroll` being false.

- [ ] **Step 9: Update `RETURNING_TO_TOP` to track top shown**

In the existing `RETURNING_TO_TOP` case inside the switch (around line 404-409), add `updateLastTopShown()`:

```typescript
case 'RETURNING_TO_TOP':
  // Wait for scroll animation + delay, then restart cycle
  timeoutId = setTimeout(() => {
    currentRowIndexRef.current = 0
    updateLastTopShown()
    setPhase('WAITING')
  }, scrollConfig.returnDelay)
  break
```

- [ ] **Step 10: Update `SCROLLING_TO_TOP_FOR_COMPETITOR` to track top shown and stop browse**

In the existing handler for `SCROLLING_TO_TOP_FOR_COMPETITOR` (around line 252-260), add `stopBrowseScroll()` and `updateLastTopShown()`:

```typescript
if (phase === 'SCROLLING_TO_TOP_FOR_COMPETITOR') {
  stopBrowseScroll()
  scrollToTop()
  currentRowIndexRef.current = 0
  const timeoutId = setTimeout(() => {
    updateLastTopShown()
    setPhase('IDLE')
  }, 500)
  return () => clearTimeout(timeoutId)
}
```

- [ ] **Step 11: Add browse phases to competitor-started-running check**

In the existing competitor-started-running check (around line 264-279), add `BROWSE_SCROLLING` and `BROWSE_PAUSED_AT_BOTTOM` to the phase check so that a competitor starting a run during browse properly scrolls to top:

```typescript
if (hasActivelyRunningCompetitor && !wasActivelyRunning) {
  // Only scroll to top if we were in an active scrolling phase and not already at top
  if (phase === 'SCROLLING' || phase === 'PAUSED_AT_BOTTOM' || phase === 'WAITING'
      || phase === 'BROWSE_SCROLLING' || phase === 'BROWSE_PAUSED_AT_BOTTOM') {
    if (containerRef.current && containerRef.current.scrollTop > 0) {
      queueMicrotask(() => {
        setPhase('SCROLLING_TO_TOP_FOR_COMPETITOR')
      })
      return
    }
  }
  queueMicrotask(() => {
    setPhase('IDLE')
  })
  return
}
```

- [ ] **Step 12: Handle browse interrupt when new highlight starts**

In the existing highlight scroll effect (around line 193-223), add browse stop at the beginning:

```typescript
useEffect(() => {
  if (!isHighlightActive || !highlightBib || !containerRef.current) return
  if (hasScrolledToHighlight.current) return

  // Stop any active browse scroll
  stopBrowseScroll()

  // ... rest of existing code unchanged ...
}, [isHighlightActive, highlightBib, scrollToFinished, stopBrowseScroll])
```

- [ ] **Step 13: Add cleanup on unmount**

Add a new effect for cleaning up the rAF on unmount:

```typescript
// Cleanup browse scroll on unmount
useEffect(() => {
  return () => {
    stopBrowseScroll()
  }
}, [stopBrowseScroll])
```

- [ ] **Step 15: Update useEffect dependency arrays**

The main state machine effect dependency array (line 425) needs `stopBrowseScroll` and `updateLastTopShown` added:

```typescript
}, [shouldScroll, phase, scrollConfig, rowHeight, scrollTick, scrollToTop, hasActivelyRunningCompetitor, layoutMode, stopBrowseScroll, updateLastTopShown])
```

- [ ] **Step 16: Run full test suite**

Run: `npm test -- --run`
Expected: ALL PASS (existing tests should still pass; new phases don't activate without `browseAfterHighlight=true` from layout mock)

- [ ] **Step 17: Commit**

```bash
git add src/hooks/useAutoScroll.ts
git commit -m "feat: implement browse scroll after highlight on ledwall (#50)"
```

---

### Task 5: Write tests for browse scroll behavior

**Files:**
- Modify: `src/hooks/__tests__/useAutoScroll.test.ts`

- [ ] **Step 1: Update mock defaults to include `browseAfterHighlight`**

In the mock setup for `useLayout` (both at the top-level `vi.mock` and in `beforeEach`), add `browseAfterHighlight: false` and `scrollToFinished: true` to the mock return value:

```typescript
mockUseLayout.mockReturnValue({
  layoutMode: 'vertical',
  viewportWidth: 1080,
  viewportHeight: 1920,
  visibleRows: 10,
  rowHeight: 48,
  showFooter: true,
  headerHeight: 100,
  footerHeight: 60,
  fontSizeCategory: 'medium',
  disableScroll: false,
  browseAfterHighlight: false,
  scrollToFinished: true,
})
```

- [ ] **Step 2: Write tests for browse scroll**

Add a new `describe('browse scroll after highlight', ...)` block:

```typescript
describe('browse scroll after highlight', () => {
  it('does not activate browse on vertical layout even when enabled', async () => {
    mockUseLayout.mockReturnValue({
      layoutMode: 'vertical',
      viewportWidth: 1080,
      viewportHeight: 1920,
      visibleRows: 10,
      rowHeight: 48,
      showFooter: true,
      headerHeight: 100,
      footerHeight: 60,
      fontSizeCategory: 'medium',
      disableScroll: false,
      browseAfterHighlight: true,
      scrollToFinished: true,
    })

    // Start with highlight active
    mockUseHighlight.mockReturnValue({
      highlightBib: '42',
      isActive: true,
      timeRemaining: 5000,
      progress: 0,
    })

    const { result, rerender } = renderHook(() => useAutoScroll({ enabled: true }))

    await act(async () => {
      vi.runAllTimers()
    })

    // End highlight
    mockUseHighlight.mockReturnValue({
      highlightBib: null,
      isActive: false,
      timeRemaining: 0,
      progress: 0,
    })

    rerender()

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    // Should NOT be in browse mode — vertical layout
    expect(result.current.phase).not.toBe('BROWSE_SCROLLING')
  })

  it('does not activate browse when browseAfterHighlight is false', async () => {
    mockUseLayout.mockReturnValue({
      layoutMode: 'ledwall',
      viewportWidth: 768,
      viewportHeight: 384,
      visibleRows: 5,
      rowHeight: 56,
      showFooter: false,
      headerHeight: 60,
      footerHeight: 0,
      fontSizeCategory: 'large',
      disableScroll: false,
      browseAfterHighlight: false,
      scrollToFinished: true,
    })

    mockUseHighlight.mockReturnValue({
      highlightBib: '42',
      isActive: true,
      timeRemaining: 5000,
      progress: 0,
    })

    const { result, rerender } = renderHook(() => useAutoScroll({ enabled: true }))

    await act(async () => {
      vi.runAllTimers()
    })

    // End highlight
    mockUseHighlight.mockReturnValue({
      highlightBib: null,
      isActive: false,
      timeRemaining: 0,
      progress: 0,
    })

    rerender()

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    // Should NOT be in browse mode — feature disabled
    expect(result.current.phase).not.toBe('BROWSE_SCROLLING')
  })

  it('transitions from HIGHLIGHT_VIEW to BROWSE_SCROLLING on ledwall when enabled', async () => {
    mockUseLayout.mockReturnValue({
      layoutMode: 'ledwall',
      viewportWidth: 768,
      viewportHeight: 384,
      visibleRows: 5,
      rowHeight: 56,
      showFooter: false,
      headerHeight: 60,
      footerHeight: 0,
      fontSizeCategory: 'large',
      disableScroll: false,
      browseAfterHighlight: true,
      scrollToFinished: true,
    })

    // Start with highlight
    mockUseHighlight.mockReturnValue({
      highlightBib: '42',
      isActive: true,
      timeRemaining: 5000,
      progress: 0,
    })

    const { result, rerender } = renderHook(() => useAutoScroll({ enabled: true }))

    await act(async () => {
      vi.runAllTimers()
    })

    // Verify we're in HIGHLIGHT_VIEW
    expect(result.current.phase).toBe('HIGHLIGHT_VIEW')

    // End highlight
    mockUseHighlight.mockReturnValue({
      highlightBib: null,
      isActive: false,
      timeRemaining: 0,
      progress: 0,
    })

    rerender()

    // Wait for the 500ms delay after highlight fade
    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    // Should transition to BROWSE_SCROLLING
    expect(result.current.phase).toBe('BROWSE_SCROLLING')
  })

  it('handles unmount during BROWSE_SCROLLING without errors', async () => {
    mockUseLayout.mockReturnValue({
      layoutMode: 'ledwall',
      viewportWidth: 768,
      viewportHeight: 384,
      visibleRows: 5,
      rowHeight: 56,
      showFooter: false,
      headerHeight: 60,
      footerHeight: 0,
      fontSizeCategory: 'large',
      disableScroll: false,
      browseAfterHighlight: true,
      scrollToFinished: true,
    })

    const { unmount } = renderHook(() => useAutoScroll({ enabled: true }))

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(() => unmount()).not.toThrow()
  })
})
```

- [ ] **Step 3: Run tests**

Run: `npm test -- --run src/hooks/__tests__/useAutoScroll.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/hooks/__tests__/useAutoScroll.test.ts
git commit -m "test: add browse scroll tests for useAutoScroll (#50)"
```

---

### Task 6: Update documentation

**Files:**
- Modify: `docs/url-parameters.md`
- Modify: `docs/configuration.md`

- [ ] **Step 1: Add `browseAfterHighlight` to URL parameters doc**

In `docs/url-parameters.md`, add a new row to the overview table (after `scrollToFinished`):

```markdown
| `browseAfterHighlight` | boolean | `false` | Procházení výsledků po highlightu (ledwall) |
```

Add a new section after `### scrollToFinished` (after line 104):

```markdown
---

### browseAfterHighlight

Po zobrazení dojetého závodníka (highlight) na ledwallu pomalu scrolluje dolů výsledky, aby diváci viděli kontext kolem závodníkovy pozice.

```
?browseAfterHighlight=true    # Zapne browse scroll po highlightu
```

**Default:** `false` (po highlightu se vrací na začátek výsledků)

**Chování:**
- Funguje pouze na `ledwall` layoutu — na vertikálním se ignoruje
- Po skončení highlightu (5s) začne pomalý plynulý scroll dolů (20px/s)
- Po dojetí na konec výsledků se vrátí na začátek
- Pokud se horní část výsledků nezobrazila déle než 3 minuty, browse se přeskočí a zobrazí se top výsledků (aby diváci viděli čelo závodu)
- Nový finish okamžitě přeruší browse a zobrazí nového závodníka
```

- [ ] **Step 2: Add to ConfigPush documentation**

In `docs/configuration.md`, add `browseAfterHighlight` to the ConfigPush supported fields table (after `scrollToFinished` row):

```markdown
| `browseAfterHighlight` | boolean | Browse scroll po highlightu na ledwallu (výchozí: false) |
```

Add to the ConfigPush example JSON:

```json
"browseAfterHighlight": true,
```

Add to the `ClientState` capabilities table:

```markdown
| `browseAfterHighlight` | Podporuje browse scroll po highlightu |
```

- [ ] **Step 3: Add to ConfigPush override table in URL parameters doc**

In `docs/url-parameters.md`, add to the ConfigPush override table (around line 222):

```markdown
| `browseAfterHighlight` | `browseAfterHighlight` |
```

- [ ] **Step 4: Commit**

```bash
git add docs/url-parameters.md docs/configuration.md
git commit -m "docs: document browseAfterHighlight parameter (#50)"
```

---

### Task 7: Integration test with manual verification

**Files:** None (manual testing)

- [ ] **Step 1: Build the project**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 2: Run full test suite**

Run: `npm test -- --run`
Expected: ALL PASS

- [ ] **Step 3: Manual test with replay data**

Start the replay player and c123-server (see CLAUDE.md for instructions), then open the scoreboard with:

```
http://localhost:5173/?type=ledwall&displayRows=5&browseAfterHighlight=true
```

Verify:
1. After a competitor finishes, highlight appears and scrolls to their position
2. After highlight expires (5s), slow continuous scroll starts downward
3. Scroll reaches bottom → 1.5s pause → returns to top
4. New finish interrupts browse scroll immediately
5. After 3+ minutes without showing top, browse is skipped and top is shown instead
6. With `browseAfterHighlight=false` (or omitted), behavior is unchanged from before

- [ ] **Step 4: Test vertical layout is unaffected**

Open: `http://localhost:5173/?type=vertical&browseAfterHighlight=true`

Verify: No browse scroll occurs even with the parameter set — vertical layout ignores it.
