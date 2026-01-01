import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { ScoreboardProvider, useScoreboard } from '../ScoreboardContext'
import { DEPARTING_TIMEOUT } from '../constants'
import type { DataProvider, Unsubscribe, ResultsData, OnCourseData, EventInfoData } from '@/providers/types'
import type { ConnectionStatus, VisibilityState, OnCourseCompetitor, Result } from '@/types'

/**
 * Factory to create a full OnCourseCompetitor for tests
 */
function createOnCourseCompetitor(overrides: Partial<OnCourseCompetitor> = {}): OnCourseCompetitor {
  return {
    bib: '42',
    name: 'Test Athlete',
    club: 'Test Club',
    nat: 'CZE',
    raceId: 'R1',
    time: '90.50',
    total: '92.50',
    pen: 2,
    gates: '0,0,2,0',
    dtStart: '2025-12-28T10:00:00',
    dtFinish: null,
    ttbDiff: '',
    ttbName: '',
    rank: 1,
    ...overrides,
  }
}

/**
 * Factory to create a full Result for tests
 */
function createResult(overrides: Partial<Result> = {}): Result {
  return {
    rank: 1,
    bib: '42',
    name: 'Test Athlete',
    familyName: 'Athlete',
    givenName: 'Test',
    club: 'Test Club',
    nat: 'CZE',
    total: '90.50',
    pen: 0,
    behind: '',
    ...overrides,
  }
}

// Helper to create a mock DataProvider
function createMockProvider(overrides: Partial<DataProvider> = {}): DataProvider & {
  triggerResults: (data: ResultsData) => void
  triggerOnCourse: (data: OnCourseData) => void
  triggerVisibility: (visibility: VisibilityState) => void
  triggerEventInfo: (info: EventInfoData) => void
  triggerConnectionChange: (status: ConnectionStatus) => void
} {
  let resultsCallback: ((data: ResultsData) => void) | null = null
  let onCourseCallback: ((data: OnCourseData) => void) | null = null
  let visibilityCallback: ((visibility: VisibilityState) => void) | null = null
  let eventInfoCallback: ((info: EventInfoData) => void) | null = null
  let connectionCallback: ((status: ConnectionStatus) => void) | null = null

  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    connected: false,
    status: 'disconnected' as ConnectionStatus,
    onResults: vi.fn((callback: (data: ResultsData) => void): Unsubscribe => {
      resultsCallback = callback
      return () => { resultsCallback = null }
    }),
    onOnCourse: vi.fn((callback: (data: OnCourseData) => void): Unsubscribe => {
      onCourseCallback = callback
      return () => { onCourseCallback = null }
    }),
    onConfig: vi.fn().mockReturnValue(() => {}),
    onVisibility: vi.fn((callback: (visibility: VisibilityState) => void): Unsubscribe => {
      visibilityCallback = callback
      return () => { visibilityCallback = null }
    }),
    onEventInfo: vi.fn((callback: (info: EventInfoData) => void): Unsubscribe => {
      eventInfoCallback = callback
      return () => { eventInfoCallback = null }
    }),
    onConnectionChange: vi.fn((callback: (status: ConnectionStatus) => void): Unsubscribe => {
      connectionCallback = callback
      return () => { connectionCallback = null }
    }),
    onError: vi.fn((): Unsubscribe => {
      return () => {}
    }),
    // Helper methods to trigger callbacks
    triggerResults: (data: ResultsData) => {
      if (resultsCallback) resultsCallback(data)
    },
    triggerOnCourse: (data: OnCourseData) => {
      if (onCourseCallback) onCourseCallback(data)
    },
    triggerVisibility: (visibility: VisibilityState) => {
      if (visibilityCallback) visibilityCallback(visibility)
    },
    triggerEventInfo: (info: EventInfoData) => {
      if (eventInfoCallback) eventInfoCallback(info)
    },
    triggerConnectionChange: (status: ConnectionStatus) => {
      if (connectionCallback) connectionCallback(status)
    },
    ...overrides,
  }
}

// Wrapper factory
function createWrapper(provider: DataProvider) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(ScoreboardProvider, { provider, children })
  }
}

describe('ScoreboardContext', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('state initialization', () => {
    it('initializes with default empty state', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      expect(result.current.results).toEqual([])
      expect(result.current.raceName).toBe('')
      expect(result.current.raceStatus).toBe('')
      expect(result.current.highlightBib).toBeNull()
      expect(result.current.highlightTimestamp).toBeNull()
      expect(result.current.currentCompetitor).toBeNull()
      expect(result.current.onCourse).toEqual([])
      expect(result.current.departingCompetitor).toBeNull()
      expect(result.current.departedAt).toBeNull()
      expect(result.current.initialDataReceived).toBe(false)
    })

    it('sets initialDataReceived to true after first top message', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      act(() => {
        mockProvider.triggerResults({
          results: [],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: null,
        })
      })

      expect(result.current.initialDataReceived).toBe(true)
    })

    it('calls connect on provider during mount', () => {
      const mockProvider = createMockProvider()
      createWrapper(mockProvider)

      renderHook(() => useScoreboard(), { wrapper: createWrapper(mockProvider) })

      expect(mockProvider.connect).toHaveBeenCalled()
    })
  })

  describe('results data handling', () => {
    it('updates results from top messages', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      act(() => {
        mockProvider.triggerResults({
          results: [createResult()],
          raceName: 'K1M Semifinal',
          raceStatus: 'In Progress',
          highlightBib: null,
        })
      })

      expect(result.current.results).toHaveLength(1)
      expect(result.current.results[0].bib).toBe('42')
      expect(result.current.raceName).toBe('K1M Semifinal')
      expect(result.current.raceStatus).toBe('In Progress')
    })
  })

  describe('highlight activation via dtFinish transition', () => {
    /**
     * Note: After the fix for premature highlights, the highlight is now triggered
     * in two steps:
     * 1. SET_ON_COURSE with dtFinish transition sets pendingHighlightBib + pendingHighlightTotal
     * 2. SET_RESULTS with matching total triggers the actual highlightBib
     */
    it('activates highlight when dtFinish transitions and results arrive with matching total', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      const competitor = createOnCourseCompetitor({ bib: '42', total: '92.50', dtStart: '2025-12-28T10:00:00', dtFinish: null })

      // Set competitor on course (running)
      act(() => {
        mockProvider.triggerOnCourse({
          current: competitor,
          onCourse: [competitor],
          updateOnCourse: true,
        })
      })

      expect(result.current.highlightBib).toBeNull()

      // Competitor finishes - dtFinish transitions to timestamp (sets pending highlight)
      act(() => {
        mockProvider.triggerOnCourse({
          current: { ...competitor, dtFinish: '2025-12-28T10:01:30', time: '90.50' },
          onCourse: [{ ...competitor, dtFinish: '2025-12-28T10:01:30', time: '90.50' }],
          updateOnCourse: true,
        })
      })

      // Still null - waiting for results
      expect(result.current.highlightBib).toBeNull()

      // Results arrive - triggers actual highlight
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '42', total: '92.50' })],
          raceName: 'Test',
          raceStatus: 'In Progress',
          highlightBib: null,
        })
      })

      // Highlight SHOULD be active now
      expect(result.current.highlightBib).toBe('42')
      expect(result.current.highlightTimestamp).not.toBeNull()
    })

    it('does not activate highlight when competitor appears with dtFinish already set', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      const competitor = createOnCourseCompetitor({
        bib: '42',
        dtFinish: '2025-12-28T10:01:30', // Already finished
      })

      // Competitor appears with dtFinish already set (e.g., reconnect)
      act(() => {
        mockProvider.triggerOnCourse({
          current: competitor,
          onCourse: [competitor],
          updateOnCourse: true,
        })
      })

      // Highlight should NOT be active - we didn't see the transition
      expect(result.current.highlightBib).toBeNull()
      expect(result.current.highlightTimestamp).toBeNull()
    })

    it('ignores highlightBib from results (CLI) - uses dtFinish detection instead', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      // Send results with highlightBib - this should be ignored
      act(() => {
        mockProvider.triggerResults({
          results: [],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '42',
        })
      })

      // Highlight should NOT be active - we only use dtFinish detection now
      expect(result.current.highlightBib).toBeNull()
      expect(result.current.highlightTimestamp).toBeNull()
    })

    it('activates highlight when competitor finishes while another is on course', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      const competitor42 = createOnCourseCompetitor({ bib: '42', total: '92.50', dtStart: '2025-12-28T10:00:00', dtFinish: null })
      const competitor99 = createOnCourseCompetitor({ bib: '99', total: '93.50', name: 'Other', dtStart: '2025-12-28T10:01:00', dtFinish: null })

      // Two competitors on course
      act(() => {
        mockProvider.triggerOnCourse({
          current: competitor42,
          onCourse: [competitor42, competitor99],
          updateOnCourse: true,
        })
      })

      // Competitor 42 finishes while 99 is still on course (sets pending highlight)
      act(() => {
        mockProvider.triggerOnCourse({
          current: { ...competitor42, dtFinish: '2025-12-28T10:01:30' },
          onCourse: [{ ...competitor42, dtFinish: '2025-12-28T10:01:30' }, competitor99],
          updateOnCourse: true,
        })
      })

      // Results arrive - triggers actual highlight
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '42', total: '92.50' })],
          raceName: 'Test',
          raceStatus: 'In Progress',
          highlightBib: null,
        })
      })

      // Highlight SHOULD be active for the competitor who just finished
      expect(result.current.highlightBib).toBe('42')
      expect(result.current.highlightTimestamp).not.toBeNull()
    })
  })

  describe('departing competitor', () => {
    it('sets departing competitor when current changes to different bib', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      const first = createOnCourseCompetitor({ bib: '42', name: 'First Athlete' })
      const second = createOnCourseCompetitor({ bib: '99', name: 'Second Athlete' })

      // Set first competitor
      act(() => {
        mockProvider.triggerOnCourse({
          current: first,
          onCourse: [first],
        })
      })

      expect(result.current.currentCompetitor?.bib).toBe('42')
      expect(result.current.departingCompetitor).toBeNull()

      // Change to different competitor
      act(() => {
        mockProvider.triggerOnCourse({
          current: second,
          onCourse: [second],
        })
      })

      // First athlete should be departing
      expect(result.current.currentCompetitor?.bib).toBe('99')
      expect(result.current.departingCompetitor?.bib).toBe('42')
      expect(result.current.departedAt).not.toBeNull()
    })

    it('sets departing competitor when current becomes null', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      const competitor = createOnCourseCompetitor({ bib: '42', name: 'Test Athlete' })

      // Set competitor
      act(() => {
        mockProvider.triggerOnCourse({
          current: competitor,
          onCourse: [competitor],
        })
      })

      // Clear current competitor
      act(() => {
        mockProvider.triggerOnCourse({
          current: null,
          onCourse: [],
        })
      })

      expect(result.current.currentCompetitor).toBeNull()
      expect(result.current.departingCompetitor?.bib).toBe('42')
    })

    it('clears departing competitor after DEPARTING_TIMEOUT', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      const competitor = createOnCourseCompetitor({ bib: '42', name: 'Test Athlete' })

      // Set competitor on course (must include in onCourse list)
      act(() => {
        mockProvider.triggerOnCourse({
          current: competitor,
          onCourse: [competitor],
        })
      })

      // Remove competitor from course
      act(() => {
        mockProvider.triggerOnCourse({
          current: null,
          onCourse: [],
        })
      })

      expect(result.current.departingCompetitor?.bib).toBe('42')

      // Advance past timeout
      act(() => {
        vi.advanceTimersByTime(DEPARTING_TIMEOUT + 100)
      })

      expect(result.current.departingCompetitor).toBeNull()
      expect(result.current.departedAt).toBeNull()
    })

    it('clears departing competitor when dtFinish highlight arrives for them', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      // Two competitors on course - 42 started earlier
      const competitor42 = createOnCourseCompetitor({ bib: '42', total: '92.50', name: 'Test Athlete', dtStart: '2025-12-28T10:00:00', dtFinish: null })
      const competitor99 = createOnCourseCompetitor({ bib: '99', total: '93.50', name: 'Other Athlete', dtStart: '2025-12-28T10:01:00', dtFinish: null })

      // Set both competitors on course
      act(() => {
        mockProvider.triggerOnCourse({
          current: competitor42,
          onCourse: [competitor42, competitor99],
          updateOnCourse: true,
        })
      })

      expect(result.current.currentCompetitor?.bib).toBe('42')

      // Competitor 42 finishes - dtFinish transitions to timestamp (sets pending highlight)
      act(() => {
        mockProvider.triggerOnCourse({
          current: competitor42,
          onCourse: [{ ...competitor42, dtFinish: '2025-12-28T10:01:30' }, competitor99],
          updateOnCourse: true,
        })
      })

      // Results arrive - triggers actual highlight and clears departing
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '42', total: '92.50' })],
          raceName: 'Test',
          raceStatus: 'In Progress',
          highlightBib: null,
        })
      })

      // Highlight should be active for 42
      expect(result.current.highlightBib).toBe('42')
      // Departing should be cleared (42 was the one that triggered highlight)
      expect(result.current.departingCompetitor).toBeNull()
      expect(result.current.departedAt).toBeNull()
    })
  })

  describe('reconnect state reset', () => {
    it('resets all data state when status changes to reconnecting', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      const competitor = createOnCourseCompetitor({ bib: '42', total: '92.50', dtStart: '2025-12-28T10:00:00', dtFinish: null })
      const competitor99 = createOnCourseCompetitor({ bib: '99', total: '93.50', name: 'Current', dtStart: '2025-12-28T10:01:00' })

      // Populate state with data - first set running, then finish
      act(() => {
        mockProvider.triggerOnCourse({
          current: competitor,
          onCourse: [competitor],
          updateOnCourse: true,
        })
      })

      // Competitor finishes (sets pending highlight)
      act(() => {
        mockProvider.triggerOnCourse({
          current: { ...competitor, dtFinish: '2025-12-28T10:01:30' },
          onCourse: [{ ...competitor, dtFinish: '2025-12-28T10:01:30' }],
          updateOnCourse: true,
        })
      })

      // Results arrive - triggers actual highlight
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '42', total: '92.50' })],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: null,
        })
      })

      // Set another competitor
      act(() => {
        mockProvider.triggerOnCourse({
          current: competitor99,
          onCourse: [competitor99],
          updateOnCourse: true,
        })
      })

      // Verify data is set
      expect(result.current.results).toHaveLength(1)
      expect(result.current.highlightBib).toBe('42')
      expect(result.current.currentCompetitor).not.toBeNull()
      expect(result.current.initialDataReceived).toBe(true)

      // Simulate reconnecting
      act(() => {
        mockProvider.triggerConnectionChange('reconnecting')
      })

      // All data should be reset
      expect(result.current.results).toEqual([])
      expect(result.current.raceName).toBe('')
      expect(result.current.raceStatus).toBe('')
      expect(result.current.highlightBib).toBeNull()
      expect(result.current.highlightTimestamp).toBeNull()
      expect(result.current.currentCompetitor).toBeNull()
      expect(result.current.onCourse).toEqual([])
      expect(result.current.departingCompetitor).toBeNull()
      expect(result.current.departedAt).toBeNull()
      expect(result.current.initialDataReceived).toBe(false)
    })

    it('clears error when status changes to connected', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      // Simulate connection status changes
      act(() => {
        mockProvider.triggerConnectionChange('connected')
      })

      expect(result.current.error).toBeNull()
    })

    it('updates status from provider changes', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      act(() => {
        mockProvider.triggerConnectionChange('connecting')
      })
      expect(result.current.status).toBe('connecting')

      act(() => {
        mockProvider.triggerConnectionChange('connected')
      })
      expect(result.current.status).toBe('connected')

      act(() => {
        mockProvider.triggerConnectionChange('reconnecting')
      })
      expect(result.current.status).toBe('reconnecting')
    })
  })

  describe('visibility handling', () => {
    it('updates visibility state from control messages', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      act(() => {
        mockProvider.triggerVisibility({
          displayCurrent: true,
          displayTop: false,
          displayTitle: true,
          displayTopBar: true,
          displayFooter: false,
          displayDayTime: true,
          displayOnCourse: true,
        })
      })

      // All core display flags are always forced to true regardless of CLI
      expect(result.current.visibility.displayCurrent).toBe(true)
      expect(result.current.visibility.displayTop).toBe(true)
      expect(result.current.visibility.displayFooter).toBe(true)
      expect(result.current.visibility.displayTopBar).toBe(true)
      expect(result.current.visibility.displayTitle).toBe(true)
      expect(result.current.visibility.displayOnCourse).toBe(true)
    })
  })

  describe('event info handling', () => {
    it('updates title from event info', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      act(() => {
        mockProvider.triggerEventInfo({
          title: 'World Cup 2025',
          infoText: '',
          dayTime: '',
        })
      })

      expect(result.current.title).toBe('World Cup 2025')
    })

    it('does not overwrite non-empty values with empty strings (partial updates)', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      // Set initial values
      act(() => {
        mockProvider.triggerEventInfo({
          title: 'World Cup 2025',
          infoText: 'Welcome!',
          dayTime: '10:30',
        })
      })

      expect(result.current.title).toBe('World Cup 2025')
      expect(result.current.infoText).toBe('Welcome!')
      expect(result.current.dayTime).toBe('10:30')

      // Partial update with empty strings
      act(() => {
        mockProvider.triggerEventInfo({
          title: '',
          infoText: 'New Info',
          dayTime: '',
        })
      })

      // title and dayTime should remain unchanged
      expect(result.current.title).toBe('World Cup 2025')
      expect(result.current.infoText).toBe('New Info')
      expect(result.current.dayTime).toBe('10:30')
    })
  })

  describe('rapid highlight changes via dtFinish (edge cases)', () => {
    /**
     * Note: After the fix for premature highlights, the highlight is now triggered
     * in two steps:
     * 1. SET_ON_COURSE with dtFinish transition sets pendingHighlightBib + pendingHighlightTotal
     * 2. SET_RESULTS with matching total triggers the actual highlightBib
     *
     * Tests must send both to trigger a highlight.
     */
    it('handles multiple competitors finishing rapidly', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      const comp1 = createOnCourseCompetitor({ bib: '1', total: '90.00', dtStart: '2025-12-28T10:00:00', dtFinish: null })
      const comp2 = createOnCourseCompetitor({ bib: '2', total: '91.00', dtStart: '2025-12-28T10:00:30', dtFinish: null })
      const comp3 = createOnCourseCompetitor({ bib: '3', total: '92.00', dtStart: '2025-12-28T10:01:00', dtFinish: null })

      // All three on course
      act(() => {
        mockProvider.triggerOnCourse({
          current: comp1,
          onCourse: [comp1, comp2, comp3],
          updateOnCourse: true,
        })
      })

      // Competitor 1 finishes (dtFinish transition sets pending highlight)
      act(() => {
        mockProvider.triggerOnCourse({
          current: comp1,
          onCourse: [{ ...comp1, dtFinish: '2025-12-28T10:01:30' }, comp2, comp3],
          updateOnCourse: true,
        })
      })

      // Results arrive with matching total - this triggers actual highlight
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '1', total: '90.00' })],
          raceName: 'Test',
          raceStatus: 'In Progress',
          highlightBib: null,
        })
      })

      expect(result.current.highlightBib).toBe('1')

      // 80ms later, competitor 2 finishes
      act(() => {
        vi.advanceTimersByTime(80)
      })

      act(() => {
        mockProvider.triggerOnCourse({
          current: comp2,
          onCourse: [{ ...comp1, dtFinish: '2025-12-28T10:01:30' }, { ...comp2, dtFinish: '2025-12-28T10:01:31' }, comp3],
          updateOnCourse: true,
        })
      })

      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '1', total: '90.00' }), createResult({ bib: '2', total: '91.00' })],
          raceName: 'Test',
          raceStatus: 'In Progress',
          highlightBib: null,
        })
      })

      expect(result.current.highlightBib).toBe('2')

      // 80ms later, competitor 3 finishes
      act(() => {
        vi.advanceTimersByTime(80)
      })

      act(() => {
        mockProvider.triggerOnCourse({
          current: comp3,
          onCourse: [
            { ...comp1, dtFinish: '2025-12-28T10:01:30' },
            { ...comp2, dtFinish: '2025-12-28T10:01:31' },
            { ...comp3, dtFinish: '2025-12-28T10:01:32' },
          ],
          updateOnCourse: true,
        })
      })

      act(() => {
        mockProvider.triggerResults({
          results: [
            createResult({ bib: '1', total: '90.00' }),
            createResult({ bib: '2', total: '91.00' }),
            createResult({ bib: '3', total: '92.00' }),
          ],
          raceName: 'Test',
          raceStatus: 'In Progress',
          highlightBib: null,
        })
      })

      expect(result.current.highlightBib).toBe('3')
    })

    it('replaces old highlight with new highlight when new competitor finishes', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      const comp42 = createOnCourseCompetitor({ bib: '42', total: '92.50', dtStart: '2025-12-28T10:00:00', dtFinish: null })
      const comp99 = createOnCourseCompetitor({ bib: '99', total: '93.50', dtStart: '2025-12-28T10:00:30', dtFinish: null })

      // Both on course
      act(() => {
        mockProvider.triggerOnCourse({
          current: comp42,
          onCourse: [comp42, comp99],
          updateOnCourse: true,
        })
      })

      // Competitor 42 finishes (dtFinish transition)
      act(() => {
        mockProvider.triggerOnCourse({
          current: comp42,
          onCourse: [{ ...comp42, dtFinish: '2025-12-28T10:01:30' }, comp99],
          updateOnCourse: true,
        })
      })

      // Results arrive - triggers actual highlight
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '42', total: '92.50' })],
          raceName: 'Test',
          raceStatus: 'In Progress',
          highlightBib: null,
        })
      })

      expect(result.current.highlightBib).toBe('42')
      const firstTimestamp = result.current.highlightTimestamp

      // 10ms later, competitor 99 finishes - should replace highlight
      act(() => {
        vi.advanceTimersByTime(10)
      })

      act(() => {
        mockProvider.triggerOnCourse({
          current: comp99,
          onCourse: [{ ...comp42, dtFinish: '2025-12-28T10:01:30' }, { ...comp99, dtFinish: '2025-12-28T10:01:31' }],
          updateOnCourse: true,
        })
      })

      act(() => {
        mockProvider.triggerResults({
          results: [
            createResult({ bib: '42', total: '92.50' }),
            createResult({ bib: '99', total: '93.50' }),
          ],
          raceName: 'Test',
          raceStatus: 'In Progress',
          highlightBib: null,
        })
      })

      expect(result.current.highlightBib).toBe('99')
      expect(result.current.highlightTimestamp).toBeGreaterThan(firstTimestamp!)
    })
  })

  describe('useScoreboard hook', () => {
    it('throws error when used outside provider', () => {
      // Suppress console.error for this test
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useScoreboard())
      }).toThrow('useScoreboard must be used within a ScoreboardProvider')

      spy.mockRestore()
    })
  })

  describe('cleanup', () => {
    it('unsubscribes from all callbacks on unmount', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { unmount } = renderHook(() => useScoreboard(), { wrapper })

      unmount()

      expect(mockProvider.disconnect).toHaveBeenCalled()
    })
  })
})
