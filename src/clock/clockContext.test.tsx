import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ClockProvider, useClock } from './clockContext'
import { createFakeClock } from './fakeClock'
import { productionClock } from './productionClock'

// The presentation layer takes its Clock from context (CLIENT-OBLIGATIONS L120, #163).

describe('ClockContext', () => {
  it('hands the provider\'s Clock to the hooks below it', () => {
    const clock = createFakeClock(1_000)
    const wrapper = ({ children }: { children: ReactNode }) => <ClockProvider clock={clock}>{children}</ClockProvider>

    const { result } = renderHook(() => useClock(), { wrapper })

    expect(result.current).toBe(clock)
  })

  it('is the production Clock when nothing provides one (components rendered bare in tests)', () => {
    const { result } = renderHook(() => useClock())

    expect(result.current).toBe(productionClock)
  })
})
