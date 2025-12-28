import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { ScoreboardProvider, useScoreboard } from '../ScoreboardContext'
import { DEPARTING_TIMEOUT } from '../constants'
import type { DataProvider, Unsubscribe, ResultsData, OnCourseData, EventInfoData } from '@/providers/types'
import type { ConnectionStatus, VisibilityState } from '@/types'

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
          results: [
            { rank: 1, bib: '42', name: 'Test Athlete', time: '90.50', penalty: 0, behind: '' },
          ],
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

      // First, set competitor on course
      act(() => {
        mockProvider.triggerOnCourse({
          current: { bib: '42', name: 'Test Athlete' },
          onCourse: [{ bib: '42', name: 'Test Athlete' }],
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

      // Set a DIFFERENT competitor on course
      act(() => {
        mockProvider.triggerOnCourse({
          current: { bib: '99', name: 'Other Athlete' },
          onCourse: [{ bib: '99', name: 'Other Athlete' }],
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

      // Set first competitor
      act(() => {
        mockProvider.triggerOnCourse({
          current: { bib: '42', name: 'First Athlete' },
          onCourse: [{ bib: '42', name: 'First Athlete' }],
        })
      })

      expect(result.current.currentCompetitor?.bib).toBe('42')
      expect(result.current.departingCompetitor).toBeNull()

      // Change to different competitor
      act(() => {
        mockProvider.triggerOnCourse({
          current: { bib: '99', name: 'Second Athlete' },
          onCourse: [{ bib: '99', name: 'Second Athlete' }],
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

      // Set competitor
      act(() => {
        mockProvider.triggerOnCourse({
          current: { bib: '42', name: 'Test Athlete' },
          onCourse: [{ bib: '42', name: 'Test Athlete' }],
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

      // Set and then change competitor
      act(() => {
        mockProvider.triggerOnCourse({
          current: { bib: '42', name: 'Test Athlete' },
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

      // Set and then change competitor
      act(() => {
        mockProvider.triggerOnCourse({
          current: { bib: '42', name: 'Test Athlete' },
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

      // Populate state with data
      act(() => {
        mockProvider.triggerResults({
          results: [
            { rank: 1, bib: '42', name: 'Test', time: '90.50', penalty: 0, behind: '' },
          ],
          raceName: 'Test Race',
          raceStatus: 'Running',
          highlightBib: '42',
        })
        mockProvider.triggerOnCourse({
          current: { bib: '99', name: 'Current' },
          onCourse: [{ bib: '99', name: 'Current' }],
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
          displayInfoText: false,
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
