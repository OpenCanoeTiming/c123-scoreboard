import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook as renderHookBare, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { ClockProvider } from '@/clock/clockContext'
import { createFakeClock, type FakeClock } from '@/clock/fakeClock'
import { useFitScale } from '../useFitScale'

// Tier 3: the observer's debounce runs on the injected Clock (issue #131).
let clock: FakeClock
let fire: () => void
let disconnected: boolean

class FakeResizeObserver {
  constructor(cb: () => void) {
    fire = cb
  }
  observe() {}
  unobserve() {}
  disconnect() {
    disconnected = true
  }
}

function makeElement(height: number): { el: HTMLElement; setHeight: (h: number) => void } {
  const el = document.createElement('div')
  let h = height
  Object.defineProperty(el, 'offsetHeight', { get: () => h, configurable: true })
  return { el, setHeight: (v) => (h = v) }
}

function render(el: HTMLElement, viewportHeight: number, enabled = true) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(ClockProvider, { clock, children })
  return renderHookBare(() => useFitScale({ current: el }, enabled, viewportHeight), { wrapper })
}

describe('useFitScale', () => {
  beforeEach(() => {
    clock = createFakeClock(1_700_000_000_000)
    disconnected = false
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('scales the measured content height to the viewport height', () => {
    const { el } = makeElement(600)
    const { result } = render(el, 300)
    expect(result.current).toBeCloseTo(0.5)
  })

  it('stays 1 when disabled', () => {
    const { el } = makeElement(600)
    const { result } = render(el, 300, false)
    expect(result.current).toBe(1)
  })

  it('re-measures 100 ms after the last resize notification, on the Clock', () => {
    const { el, setHeight } = makeElement(600)
    const { result } = render(el, 300)

    setHeight(1000)
    act(() => fire())
    act(() => clock.advance(60))
    act(() => fire()) // restarts the debounce
    act(() => clock.advance(60))
    expect(result.current).toBeCloseTo(0.5) // 120 ms after the first, 60 after the last

    act(() => clock.advance(40))
    expect(result.current).toBeCloseTo(0.3)
  })

  it('disconnects the observer and drops a pending measurement on unmount', () => {
    const { el, setHeight } = makeElement(600)
    const { unmount } = render(el, 300)
    setHeight(1000)
    act(() => fire())
    unmount()
    expect(disconnected).toBe(true)
    expect(() => clock.advance(200)).not.toThrow()
  })
})
