import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { ScoreboardProvider, useScoreboard } from '../ScoreboardContext'
import { DEPARTING_TIMEOUT } from '../constants'
import type { DataProvider, Unsubscribe, ResultsData, OnCourseData, EventInfoData, ProviderError } from '@/providers/types'
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
    onError: vi.fn((_callback: (error: ProviderError) => void): Unsubscribe => {
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

  describe('highlight deduplication', () => {
    it('does NOT activate highlight when competitor is on course', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      const competitor42 = createOnCourseCompetitor({ bib: '42', name: 'Test Athlete' })

      // First, set competitor on course
      act(() => {
        mockProvider.triggerOnCourse({
          current: competitor42,
          onCourse: [competitor42],
        })
      })

      // Then try to highlight same competitor
      act(() => {
        mockProvider.triggerResults({
          results: [],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '42',
        })
      })

      // Highlight should NOT be active (deduplication)
      expect(result.current.highlightBib).toBeNull()
    })

    it('activates highlight when competitor is NOT on course', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      const competitor99 = createOnCourseCompetitor({ bib: '99', name: 'Other Athlete' })

      // Set a DIFFERENT competitor on course
      act(() => {
        mockProvider.triggerOnCourse({
          current: competitor99,
          onCourse: [competitor99],
        })
      })

      // Highlight someone who is not on course
      act(() => {
        mockProvider.triggerResults({
          results: [],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '42',
        })
      })

      // Highlight SHOULD be active
      expect(result.current.highlightBib).toBe('42')
      expect(result.current.highlightTimestamp).not.toBeNull()
    })

    it('activates highlight when onCourse is empty', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      // No competitor on course
      act(() => {
        mockProvider.triggerOnCourse({
          current: null,
          onCourse: [],
        })
      })

      // Highlight a competitor
      act(() => {
        mockProvider.triggerResults({
          results: [],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '42',
        })
      })

      expect(result.current.highlightBib).toBe('42')
    })

    it('does not reset timestamp for same highlightBib', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      // First highlight
      act(() => {
        mockProvider.triggerResults({
          results: [],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '42',
        })
      })

      const firstTimestamp = result.current.highlightTimestamp

      // Advance time
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Same highlight again
      act(() => {
        mockProvider.triggerResults({
          results: [],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '42',
        })
      })

      // Timestamp should not change for same bib
      expect(result.current.highlightTimestamp).toBe(firstTimestamp)
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

      // Set and then change competitor
      act(() => {
        mockProvider.triggerOnCourse({
          current: competitor,
          onCourse: [],
        })
      })

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

    it('clears departing competitor when highlight arrives for them', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      const competitor = createOnCourseCompetitor({ bib: '42', name: 'Test Athlete' })

      // Set and then change competitor
      act(() => {
        mockProvider.triggerOnCourse({
          current: competitor,
          onCourse: [],
        })
      })

      act(() => {
        mockProvider.triggerOnCourse({
          current: null,
          onCourse: [],
        })
      })

      expect(result.current.departingCompetitor?.bib).toBe('42')

      // Highlight arrives for departing competitor
      act(() => {
        mockProvider.triggerResults({
          results: [],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '42',
        })
      })

      // Departing should be cleared, highlight should be active
      expect(result.current.departingCompetitor).toBeNull()
      expect(result.current.departedAt).toBeNull()
      expect(result.current.highlightBib).toBe('42')
    })
  })

  describe('reconnect state reset', () => {
    it('resets all data state when status changes to reconnecting', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      const competitor99 = createOnCourseCompetitor({ bib: '99', name: 'Current' })

      // Populate state with data
      act(() => {
        mockProvider.triggerResults({
          results: [createResult()],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '42',
        })
        mockProvider.triggerOnCourse({
          current: competitor99,
          onCourse: [competitor99],
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

      expect(result.current.visibility.displayCurrent).toBe(true)
      expect(result.current.visibility.displayTop).toBe(false)
      expect(result.current.visibility.displayFooter).toBe(false)
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

  describe('rapid highlight changes (edge cases)', () => {
    it('handles multiple highlights arriving < 100ms apart', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      // First highlight
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '42' })],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '42',
        })
      })

      expect(result.current.highlightBib).toBe('42')
      const firstTimestamp = result.current.highlightTimestamp

      // Advance just 50ms
      act(() => {
        vi.advanceTimersByTime(50)
      })

      // Second highlight for DIFFERENT competitor
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '42' }), createResult({ bib: '99', rank: 2 })],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '99',
        })
      })

      // Should switch to new highlight
      expect(result.current.highlightBib).toBe('99')
      // Timestamp should be updated (different bib)
      expect(result.current.highlightTimestamp).toBeGreaterThan(firstTimestamp!)
    })

    it('handles three competitors finishing within 200ms', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      // Competitor 1 finishes
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '1' })],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '1',
        })
      })

      expect(result.current.highlightBib).toBe('1')

      // 80ms later, competitor 2 finishes
      act(() => {
        vi.advanceTimersByTime(80)
      })

      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '1' }), createResult({ bib: '2', rank: 2 })],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '2',
        })
      })

      expect(result.current.highlightBib).toBe('2')

      // 80ms later, competitor 3 finishes
      act(() => {
        vi.advanceTimersByTime(80)
      })

      act(() => {
        mockProvider.triggerResults({
          results: [
            createResult({ bib: '1' }),
            createResult({ bib: '2', rank: 2 }),
            createResult({ bib: '3', rank: 3 }),
          ],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '3',
        })
      })

      expect(result.current.highlightBib).toBe('3')
    })

    it('does not flash null highlight between rapid changes', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      // Track all highlight values
      const highlightHistory: (string | null)[] = []

      // Subscribe to changes (simplified)
      const captureHighlight = () => {
        highlightHistory.push(result.current.highlightBib)
      }

      // First highlight
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '42' })],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '42',
        })
      })
      captureHighlight()

      // Immediately second highlight (same render cycle simulation)
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '42' }), createResult({ bib: '99', rank: 2 })],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '99',
        })
      })
      captureHighlight()

      // Should never have null between valid highlights
      expect(highlightHistory).toEqual(['42', '99'])
    })

    it('does not immediately clear highlight when server sends null (uses timestamp expiration)', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      // Set initial highlight
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '42' })],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '42',
        })
      })

      expect(result.current.highlightBib).toBe('42')

      // Server sends null - highlight should NOT be cleared immediately
      // (uses timestamp-based expiration via useHighlight hook instead)
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '42' })],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: null,
        })
      })

      // Highlight still active - will expire via timestamp
      expect(result.current.highlightBib).toBe('42')
      expect(result.current.highlightTimestamp).not.toBeNull()
    })

    it('replaces old highlight with new highlight when new one arrives', () => {
      const mockProvider = createMockProvider()
      const wrapper = createWrapper(mockProvider)

      const { result } = renderHook(() => useScoreboard(), { wrapper })

      // Set initial highlight
      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '42' })],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '42',
        })
      })

      expect(result.current.highlightBib).toBe('42')

      // 10ms later, new highlight arrives - should replace old one
      act(() => {
        vi.advanceTimersByTime(10)
      })

      act(() => {
        mockProvider.triggerResults({
          results: [createResult({ bib: '42' }), createResult({ bib: '99', rank: 2 })],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '99',
        })
      })

      expect(result.current.highlightBib).toBe('99')
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
