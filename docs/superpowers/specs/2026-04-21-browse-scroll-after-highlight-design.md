# Browse Scroll After Highlight — Design Spec

**Issue:** #50
**Date:** 2026-04-21
**Status:** Approved

## Summary

After the ledwall scrolls to a finished competitor and the highlight expires, slowly scroll down through the results to give spectators context around the finisher's position. This is an optional feature enabled via `browseAfterHighlight` URL parameter.

## Scope

- **Ledwall only** — vertical layout ignores this feature entirely
- **Opt-in** — `browseAfterHighlight=false` by default, existing behavior unchanged
- **Single file change focus** — primarily extends `useAutoScroll.ts` state machine

## Requirements

1. After highlight expires on ledwall, start slow continuous scroll downward from the finisher's position
2. Scroll speed: ~20px/s (continuous pixel-based via requestAnimationFrame, not page-based)
3. New finish immediately interrupts browse scroll (priority is always the latest finish)
4. Competitor starting a run interrupts browse scroll (existing behavior)
5. Periodically show the top of results so spectators see race leaders — if top hasn't been shown for >3 minutes, skip browse and scroll to top instead
6. Pause briefly at bottom before returning to top (consistent with existing UX)

## State Machine Extension

### New phases

- `BROWSE_SCROLLING` — continuous pixel scroll downward at 20px/s
- `BROWSE_PAUSED_AT_BOTTOM` — 1.5s pause at bottom before returning to top

### Updated flow after highlight

```
HIGHLIGHT_VIEW → (highlight expires) → decision:
  ├─ lastTopShownAt > 3 min ago → scrollToTop → IDLE (existing behavior)
  └─ lastTopShownAt <= 3 min ago → BROWSE_SCROLLING
                                     ├─ reaches bottom → BROWSE_PAUSED_AT_BOTTOM (1.5s) → scrollToTop → IDLE
                                     ├─ new highlight → HIGHLIGHT_VIEW (immediate interrupt)
                                     └─ competitor started → SCROLLING_TO_TOP_FOR_COMPETITOR (existing)
```

### Interrupt behavior

Any transition out of `BROWSE_SCROLLING` or `BROWSE_PAUSED_AT_BOTTOM` must:
1. Cancel the rAF loop (via ref)
2. Remove `data-browsing` attribute from container
3. Transition to the appropriate next phase

## Implementation Details

### Continuous scroll mechanism

```typescript
const BROWSE_SPEED_PX_PER_SEC = 20

// requestAnimationFrame loop (inside useEffect for BROWSE_SCROLLING phase)
const rafRef = useRef<number | null>(null)
let lastTime = performance.now()

function step(now: number) {
  const dt = now - lastTime
  lastTime = now
  container.scrollTop += (BROWSE_SPEED_PX_PER_SEC * dt) / 1000

  if (isAtBottom()) {
    setPhase('BROWSE_PAUSED_AT_BOTTOM')
    return
  }
  rafRef.current = requestAnimationFrame(step)
}

rafRef.current = requestAnimationFrame(step)
```

### CSS scroll-behavior toggle

The container has `scroll-behavior: smooth` for page-based scrolling. This conflicts with rAF pixel updates (causes jitter). Solution: use a `data-browsing` attribute on the container.

```css
/* ResultsList.module.css */
.container[data-browsing="true"] {
  scroll-behavior: auto;
}
```

The `useAutoScroll` hook sets/removes `data-browsing` attribute on containerRef when entering/leaving BROWSE_SCROLLING phase.

### Top tracking

```typescript
const lastTopShownAtRef = useRef<number>(Date.now())
const BROWSE_TOP_THRESHOLD = 3 * 60 * 1000 // 3 minutes
```

Updated when:
- `scrollTop` reaches 0 during `RETURNING_TO_TOP`
- Reset on `reset()` call
- After `SCROLLING_TO_TOP_FOR_COMPETITOR` completes
- On initial mount

Decision point (after highlight expires):
```typescript
const timeSinceTopShown = Date.now() - lastTopShownAtRef.current
if (timeSinceTopShown > BROWSE_TOP_THRESHOLD || !browseAfterHighlight) {
  // Existing behavior: scroll to top
} else {
  setPhase('BROWSE_SCROLLING')
}
```

### URL parameter

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `browseAfterHighlight` | boolean | `false` | Enable browse scroll after highlight on ledwall |

Parsed in `useLayout.ts`, added to `LayoutConfig` interface, read in `useAutoScroll`.

### ConfigPush support

`browseAfterHighlight` added to `ConfigPushData` type in `src/types/c123server.ts`. Handled in `C123ServerProvider.ts` same as `scrollToFinished`.

### Constants

All new constants in `useAutoScroll.ts` alongside existing `SCROLL_CONFIG`:

```typescript
const BROWSE_SPEED_PX_PER_SEC = 20
const BROWSE_TOP_THRESHOLD = 3 * 60 * 1000 // 3 minutes
const BROWSE_BOTTOM_PAUSE = 1500 // 1.5s, matches ledwall.bottomPauseTime
```

## Files to Change

| File | Change |
|------|--------|
| `src/hooks/useAutoScroll.ts` | New phases, rAF loop, lastTopShownAtRef, decision logic after highlight |
| `src/components/ResultsList/ResultsList.module.css` | `data-browsing` override for scroll-behavior |
| `src/hooks/useLayout.ts` | Parse `browseAfterHighlight` URL param, add to LayoutConfig |
| `src/types/c123server.ts` | Add `browseAfterHighlight` to ConfigPushData |
| `src/providers/C123ServerProvider.ts` | Handle `browseAfterHighlight` in ConfigPush |
| `docs/url-parameters.md` | Document new parameter |
| `docs/configuration.md` | Document ConfigPush field |

## Testing

- Unit tests for the decision logic (threshold check)
- Integration test with replay data: verify browse scroll activates after highlight on ledwall
- Verify interrupt: new finish during browse stops rAF and transitions to HIGHLIGHT_VIEW
- Verify threshold: after 3+ minutes without showing top, browse is skipped
- Verify vertical layout ignores the feature entirely
- Visual test: confirm no jitter from scroll-behavior toggle

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| 20px/s scroll speed | ~0.36 rows/s on ledwall (56px rows) — readable, not too slow |
| Hardcoded speed | YAGNI — easily made configurable later via URL param if needed |
| Time-based threshold (not counter) | Clock time is what matters to spectators; counter doesn't account for varying race pace |
| `data-browsing` attribute (not inline style) | Cleaner than toggling inline `scrollBehavior`, CSS handles specificity |
| BROWSE_PAUSED_AT_BOTTOM phase | Consistent with existing page-scroll UX, gives spectators a moment at bottom |
| Opt-in (default false) | Safe rollout, no surprise behavior changes for existing deployments |
