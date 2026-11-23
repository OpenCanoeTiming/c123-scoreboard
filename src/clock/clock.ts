// The injected clock every display-lifetime rule reads time through (TEST-ARCHITECTURE §5).
// Only src/clock may call the real timer globals; the lint rule enforces it elsewhere.

export type TimerHandle = number

export interface Clock {
  /** Epoch milliseconds. */
  now(): number
  setTimeout(fn: () => void, ms: number): TimerHandle
  clearTimeout(handle: TimerHandle): void
  /** `t` is on the same timeline as `now()`. */
  requestFrame(fn: (t: number) => void): TimerHandle
  cancelFrame(handle: TimerHandle): void
}
