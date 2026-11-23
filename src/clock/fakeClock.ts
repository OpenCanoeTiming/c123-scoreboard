import type { Clock, TimerHandle } from './clock'

/** A virtual Clock a test advances explicitly; frames run only when `frame()` is called (TEST-ARCHITECTURE §5). */
export interface FakeClock extends Clock {
  /** Moves time forward by `ms`, firing every due timer at its own deadline, in deadline order. */
  advance(ms: number): void
  /** Runs the frame callbacks requested before this call, with `now()`. */
  frame(): void
}

type Timer = { handle: TimerHandle; deadline: number; fn: () => void }

export function createFakeClock(startMs: number): FakeClock {
  let now = startMs
  let nextHandle = 1
  let timers: Timer[] = []
  let frames = new Map<TimerHandle, (t: number) => void>()

  return {
    now: () => now,
    setTimeout(fn, ms) {
      const handle = nextHandle++
      timers.push({ handle, deadline: now + Math.max(0, ms), fn })
      return handle
    },
    clearTimeout(handle) {
      timers = timers.filter((t) => t.handle !== handle)
    },
    requestFrame(fn) {
      const handle = nextHandle++
      frames.set(handle, fn)
      return handle
    },
    cancelFrame(handle) {
      frames.delete(handle)
    },
    advance(ms) {
      if (!(ms >= 0)) throw new Error(`FakeClock.advance: cannot move time by ${ms} ms`)
      const target = now + ms
      for (;;) {
        // earliest deadline first; equal deadlines in scheduling order (handles increase)
        let due: Timer | undefined
        for (const t of timers) {
          if (t.deadline <= target && (!due || t.deadline < due.deadline)) due = t
        }
        if (!due) break
        timers = timers.filter((t) => t !== due)
        now = due.deadline
        due.fn()
      }
      now = target
    },
    frame() {
      const pending = frames
      frames = new Map()
      for (const fn of pending.values()) fn(now)
    },
  }
}
