import { describe, expect, it } from 'vitest'
import { createFakeClock } from './fakeClock'

// TEST-ARCHITECTURE §5: a test Clock is a virtual clock a test advances explicitly; frames advance
// the same explicit way as timers (CLIENT-OBLIGATIONS L122, L123).

describe('fake clock: timers', () => {
  it('starts at the stated time and moves only when advanced', () => {
    const clock = createFakeClock(1_000)
    expect(clock.now()).toBe(1_000)
    clock.advance(250)
    expect(clock.now()).toBe(1_250)
  })

  it('fires timers in deadline order, at their deadline and not before', () => {
    const clock = createFakeClock(0)
    const fired: [string, number][] = []
    clock.setTimeout(() => fired.push(['a', clock.now()]), 100)
    clock.setTimeout(() => fired.push(['b', clock.now()]), 50)
    clock.setTimeout(() => fired.push(['c', clock.now()]), 100)
    clock.advance(49)
    expect(fired).toEqual([])
    clock.advance(1)
    expect(fired).toEqual([['b', 50]])
    clock.advance(49)
    expect(fired).toEqual([['b', 50]])
    clock.advance(1)
    expect(fired).toEqual([['b', 50], ['a', 100], ['c', 100]])
  })

  it('fires a timer scheduled by another timer within the same advance, at its own deadline', () => {
    const clock = createFakeClock(0)
    const fired: number[] = []
    clock.setTimeout(() => {
      fired.push(clock.now())
      clock.setTimeout(() => fired.push(clock.now()), 30)
    }, 20)
    clock.advance(100)
    expect(fired).toEqual([20, 50])
    expect(clock.now()).toBe(100)
  })

  it('does not fire a cleared timer', () => {
    const clock = createFakeClock(0)
    let fired = false
    const handle = clock.setTimeout(() => (fired = true), 10)
    clock.clearTimeout(handle)
    clock.advance(20)
    expect(fired).toBe(false)
  })

  it('refuses to go back in time', () => {
    const clock = createFakeClock(0)
    expect(() => clock.advance(-1)).toThrow()
  })
})

describe('fake clock: frames', () => {
  it('advances frames only when asked, not with elapsed time', () => {
    const clock = createFakeClock(500)
    const frames: number[] = []
    clock.requestFrame((t) => frames.push(t))
    clock.advance(1_000)
    expect(frames).toEqual([])
    clock.frame()
    expect(frames).toEqual([1_500])
    clock.frame()
    expect(frames).toEqual([1_500])
  })

  it('runs a frame requested inside a frame on the next frame', () => {
    const clock = createFakeClock(0)
    const frames: string[] = []
    clock.requestFrame(() => {
      frames.push('first')
      clock.requestFrame(() => frames.push('second'))
    })
    clock.frame()
    expect(frames).toEqual(['first'])
    clock.frame()
    expect(frames).toEqual(['first', 'second'])
  })

  it('does not run a cancelled frame', () => {
    const clock = createFakeClock(0)
    let ran = false
    const handle = clock.requestFrame(() => (ran = true))
    clock.cancelFrame(handle)
    clock.frame()
    expect(ran).toBe(false)
  })
})
