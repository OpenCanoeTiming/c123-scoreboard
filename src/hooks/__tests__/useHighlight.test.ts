import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { ScoreboardProvider } from '@/context/ScoreboardContext'
import { HIGHLIGHT_DURATION } from '@/context/constants'
import { useHighlight } from '../useHighlight'
import type { DataProvider, Unsubscribe, OnCourseData } from '@/providers/types'
import type { ConnectionStatus, OnCourseCompetitor } from '@/types'

// Helper to create a complete OnCourseCompetitor object
function createCompetitor(overrides: Partial<OnCourseCompetitor> = {}): OnCourseCompetitor {
  return {
    bib: '42',
    name: 'Test Athlete',
    club: 'Test Club',
    nat: '',
    raceId: 'TEST_RACE',
    time: '',
    total: '',
    pen: 0,
    gates: '',
    dtStart: null,
    dtFinish: null,
    ttbDiff: '',
    ttbName: '',
    rank: 0,
    ...overrides,
  }
}

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

  it('activates highlight when dtFinish transitions from null to timestamp', () => {
    let onCourseCallback: ((data: OnCourseData) => void) | null = null

    const mockProvider = createMockProvider({
      onOnCourse: vi.fn((callback: (data: OnCourseData) => void): Unsubscribe => {
        onCourseCallback = callback
        return () => { onCourseCallback = null }
      }),
    })

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ScoreboardProvider, { provider: mockProvider, children })

    const { result } = renderHook(() => useHighlight(), { wrapper })

    // First, competitor on course without dtFinish (running)
    act(() => {
      if (onCourseCallback) {
        const competitor = createCompetitor({ bib: '42', dtStart: '2025-01-01T10:00:00Z', dtFinish: null })
        onCourseCallback({
          current: competitor,
          onCourse: [competitor],
          updateOnCourse: true,
        })
      }
    })

    expect(result.current.isActive).toBe(false)

    // Then, competitor finishes - dtFinish transitions to timestamp
    act(() => {
      if (onCourseCallback) {
        const competitor = createCompetitor({
          bib: '42',
          dtStart: '2025-01-01T10:00:00Z',
          dtFinish: '2025-01-01T10:01:00Z',
          time: '60.00',
        })
        onCourseCallback({
          current: competitor,
          onCourse: [competitor],
          updateOnCourse: true,
        })
      }
    })

    expect(result.current.highlightBib).toBe('42')
    expect(result.current.isActive).toBe(true)
    expect(result.current.timeRemaining).toBeGreaterThan(0)
    expect(result.current.timeRemaining).toBeLessThanOrEqual(HIGHLIGHT_DURATION)
  })

  it('expires highlight after HIGHLIGHT_DURATION', async () => {
    let onCourseCallback: ((data: OnCourseData) => void) | null = null

    const mockProvider = createMockProvider({
      onOnCourse: vi.fn((callback: (data: OnCourseData) => void): Unsubscribe => {
        onCourseCallback = callback
        return () => { onCourseCallback = null }
      }),
    })

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ScoreboardProvider, { provider: mockProvider, children })

    const { result } = renderHook(() => useHighlight(), { wrapper })

    // Set up competitor on course
    act(() => {
      if (onCourseCallback) {
        const competitor = createCompetitor({ bib: '42', dtStart: '2025-01-01T10:00:00Z', dtFinish: null })
        onCourseCallback({
          current: competitor,
          onCourse: [competitor],
          updateOnCourse: true,
        })
      }
    })

    // Trigger finish
    act(() => {
      if (onCourseCallback) {
        const competitor = createCompetitor({
          bib: '42',
          dtStart: '2025-01-01T10:00:00Z',
          dtFinish: '2025-01-01T10:01:00Z',
        })
        onCourseCallback({
          current: competitor,
          onCourse: [competitor],
          updateOnCourse: true,
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
    let onCourseCallback: ((data: OnCourseData) => void) | null = null

    const mockProvider = createMockProvider({
      onOnCourse: vi.fn((callback: (data: OnCourseData) => void): Unsubscribe => {
        onCourseCallback = callback
        return () => { onCourseCallback = null }
      }),
    })

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ScoreboardProvider, { provider: mockProvider, children })

    const { result } = renderHook(() => useHighlight(), { wrapper })

    // Set up and trigger finish
    act(() => {
      if (onCourseCallback) {
        const competitor = createCompetitor({ bib: '42', dtStart: '2025-01-01T10:00:00Z', dtFinish: null })
        onCourseCallback({
          current: competitor,
          onCourse: [competitor],
          updateOnCourse: true,
        })
      }
    })

    act(() => {
      if (onCourseCallback) {
        const competitor = createCompetitor({
          bib: '42',
          dtStart: '2025-01-01T10:00:00Z',
          dtFinish: '2025-01-01T10:01:00Z',
        })
        onCourseCallback({
          current: competitor,
          onCourse: [competitor],
          updateOnCourse: true,
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

  it('does not activate highlight for new competitor with dtFinish already set (reconnect scenario)', () => {
    let onCourseCallback: ((data: OnCourseData) => void) | null = null

    const mockProvider = createMockProvider({
      onOnCourse: vi.fn((callback: (data: OnCourseData) => void): Unsubscribe => {
        onCourseCallback = callback
        return () => { onCourseCallback = null }
      }),
    })

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ScoreboardProvider, { provider: mockProvider, children })

    const { result } = renderHook(() => useHighlight(), { wrapper })

    // Competitor appears with dtFinish already set (e.g., after reconnect)
    // This should NOT trigger highlight since we didn't see the transition
    act(() => {
      if (onCourseCallback) {
        const competitor = createCompetitor({
          bib: '42',
          dtStart: '2025-01-01T10:00:00Z',
          dtFinish: '2025-01-01T10:01:00Z',
        })
        onCourseCallback({
          current: competitor,
          onCourse: [competitor],
          updateOnCourse: true,
        })
      }
    })

    // Highlight should NOT be active - we didn't see the transition
    expect(result.current.isActive).toBe(false)
    expect(result.current.highlightBib).toBeNull()
  })

  it('activates highlight when competitor finishes while another is on course', () => {
    let onCourseCallback: ((data: OnCourseData) => void) | null = null

    const mockProvider = createMockProvider({
      onOnCourse: vi.fn((callback: (data: OnCourseData) => void): Unsubscribe => {
        onCourseCallback = callback
        return () => { onCourseCallback = null }
      }),
    })

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ScoreboardProvider, { provider: mockProvider, children })

    const { result } = renderHook(() => useHighlight(), { wrapper })

    const competitor42 = createCompetitor({ bib: '42', dtStart: '2025-01-01T10:00:00Z', dtFinish: null })
    const competitor99 = createCompetitor({ bib: '99', name: 'Other Athlete', dtStart: '2025-01-01T10:01:00Z', dtFinish: null })

    // Two competitors on course
    act(() => {
      if (onCourseCallback) {
        onCourseCallback({
          current: competitor42,
          onCourse: [competitor42, competitor99],
          updateOnCourse: true,
        })
      }
    })

    // Competitor 42 finishes while 99 is still on course
    act(() => {
      if (onCourseCallback) {
        const finished42 = createCompetitor({
          bib: '42',
          dtStart: '2025-01-01T10:00:00Z',
          dtFinish: '2025-01-01T10:01:30Z',
          time: '90.00',
        })
        onCourseCallback({
          current: finished42,
          onCourse: [finished42, competitor99],
          updateOnCourse: true,
        })
      }
    })

    // Highlight SHOULD be active for the competitor who just finished
    expect(result.current.isActive).toBe(true)
    expect(result.current.highlightBib).toBe('42')
  })

  it('ignores highlightBib from results (CLI) - uses dtFinish detection instead', () => {
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

    // Send results with highlightBib - this should be ignored
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

    // Highlight should NOT be active - we only use dtFinish detection now
    expect(result.current.isActive).toBe(false)
    expect(result.current.highlightBib).toBeNull()
  })
})
