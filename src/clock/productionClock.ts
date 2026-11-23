import type { Clock } from './clock'

/** The thin production Clock: the real timers and `requestAnimationFrame` (TEST-ARCHITECTURE §5). */
export const productionClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (handle) => window.clearTimeout(handle),
  requestFrame: (fn) => window.requestAnimationFrame(() => fn(Date.now())),
  cancelFrame: (handle) => window.cancelAnimationFrame(handle),
}
