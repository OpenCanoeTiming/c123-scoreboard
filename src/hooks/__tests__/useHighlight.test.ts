import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { ScoreboardProvider } from '@/context/ScoreboardContext'
import { HIGHLIGHT_DURATION } from '@/context/constants'
import { useHighlight } from '../useHighlight'
import type { DataProvider, Unsubscribe } from '@/providers/types'
import type { ConnectionStatus } from '@/types'

// Mock DataProvider for testing
function createMockProvider(overrides: Partial<DataProvider> = {}): DataProvider {
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

describe('useHighlight', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns inactive state when no highlight is set', () => {
    const mockProvider = createMockProvider()

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ScoreboardProvider, { provider: mockProvider, children })

    const { result } = renderHook(() => useHighlight(), { wrapper })

    expect(result.current.highlightBib).toBeNull()
    expect(result.current.isActive).toBe(false)
    expect(result.current.timeRemaining).toBe(0)
    expect(result.current.progress).toBe(0)
  })

  it('activates highlight when bib and timestamp are set', () => {
    let resultsCallback: ((data: unknown) => void) | null = null

    const mockProvider = createMockProvider({
      onResults: vi.fn((callback: (data: unknown) => void): Unsubscribe => {
        resultsCallback = callback
        return () => { resultsCallback = null }
      }),
    })

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ScoreboardProvider, { provider: mockProvider, children })

    const { result } = renderHook(() => useHighlight(), { wrapper })

    // Simulate receiving results with highlight
    act(() => {
      if (resultsCallback) {
        resultsCallback({
          results: [],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '42',
        })
      }
    })

    expect(result.current.highlightBib).toBe('42')
    expect(result.current.isActive).toBe(true)
    expect(result.current.timeRemaining).toBeGreaterThan(0)
    expect(result.current.timeRemaining).toBeLessThanOrEqual(HIGHLIGHT_DURATION)
  })

  it('expires highlight after HIGHLIGHT_DURATION', async () => {
    let resultsCallback: ((data: unknown) => void) | null = null

    const mockProvider = createMockProvider({
      onResults: vi.fn((callback: (data: unknown) => void): Unsubscribe => {
        resultsCallback = callback
        return () => { resultsCallback = null }
      }),
    })

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ScoreboardProvider, { provider: mockProvider, children })

    const { result } = renderHook(() => useHighlight(), { wrapper })

    // Simulate receiving results with highlight
    act(() => {
      if (resultsCallback) {
        resultsCallback({
          results: [],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '42',
        })
      }
    })

    expect(result.current.isActive).toBe(true)

    // Advance time past the highlight duration
    act(() => {
      vi.advanceTimersByTime(HIGHLIGHT_DURATION + 100)
    })

    expect(result.current.isActive).toBe(false)
    expect(result.current.highlightBib).toBeNull()
    expect(result.current.timeRemaining).toBe(0)
  })

  it('calculates progress correctly over time', () => {
    let resultsCallback: ((data: unknown) => void) | null = null

    const mockProvider = createMockProvider({
      onResults: vi.fn((callback: (data: unknown) => void): Unsubscribe => {
        resultsCallback = callback
        return () => { resultsCallback = null }
      }),
    })

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ScoreboardProvider, { provider: mockProvider, children })

    const { result } = renderHook(() => useHighlight(), { wrapper })

    // Simulate receiving results with highlight
    act(() => {
      if (resultsCallback) {
        resultsCallback({
          results: [],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '42',
        })
      }
    })

    // Initial progress should be close to 0
    expect(result.current.progress).toBeCloseTo(0, 1)

    // Advance to 50% of duration
    act(() => {
      vi.advanceTimersByTime(HIGHLIGHT_DURATION / 2)
    })

    expect(result.current.progress).toBeCloseTo(0.5, 1)

    // Advance to 100%
    act(() => {
      vi.advanceTimersByTime(HIGHLIGHT_DURATION / 2 + 100)
    })

    expect(result.current.progress).toBeGreaterThanOrEqual(1)
  })

  it('activates highlight for competitor even when on course (server knows best)', () => {
    let resultsCallback: ((data: unknown) => void) | null = null
    let onCourseCallback: ((data: unknown) => void) | null = null

    const mockProvider = createMockProvider({
      onResults: vi.fn((callback: (data: unknown) => void): Unsubscribe => {
        resultsCallback = callback
        return () => { resultsCallback = null }
      }),
      onOnCourse: vi.fn((callback: (data: unknown) => void): Unsubscribe => {
        onCourseCallback = callback
        return () => { onCourseCallback = null }
      }),
    })

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ScoreboardProvider, { provider: mockProvider, children })

    const { result } = renderHook(() => useHighlight(), { wrapper })

    // First, set a competitor on course
    act(() => {
      if (onCourseCallback) {
        onCourseCallback({
          current: { bib: '42', name: 'Test Athlete' },
          onCourse: [{ bib: '42', name: 'Test Athlete' }],
        })
      }
    })

    // Then highlight the same competitor (server says they just finished)
    act(() => {
      if (resultsCallback) {
        resultsCallback({
          results: [],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '42',
        })
      }
    })

    // Highlight SHOULD be active - trust server's HighlightBib value
    expect(result.current.isActive).toBe(true)
    expect(result.current.highlightBib).toBe('42')
  })

  it('activates highlight for competitor NOT on course', () => {
    let resultsCallback: ((data: unknown) => void) | null = null
    let onCourseCallback: ((data: unknown) => void) | null = null

    const mockProvider = createMockProvider({
      onResults: vi.fn((callback: (data: unknown) => void): Unsubscribe => {
        resultsCallback = callback
        return () => { resultsCallback = null }
      }),
      onOnCourse: vi.fn((callback: (data: unknown) => void): Unsubscribe => {
        onCourseCallback = callback
        return () => { onCourseCallback = null }
      }),
    })

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ScoreboardProvider, { provider: mockProvider, children })

    const { result } = renderHook(() => useHighlight(), { wrapper })

    // Set a different competitor on course
    act(() => {
      if (onCourseCallback) {
        onCourseCallback({
          current: { bib: '99', name: 'Other Athlete' },
          onCourse: [{ bib: '99', name: 'Other Athlete' }],
        })
      }
    })

    // Highlight a competitor who is NOT on course
    act(() => {
      if (resultsCallback) {
        resultsCallback({
          results: [],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '42',
        })
      }
    })

    // Highlight SHOULD be active
    expect(result.current.isActive).toBe(true)
    expect(result.current.highlightBib).toBe('42')
  })
})
