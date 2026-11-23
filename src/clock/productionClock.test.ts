import { afterEach, describe, expect, it, vi } from 'vitest'
import { productionClock } from './productionClock'

// TEST-ARCHITECTURE §5: the production Clock is a thin wrapper of the real globals, including
// requestAnimationFrame (CLIENT-OBLIGATIONS L120, L122).

afterEach(() => {
  vi.restoreAllMocks()
})

describe('production clock', () => {
  it('reads the wall clock', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_234)
    expect(productionClock.now()).toBe(1_234)
  })

  it('delegates timers to the real setTimeout and clearTimeout', () => {
    const set = vi.spyOn(window, 'setTimeout').mockReturnValue(7 as never)
    const clear = vi.spyOn(window, 'clearTimeout').mockImplementation(() => {})
    const fn = () => {}
    const handle = productionClock.setTimeout(fn, 40)
    expect(set).toHaveBeenCalledWith(fn, 40)
    productionClock.clearTimeout(handle)
    expect(clear).toHaveBeenCalledWith(7)
  })

  it('wraps the real requestAnimationFrame and cancelAnimationFrame', () => {
    let frame: FrameRequestCallback = () => {}
    const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frame = cb
      return 9
    })
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    vi.spyOn(Date, 'now').mockReturnValue(5_000)
    const seen: number[] = []
    const handle = productionClock.requestFrame((t) => seen.push(t))
    expect(request).toHaveBeenCalledTimes(1)
    frame(16.7)
    expect(seen).toEqual([5_000]) // the frame time is on the same timeline as now()
    productionClock.cancelFrame(handle)
    expect(cancel).toHaveBeenCalledWith(9)
  })
})
