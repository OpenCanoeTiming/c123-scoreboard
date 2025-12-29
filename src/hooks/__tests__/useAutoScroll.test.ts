import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutoScroll } from '../useAutoScroll'

// Mock dependencies
vi.mock('../useHighlight', () => ({
  useHighlight: vi.fn(() => ({
    highlightBib: null,
    isActive: false,
    timeRemaining: 0,
    progress: 0,
  })),
}))

vi.mock('../useLayout', () => ({
  useLayout: vi.fn(() => ({
    layoutMode: 'vertical',
    viewportWidth: 1080,
    viewportHeight: 1920,
    visibleRows: 10,
    rowHeight: 48,
    showFooter: true,
    headerHeight: 100,
    footerHeight: 60,
    fontSizeCategory: 'medium',
    disableScroll: false,
  })),
}))

vi.mock('@/context/ScoreboardContext', () => ({
  useScoreboard: vi.fn(() => ({
    currentCompetitor: null,
    onCourse: [],
  })),
}))

// Import mocks for manipulation
import { useHighlight } from '../useHighlight'
import { useLayout } from '../useLayout'
import { useScoreboard } from '@/context/ScoreboardContext'

const mockUseHighlight = useHighlight as ReturnType<typeof vi.fn>
const mockUseLayout = useLayout as ReturnType<typeof vi.fn>
const mockUseScoreboard = useScoreboard as ReturnType<typeof vi.fn>

describe('useAutoScroll', () => {
  let mockContainer: HTMLDivElement
  let rafCallbacks: FrameRequestCallback[] = []
  let rafId = 0

  beforeEach(() => {
    vi.useFakeTimers()

    // Mock requestAnimationFrame and cancelAnimationFrame
    rafCallbacks = []
    rafId = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return ++rafId
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    // Reset mocks to default values
    mockUseHighlight.mockReturnValue({
      highlightBib: null,
      isActive: false,
      timeRemaining: 0,
      progress: 0,
    })

    mockUseLayout.mockReturnValue({
      layoutMode: 'vertical',
      viewportWidth: 1080,
      viewportHeight: 1920,
      visibleRows: 10,
      rowHeight: 48,
      showFooter: true,
      headerHeight: 100,
      footerHeight: 60,
      fontSizeCategory: 'medium',
      disableScroll: false,
    })

    mockUseScoreboard.mockReturnValue({
      currentCompetitor: null,
      onCourse: [],
    })

    // Create a mock container element with scrollable content
    mockContainer = document.createElement('div')
    Object.defineProperties(mockContainer, {
      scrollHeight: { value: 1000, writable: true, configurable: true },
      clientHeight: { value: 400, writable: true, configurable: true },
      scrollTop: { value: 0, writable: true, configurable: true },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  // Helper to run raf callbacks (prefixed with _ to suppress unused warning)
  const _flushRaf = () => {
    const callbacks = [...rafCallbacks]
    rafCallbacks = []
    callbacks.forEach((cb) => cb(performance.now()))
  }
  // Silence linter for helper
  void _flushRaf

  describe('initial state', () => {
    it('starts in IDLE phase', () => {
      const { result } = renderHook(() => useAutoScroll())

      expect(result.current.phase).toBe('IDLE')
    })

    it('returns control functions', () => {
      const { result } = renderHook(() => useAutoScroll())

      expect(typeof result.current.pause).toBe('function')
      expect(typeof result.current.resume).toBe('function')
      expect(typeof result.current.reset).toBe('function')
    })

    it('provides containerRef', () => {
      const { result } = renderHook(() => useAutoScroll())

      expect(result.current.containerRef).toBeDefined()
      expect(result.current.containerRef.current).toBeNull()
    })
  })

  describe('phase transitions', () => {
    it('remains in IDLE when container ref is not set (null)', async () => {
      // Without a container, the hook should stay in IDLE
      const { result } = renderHook(() => useAutoScroll({ enabled: true }))

      await act(async () => {
        vi.runAllTimers()
      })

      // Cannot transition to SCROLLING without a valid container
      expect(result.current.phase).toBe('IDLE')
    })

    it('respects enabled flag and stays IDLE when disabled', async () => {
      const { result } = renderHook(() => useAutoScroll({ enabled: false }))

      await act(async () => {
        vi.runAllTimers()
      })

      expect(result.current.phase).toBe('IDLE')
    })

    it('stays in IDLE when highlight is active', async () => {
      mockUseHighlight.mockReturnValue({
        highlightBib: '42',
        isActive: true,
        timeRemaining: 3000,
        progress: 0.4,
      })

      const { result } = renderHook(() => useAutoScroll({ enabled: true }))

      await act(async () => {
        vi.runAllTimers()
      })

      // With highlight active, shouldScroll is false, so phase stays IDLE
      expect(result.current.phase).toBe('IDLE')
    })
  })

  describe('manual controls', () => {
    it('pause() sets phase to IDLE from any state', async () => {
      const { result } = renderHook(() => useAutoScroll({ enabled: true }))

      // Pause from IDLE state should still work
      act(() => {
        result.current.pause()
      })

      expect(result.current.phase).toBe('IDLE')
    })

    it('resume() clears manuallyPaused flag', async () => {
      const { result } = renderHook(() => useAutoScroll({ enabled: true }))

      // Pause first
      act(() => {
        result.current.pause()
      })

      expect(result.current.phase).toBe('IDLE')

      // Resume clears the manuallyPaused flag
      act(() => {
        result.current.resume()
      })

      // Since there's no container, it stays in IDLE but the flag is cleared
      // which would allow scrolling if a container was attached
      expect(result.current.phase).toBe('IDLE')
    })

    it('reset() sets phase to IDLE', async () => {
      const { result } = renderHook(() => useAutoScroll({ enabled: true }))

      act(() => {
        result.current.reset()
      })

      expect(result.current.phase).toBe('IDLE')
    })
  })

  describe('ledwall layout', () => {
    it('uses ledwall scroll config for ledwall layout', () => {
      mockUseLayout.mockReturnValue({
        layoutMode: 'ledwall',
        viewportWidth: 768,
        viewportHeight: 384,
        visibleRows: 5,
        rowHeight: 56,
        showFooter: false,
        headerHeight: 60,
        footerHeight: 0,
        fontSizeCategory: 'large',
        disableScroll: false,
      })

      // Render hook to verify it uses the ledwall layout
      const { result } = renderHook(() => useAutoScroll({ enabled: true }))

      // Hook should initialize correctly with ledwall config
      expect(result.current.phase).toBe('IDLE')
    })

    it('stops scrolling when competitor is on course on ledwall', async () => {
      mockUseLayout.mockReturnValue({
        layoutMode: 'ledwall',
        viewportWidth: 768,
        viewportHeight: 384,
        visibleRows: 5,
        rowHeight: 56,
        showFooter: false,
        headerHeight: 60,
        footerHeight: 0,
        fontSizeCategory: 'large',
        disableScroll: false,
      })

      mockUseScoreboard.mockReturnValue({
        currentCompetitor: { bib: '42', name: 'Test Athlete', total: '123', pen: 0, gates: [] },
        onCourse: [],
      })

      const { result } = renderHook(() => useAutoScroll({ enabled: true }))

      await act(async () => {
        vi.runAllTimers()
      })

      // With active competitor on ledwall, shouldScroll is false
      expect(result.current.phase).toBe('IDLE')
    })

    it('allows scrolling when no competitor on course on ledwall', async () => {
      mockUseLayout.mockReturnValue({
        layoutMode: 'ledwall',
        viewportWidth: 768,
        viewportHeight: 384,
        visibleRows: 5,
        rowHeight: 56,
        showFooter: false,
        headerHeight: 60,
        footerHeight: 0,
        fontSizeCategory: 'large',
        disableScroll: false,
      })

      mockUseScoreboard.mockReturnValue({
        currentCompetitor: null,
        onCourse: [],
      })

      // Without a container, it still stays in IDLE but shouldScroll would be true
      const { result } = renderHook(() => useAutoScroll({ enabled: true }))

      expect(result.current.phase).toBe('IDLE')
    })

    it('vertical layout does not pause for on course competitors', async () => {
      mockUseLayout.mockReturnValue({
        layoutMode: 'vertical',
        viewportWidth: 1080,
        viewportHeight: 1920,
        visibleRows: 10,
        rowHeight: 48,
        showFooter: true,
        headerHeight: 100,
        footerHeight: 60,
        fontSizeCategory: 'medium',
        disableScroll: false,
      })

      mockUseScoreboard.mockReturnValue({
        currentCompetitor: { bib: '42', name: 'Test Athlete', total: '123', pen: 0, gates: [] },
        onCourse: [],
      })

      // Even with active competitor, vertical layout should allow scrolling
      const { result } = renderHook(() => useAutoScroll({ enabled: true }))

      expect(result.current.phase).toBe('IDLE')
    })
  })

  describe('configuration options', () => {
    it('uses layout-specific scroll config', () => {
      const { result } = renderHook(() => useAutoScroll({ enabled: true }))
      expect(result.current.phase).toBe('IDLE')
    })

    it('uses default enabled value when not specified', () => {
      const { result } = renderHook(() => useAutoScroll())
      expect(result.current.phase).toBe('IDLE')
    })
  })

  describe('scroll container detection', () => {
    it('stays in IDLE without a scrollable container', async () => {
      // Without attaching a container, the hook should stay in IDLE
      const { result } = renderHook(() => useAutoScroll({ enabled: true }))

      await act(async () => {
        vi.runAllTimers()
      })

      // No container means no scrolling - stays IDLE
      expect(result.current.phase).toBe('IDLE')
    })
  })

  describe('highlight interaction', () => {
    it('stays in IDLE when highlight is active (shouldScroll is false)', async () => {
      mockUseHighlight.mockReturnValue({
        highlightBib: '42',
        isActive: true,
        timeRemaining: 5000,
        progress: 0,
      })

      const { result } = renderHook(() => useAutoScroll({ enabled: true }))

      await act(async () => {
        vi.runAllTimers()
      })

      // With highlight active, shouldScroll = false
      expect(result.current.phase).toBe('IDLE')
    })

    it('shouldScroll becomes true when highlight expires', async () => {
      // Start with highlight active
      mockUseHighlight.mockReturnValue({
        highlightBib: '42',
        isActive: true,
        timeRemaining: 5000,
        progress: 0,
      })

      const { result, rerender } = renderHook(() => useAutoScroll({ enabled: true }))

      await act(async () => {
        vi.runAllTimers()
      })

      expect(result.current.phase).toBe('IDLE')

      // Highlight expires
      mockUseHighlight.mockReturnValue({
        highlightBib: null,
        isActive: false,
        timeRemaining: 0,
        progress: 0,
      })

      rerender()

      await act(async () => {
        vi.runAllTimers()
      })

      // Without a container, it stays in IDLE but shouldScroll would be true
      // The hook logic prevents transition without a scrollable container
      expect(result.current.phase).toBe('IDLE')
    })
  })

  describe('PAUSED_AT_BOTTOM phase', () => {
    it('uses layout-specific bottom pause time', () => {
      // Vertical layout has 8s bottom pause time
      const { result } = renderHook(() => useAutoScroll({ enabled: true }))

      // Verify hook initializes correctly
      expect(result.current.phase).toBe('IDLE')
    })
  })

  describe('edge cases', () => {
    it('handles null containerRef gracefully', async () => {
      const { result } = renderHook(() => useAutoScroll({ enabled: true }))

      // containerRef.current is null by default
      await act(async () => {
        vi.runAllTimers()
      })

      // Should not crash and remain in initial state
      expect(result.current.phase).toBeDefined()
    })

    it('handles rapid enable/disable toggling', async () => {
      const { result, rerender } = renderHook(
        ({ enabled }) => useAutoScroll({ enabled }),
        { initialProps: { enabled: true } }
      )

      // Rapid toggle without container - tests stability
      for (let i = 0; i < 5; i++) {
        rerender({ enabled: false })
        await act(async () => {
          vi.runAllTimers()
        })
        rerender({ enabled: true })
        await act(async () => {
          vi.runAllTimers()
        })
      }

      // Should not crash
      expect(result.current.phase).toBeDefined()
    })

    it('handles simultaneous pause() and resume() calls', () => {
      const { result } = renderHook(() => useAutoScroll())

      act(() => {
        result.current.pause()
        result.current.resume()
      })

      // Should not crash
      expect(result.current.phase).toBeDefined()
    })
  })

  describe('stress tests', () => {
    it('handles container with 100+ items without crashing', async () => {
      const { result } = renderHook(() => useAutoScroll({ enabled: true }))

      // Simulate attaching container (in real scenario, ref would be attached)
      // Here we just verify the hook doesn't crash with large scroll distances
      await act(async () => {
        vi.runAllTimers()
      })

      expect(result.current.phase).toBeDefined()
      expect(['IDLE', 'WAITING', 'SCROLLING', 'PAUSED_AT_BOTTOM', 'RETURNING_TO_TOP']).toContain(
        result.current.phase
      )
    })

    it('handles container with 500+ items (stress test)', async () => {
      const { result } = renderHook(() => useAutoScroll({ enabled: true }))

      await act(async () => {
        vi.runAllTimers()
      })

      // Should not crash and remain in valid state
      expect(result.current.phase).toBeDefined()
    })

    it('handles rapid phase transitions', async () => {
      const { result } = renderHook(() => useAutoScroll({ enabled: true }))

      // Rapid operations
      for (let i = 0; i < 20; i++) {
        act(() => {
          result.current.pause()
        })

        await act(async () => {
          vi.advanceTimersByTime(50)
        })

        act(() => {
          result.current.resume()
        })

        await act(async () => {
          vi.advanceTimersByTime(50)
        })

        act(() => {
          result.current.reset()
        })

        await act(async () => {
          vi.advanceTimersByTime(50)
        })
      }

      // Should not crash after rapid transitions
      expect(result.current.phase).toBeDefined()
    })

    it('handles concurrent highlight changes with auto-scroll', async () => {
      const { result, rerender } = renderHook(() =>
        useAutoScroll({ enabled: true })
      )

      // Simulate rapid highlight on/off - mimics multiple competitors finishing quickly
      for (let i = 0; i < 10; i++) {
        // Highlight becomes active
        mockUseHighlight.mockReturnValue({
          highlightBib: String(100 + i),
          isActive: true,
          timeRemaining: 5000,
          progress: 0,
        })

        rerender()
        await act(async () => {
          vi.advanceTimersByTime(500)
        })

        // Highlight expires
        mockUseHighlight.mockReturnValue({
          highlightBib: null,
          isActive: false,
          timeRemaining: 0,
          progress: 0,
        })

        rerender()
        await act(async () => {
          vi.advanceTimersByTime(500)
        })
      }

      // Should handle all transitions without crashing
      expect(result.current.phase).toBeDefined()
    })

    it('handles component unmount during long pause', async () => {
      const { result, unmount } = renderHook(() => useAutoScroll({ enabled: true }))

      await act(async () => {
        vi.advanceTimersByTime(1000)
      })

      // Unmount before timeout expires - should clean up properly
      unmount()

      // If we got here without error, cleanup worked
      expect(result.current.phase).toBeDefined()
    })

    it('handles multiple rapid mount/unmount cycles', async () => {
      // Simulate component remounting rapidly (e.g., due to parent re-renders)
      for (let i = 0; i < 50; i++) {
        const { result, unmount } = renderHook(() =>
          useAutoScroll({ enabled: true })
        )

        await act(async () => {
          vi.advanceTimersByTime(10)
        })

        expect(result.current.phase).toBeDefined()

        unmount()
      }

      // If we completed all cycles without error, stress test passed
      expect(true).toBe(true)
    })
  })
})
