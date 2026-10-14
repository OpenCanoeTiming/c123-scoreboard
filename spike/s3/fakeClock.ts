/**
 * HarnessClock over Vitest's global fake timers.
 *
 * TEST-ARCHITECTURE §5 asks for an injected Clock and says the fake Clock is not a
 * global fake-timer patch. Today's scoreboard calls Date.now(), setTimeout and
 * requestAnimationFrame directly, so a global patch is the only way to own its clock.
 * Vitest 4 fakes requestAnimationFrame and performance by default (toFake = every
 * timer global except nextTick and queueMicrotask); useTimestamp.ts and
 * useAutoScroll.ts rely on that. Even without it, jsdom's requestAnimationFrame
 * runs on the global setInterval, so frames still follow a faked setInterval.
 */

import { vi } from 'vitest'
import type { HarnessClock } from './FixtureReplayProvider'

// S3_REAL_RAF=1 leaves frames real: requestAnimationFrame, performance, and setInterval, on which
// jsdom's own requestAnimationFrame runs (vitest enables pretendToBeVisual)
const TIMERS_WITHOUT_FRAMES = ['setTimeout', 'clearTimeout', 'Date'] as const

export function installFakeClock(startEpochMs: number): HarnessClock {
  vi.useFakeTimers(
    process.env.S3_REAL_RAF ? { now: startEpochMs, toFake: [...TIMERS_WITHOUT_FRAMES] } : { now: startEpochMs }
  )
  return {
    now: () => Date.now(),
    advanceTo(epochMs: number) {
      const delta = epochMs - Date.now()
      if (delta < 0) {
        throw new Error(`clock cannot go back ${-delta} ms`)
      }
      vi.advanceTimersByTime(delta)
    },
  }
}

export function uninstallFakeClock(): void {
  vi.useRealTimers()
}
