import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import {
  ScoreboardProvider,
  DEPARTING_TIMEOUT,
} from '@/context/ScoreboardContext'
import { useDeparting } from '../useDeparting'
import type { DataProvider, Unsubscribe } from '@/providers/types'
import type { ConnectionStatus } from '@/types'

// Mock DataProvider for testing
function createMockProvider(
  overrides: Partial<DataProvider> = {}
): DataProvider {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    connected: false,
    status: 'disconnected' as ConnectionStatus,
    onResults: vi.fn().mockReturnValue(() => {}),
    onOnCourse: vi.fn().mockReturnValue(() => {}),
    onConfig: vi.fn().mockReturnValue(() => {}),
    onVisibility: vi.fn().mockReturnValue(() => {}),
    onEventInfo: vi.fn().mockReturnValue(() => {}),
    onConnectionChange: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  }
}

describe('useDeparting', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns inactive state when no departing competitor', () => {
    const mockProvider = createMockProvider()

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ScoreboardProvider, { provider: mockProvider, children })

    const { result } = renderHook(() => useDeparting(), { wrapper })

    expect(result.current.departingCompetitor).toBeNull()
    expect(result.current.isActive).toBe(false)
    expect(result.current.timeRemaining).toBe(0)
    expect(result.current.progress).toBe(0)
  })

  it('activates departing when competitor changes', () => {
    let onCourseCallback: ((data: unknown) => void) | null = null

    const mockProvider = createMockProvider({
      onOnCourse: vi.fn((callback: (data: unknown) => void): Unsubscribe => {
        onCourseCallback = callback
        return () => {
          onCourseCallback = null
        }
      }),
    })

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ScoreboardProvider, { provider: mockProvider, children })

    const { result } = renderHook(() => useDeparting(), { wrapper })

    // Set initial competitor
    act(() => {
      if (onCourseCallback) {
        onCourseCallback({
          current: { bib: '42', name: 'Test Athlete', club: 'Test Club' },
          onCourse: [{ bib: '42', name: 'Test Athlete', club: 'Test Club' }],
        })
      }
    })

    // Initially no departing
    expect(result.current.isActive).toBe(false)

    // Change to new competitor (previous becomes departing)
    act(() => {
      if (onCourseCallback) {
        onCourseCallback({
          current: { bib: '99', name: 'New Athlete', club: 'Other Club' },
          onCourse: [{ bib: '99', name: 'New Athlete', club: 'Other Club' }],
        })
      }
    })

    expect(result.current.isActive).toBe(true)
    expect(result.current.departingCompetitor).not.toBeNull()
    expect(result.current.departingCompetitor?.bib).toBe('42')
    expect(result.current.timeRemaining).toBeGreaterThan(0)
    expect(result.current.timeRemaining).toBeLessThanOrEqual(DEPARTING_TIMEOUT)
  })

  it('expires departing after DEPARTING_TIMEOUT', () => {
    let onCourseCallback: ((data: unknown) => void) | null = null

    const mockProvider = createMockProvider({
      onOnCourse: vi.fn((callback: (data: unknown) => void): Unsubscribe => {
        onCourseCallback = callback
        return () => {
          onCourseCallback = null
        }
      }),
    })

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ScoreboardProvider, { provider: mockProvider, children })

    const { result } = renderHook(() => useDeparting(), { wrapper })

    // Set initial competitor
    act(() => {
      if (onCourseCallback) {
        onCourseCallback({
          current: { bib: '42', name: 'Test Athlete', club: 'Test Club' },
          onCourse: [{ bib: '42', name: 'Test Athlete', club: 'Test Club' }],
        })
      }
    })

    // Change to new competitor
    act(() => {
      if (onCourseCallback) {
        onCourseCallback({
          current: { bib: '99', name: 'New Athlete', club: 'Other Club' },
          onCourse: [{ bib: '99', name: 'New Athlete', club: 'Other Club' }],
        })
      }
    })

    expect(result.current.isActive).toBe(true)

    // Advance time past the departing timeout
    act(() => {
      vi.advanceTimersByTime(DEPARTING_TIMEOUT + 100)
    })

    expect(result.current.isActive).toBe(false)
    expect(result.current.departingCompetitor).toBeNull()
    expect(result.current.timeRemaining).toBe(0)
  })

  it('clears departing when highlight arrives for that competitor', () => {
    let onCourseCallback: ((data: unknown) => void) | null = null
    let resultsCallback: ((data: unknown) => void) | null = null

    const mockProvider = createMockProvider({
      onOnCourse: vi.fn((callback: (data: unknown) => void): Unsubscribe => {
        onCourseCallback = callback
        return () => {
          onCourseCallback = null
        }
      }),
      onResults: vi.fn((callback: (data: unknown) => void): Unsubscribe => {
        resultsCallback = callback
        return () => {
          resultsCallback = null
        }
      }),
    })

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ScoreboardProvider, { provider: mockProvider, children })

    const { result } = renderHook(() => useDeparting(), { wrapper })

    // Set initial competitor
    act(() => {
      if (onCourseCallback) {
        onCourseCallback({
          current: { bib: '42', name: 'Test Athlete', club: 'Test Club' },
          onCourse: [{ bib: '42', name: 'Test Athlete', club: 'Test Club' }],
        })
      }
    })

    // Competitor leaves (becomes departing)
    act(() => {
      if (onCourseCallback) {
        onCourseCallback({
          current: null,
          onCourse: [],
        })
      }
    })

    expect(result.current.isActive).toBe(true)
    expect(result.current.departingCompetitor?.bib).toBe('42')

    // Highlight arrives for the departing competitor
    act(() => {
      if (resultsCallback) {
        resultsCallback({
          results: [{ bib: '42', rank: 1, name: 'Test Athlete', time: '100.50' }],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '42',
        })
      }
    })

    // Departing should be cleared
    expect(result.current.isActive).toBe(false)
    expect(result.current.departingCompetitor).toBeNull()
  })

  it('calculates progress correctly over time', () => {
    let onCourseCallback: ((data: unknown) => void) | null = null

    const mockProvider = createMockProvider({
      onOnCourse: vi.fn((callback: (data: unknown) => void): Unsubscribe => {
        onCourseCallback = callback
        return () => {
          onCourseCallback = null
        }
      }),
    })

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ScoreboardProvider, { provider: mockProvider, children })

    const { result } = renderHook(() => useDeparting(), { wrapper })

    // Set initial competitor
    act(() => {
      if (onCourseCallback) {
        onCourseCallback({
          current: { bib: '42', name: 'Test Athlete', club: 'Test Club' },
          onCourse: [{ bib: '42', name: 'Test Athlete', club: 'Test Club' }],
        })
      }
    })

    // Change to new competitor
    act(() => {
      if (onCourseCallback) {
        onCourseCallback({
          current: { bib: '99', name: 'New Athlete', club: 'Other Club' },
          onCourse: [{ bib: '99', name: 'New Athlete', club: 'Other Club' }],
        })
      }
    })

    // Initial progress should be close to 0
    expect(result.current.progress).toBeCloseTo(0, 1)

    // Advance to 50% of duration
    act(() => {
      vi.advanceTimersByTime(DEPARTING_TIMEOUT / 2)
    })

    expect(result.current.progress).toBeCloseTo(0.5, 1)

    // After timeout, departing is cleared, so progress becomes 0 and isActive becomes false
    act(() => {
      vi.advanceTimersByTime(DEPARTING_TIMEOUT / 2 + 100)
    })

    // After timeout, departing is expired/cleared
    expect(result.current.isActive).toBe(false)
    expect(result.current.departingCompetitor).toBeNull()
  })

  it('activates departing when competitor becomes null', () => {
    let onCourseCallback: ((data: unknown) => void) | null = null

    const mockProvider = createMockProvider({
      onOnCourse: vi.fn((callback: (data: unknown) => void): Unsubscribe => {
        onCourseCallback = callback
        return () => {
          onCourseCallback = null
        }
      }),
    })

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ScoreboardProvider, { provider: mockProvider, children })

    const { result } = renderHook(() => useDeparting(), { wrapper })

    // Set initial competitor
    act(() => {
      if (onCourseCallback) {
        onCourseCallback({
          current: { bib: '42', name: 'Test Athlete', club: 'Test Club' },
          onCourse: [{ bib: '42', name: 'Test Athlete', club: 'Test Club' }],
        })
      }
    })

    // Competitor leaves (current becomes null)
    act(() => {
      if (onCourseCallback) {
        onCourseCallback({
          current: null,
          onCourse: [],
        })
      }
    })

    expect(result.current.isActive).toBe(true)
    expect(result.current.departingCompetitor?.bib).toBe('42')
  })
})
