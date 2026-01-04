import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { ScoreboardProvider } from '@/context/ScoreboardContext'
import { DEPARTING_TIMEOUT } from '@/context/constants'
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
    onError: vi.fn().mockReturnValue(() => {}),
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

  it('clears departing when dtFinish highlight arrives for that competitor', () => {
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

    const comp42 = { bib: '42', name: 'Test Athlete', club: 'Test Club', dtStart: '2025-01-01T10:00:00Z', dtFinish: null, raceId: 'R1' }
    const comp99 = { bib: '99', name: 'New Athlete', club: 'Other Club', dtStart: '2025-01-01T10:01:00Z', dtFinish: null, raceId: 'R1' }

    // Set initial competitors - 42 is current (started earlier)
    act(() => {
      if (onCourseCallback) {
        onCourseCallback({
          current: comp42,
          onCourse: [comp42, comp99],
          updateOnCourse: true,
        })
      }
    })

    // Competitor 42 finishes - dtFinish transitions, pending highlight is set
    // Competitor 99 becomes current (finished competitor filtered from current selection)
    // Note: comp42 with dtFinish stays in onCourse for display, but is not "current"
    const comp42Finished = { ...comp42, dtFinish: '2025-01-01T10:01:30Z', time: '90.00' }
    act(() => {
      if (onCourseCallback) {
        onCourseCallback({
          current: comp42Finished,
          onCourse: [comp42Finished, comp99],
          updateOnCourse: true,
        })
      }
    })

    // comp42 is now departing (switched from current to finished)
    // Departing is cleared when Results arrive and highlight triggers
    expect(result.current.departingCompetitor?.bib).toBe('42')

    // Simulate Results arriving - this triggers highlight and clears departing
    act(() => {
      if (resultsCallback) {
        resultsCallback({
          results: [{ bib: '42', name: 'Test', total: '90.00', rank: 1 }],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: null,
          raceId: 'R1',
        })
      }
    })

    // Now departing should be cleared (highlight triggered via results)
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
