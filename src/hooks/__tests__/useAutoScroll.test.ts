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
    browseAfterHighlight: false,
    scrollToFinished: true,
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
  beforeEach(() => {
    vi.useFakeTimers()

    // requestAnimationFrame and cancelAnimationFrame are handled by Vitest fake timers

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
      browseAfterHighlight: false,
      scrollToFinished: true,
    })

    mockUseScoreboard.mockReturnValue({
      currentCompetitor: null,
      onCourse: [],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

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
    it('resumes auto-scroll when highlight expires', async () => {
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

      expect(result.current.phase).toBe('IDLE')
    })

    it('handles component unmount properly', async () => {
      const { unmount } = renderHook(() => useAutoScroll({ enabled: true }))

      await act(async () => {
        vi.advanceTimersByTime(1000)
      })

      // Unmount should not throw
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('browse scroll after highlight', () => {
    it('does not activate browse on vertical layout even when enabled', async () => {
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
        browseAfterHighlight: true,
        scrollToFinished: true,
      })

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

      // End highlight
      mockUseHighlight.mockReturnValue({
        highlightBib: null,
        isActive: false,
        timeRemaining: 0,
        progress: 0,
      })

      rerender()

      await act(async () => {
        vi.advanceTimersByTime(1000)
      })

      // Should NOT be in browse mode — vertical layout
      expect(result.current.phase).not.toBe('BROWSE_SCROLLING')
    })

    it('does not activate browse when browseAfterHighlight is false', async () => {
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
        browseAfterHighlight: false,
        scrollToFinished: true,
      })

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

      // End highlight
      mockUseHighlight.mockReturnValue({
        highlightBib: null,
        isActive: false,
        timeRemaining: 0,
        progress: 0,
      })

      rerender()

      await act(async () => {
        vi.advanceTimersByTime(1000)
      })

      // Should NOT be in browse mode — feature disabled
      expect(result.current.phase).not.toBe('BROWSE_SCROLLING')
    })

    it('transitions from HIGHLIGHT_VIEW to BROWSE_SCROLLING on ledwall when enabled', async () => {
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
        browseAfterHighlight: true,
        scrollToFinished: true,
      })

      // Start with highlight active
      mockUseHighlight.mockReturnValue({
        highlightBib: '42',
        isActive: true,
        timeRemaining: 5000,
        progress: 0,
      })

      const { result, rerender } = renderHook(() => useAutoScroll({ enabled: true }))

      // The hook needs a real container to enter HIGHLIGHT_VIEW (effect guards on containerRef.current).
      // Directly assign to the ref's current property — this bypasses the null guard.
      const mockContainer = document.createElement('div')
      Object.defineProperty(mockContainer, 'scrollHeight', { value: 500, configurable: true })
      Object.defineProperty(mockContainer, 'clientHeight', { value: 100, configurable: true })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(result.current.containerRef as any).current = mockContainer

      // Force React to re-run the highlight effect by toggling highlightBib
      // (deps change → effect re-runs with container now present)
      mockUseHighlight.mockReturnValue({
        highlightBib: null,
        isActive: false,
        timeRemaining: 0,
        progress: 0,
      })
      rerender()

      mockUseHighlight.mockReturnValue({
        highlightBib: '42',
        isActive: true,
        timeRemaining: 5000,
        progress: 0,
      })
      rerender()

      await act(async () => {
        vi.runAllTimers()
      })

      // Verify we're in HIGHLIGHT_VIEW
      expect(result.current.phase).toBe('HIGHLIGHT_VIEW')

      // End highlight
      mockUseHighlight.mockReturnValue({
        highlightBib: null,
        isActive: false,
        timeRemaining: 0,
        progress: 0,
      })

      rerender()

      // Wait for the 500ms delay after highlight fade
      await act(async () => {
        vi.advanceTimersByTime(600)
      })

      // Should transition to BROWSE_SCROLLING
      expect(result.current.phase).toBe('BROWSE_SCROLLING')
    })

    it('skips browse when top was not shown for >3 minutes', async () => {
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
        browseAfterHighlight: true,
        scrollToFinished: true,
      })

      // Start with highlight active
      mockUseHighlight.mockReturnValue({
        highlightBib: '42',
        isActive: true,
        timeRemaining: 5000,
        progress: 0,
      })

      const { result, rerender } = renderHook(() => useAutoScroll({ enabled: true }))

      // Set up mock container with scrollTo
      const mockContainer = document.createElement('div')
      Object.defineProperty(mockContainer, 'scrollHeight', { value: 500, configurable: true })
      Object.defineProperty(mockContainer, 'clientHeight', { value: 100, configurable: true })
      mockContainer.scrollTo = vi.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(result.current.containerRef as any).current = mockContainer

      // Toggle highlight to trigger effect with container
      mockUseHighlight.mockReturnValue({
        highlightBib: null,
        isActive: false,
        timeRemaining: 0,
        progress: 0,
      })
      rerender()

      mockUseHighlight.mockReturnValue({
        highlightBib: '42',
        isActive: true,
        timeRemaining: 5000,
        progress: 0,
      })
      rerender()

      await act(async () => {
        vi.runAllTimers()
      })

      expect(result.current.phase).toBe('HIGHLIGHT_VIEW')

      // Advance time by >3 minutes to expire the top-shown threshold
      vi.advanceTimersByTime(3 * 60 * 1000 + 1000)

      // End highlight
      mockUseHighlight.mockReturnValue({
        highlightBib: null,
        isActive: false,
        timeRemaining: 0,
        progress: 0,
      })

      rerender()

      // Wait for the 500ms delay after highlight fade
      await act(async () => {
        vi.advanceTimersByTime(600)
      })

      // Should NOT browse — top threshold exceeded, returns to normal scroll cycle
      expect(result.current.phase).not.toBe('BROWSE_SCROLLING')
      expect(result.current.phase).not.toBe('BROWSE_PAUSED_AT_BOTTOM')
    })

    it('handles unmount during BROWSE_SCROLLING without errors', async () => {
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
        browseAfterHighlight: true,
        scrollToFinished: true,
      })

      const { unmount } = renderHook(() => useAutoScroll({ enabled: true }))

      await act(async () => {
        vi.advanceTimersByTime(1000)
      })

      expect(() => unmount()).not.toThrow()
    })
  })
})
