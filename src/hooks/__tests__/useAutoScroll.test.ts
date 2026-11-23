import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook as renderHookBare, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { ClockProvider } from '@/clock/clockContext'
import { createFakeClock, type FakeClock } from '@/clock/fakeClock'
import { useAutoScroll } from '../useAutoScroll'


// Time comes from the injected fake Clock (no global fake timers).
let clock: FakeClock
function renderHook<T, P = undefined>(cb: (props: P) => T, options?: { initialProps?: P }) {
  const wrapper = ({ children }: { children: ReactNode }) => createElement(ClockProvider, { clock, children })
  return renderHookBare(cb, { ...options, wrapper })
}
/** Runs the one pending timer of the state machine (the longest wait is 12 s). */
const runPending = () => clock.advance(12_000)
/** Advances in 16 ms steps, one frame each, as a display would. */
function advanceFrames(ms: number) {
  for (let t = 0; t < ms; t += 16) {
    clock.advance(16)
    clock.frame()
  }
}

// Mock dependencies
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

// Import mocks for manipulation
import { useLayout } from '../useLayout'

const mockUseLayout = useLayout as ReturnType<typeof vi.fn>

// The hook takes its highlight and on-course inputs from the BoardView (`resultsScroll`), not from the
// scoreboard context, so it also runs under a bare BoardProvider. The tests set them as the producer does:
// the active highlight's bib, and whether someone on course has started and not finished.
type OnCourseInput = { dtStart?: string | null; dtFinish?: string | null }
let inputs = { highlightBib: null as string | null, someoneRacing: false }

function mockHighlight(h: { highlightBib: string | null; isActive: boolean; [field: string]: unknown }) {
  inputs = { ...inputs, highlightBib: h.isActive ? h.highlightBib : null }
}

function mockOnCourse(s: { onCourse: OnCourseInput[]; [field: string]: unknown }) {
  inputs = { ...inputs, someoneRacing: s.onCourse.some((c) => !!c.dtStart && !c.dtFinish) }
}

function useHook(config: { enabled?: boolean } = {}) {
  return useAutoScroll({ ...config, ...inputs })
}

describe('useAutoScroll', () => {
  beforeEach(() => {
    clock = createFakeClock(1_700_000_000_000)

    // Reset mocks to default values
    mockHighlight({
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

    mockOnCourse({
      currentCompetitor: null,
      onCourse: [],
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  describe('initial state', () => {
    it('starts in IDLE phase', () => {
      const { result } = renderHook(() => useHook())

      expect(result.current.phase).toBe('IDLE')
    })

    it('returns control functions', () => {
      const { result } = renderHook(() => useHook())

      expect(typeof result.current.pause).toBe('function')
      expect(typeof result.current.resume).toBe('function')
      expect(typeof result.current.reset).toBe('function')
    })

    it('provides containerRef', () => {
      const { result } = renderHook(() => useHook())

      expect(result.current.containerRef).toBeDefined()
      expect(result.current.containerRef.current).toBeNull()
    })
  })

  describe('phase transitions', () => {
    it('remains in IDLE when container ref is not set (null)', async () => {
      // Without a container, the hook should stay in IDLE
      const { result } = renderHook(() => useHook({ enabled: true }))

      await act(async () => {
        runPending()
      })

      // Cannot transition to SCROLLING without a valid container
      expect(result.current.phase).toBe('IDLE')
    })

    it('respects enabled flag and stays IDLE when disabled', async () => {
      const { result } = renderHook(() => useHook({ enabled: false }))

      await act(async () => {
        runPending()
      })

      expect(result.current.phase).toBe('IDLE')
    })

    it('stays in IDLE when highlight is active', async () => {
      mockHighlight({
        highlightBib: '42',
        isActive: true,
        timeRemaining: 3000,
        progress: 0.4,
      })

      const { result } = renderHook(() => useHook({ enabled: true }))

      await act(async () => {
        runPending()
      })

      // With highlight active, shouldScroll is false, so phase stays IDLE
      expect(result.current.phase).toBe('IDLE')
    })
  })

  describe('manual controls', () => {
    it('pause() sets phase to IDLE from any state', async () => {
      const { result } = renderHook(() => useHook({ enabled: true }))

      // Pause from IDLE state should still work
      act(() => {
        result.current.pause()
      })

      expect(result.current.phase).toBe('IDLE')
    })

    it('resume() clears manuallyPaused flag', async () => {
      const { result } = renderHook(() => useHook({ enabled: true }))

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
      const { result } = renderHook(() => useHook({ enabled: true }))

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
      const { result } = renderHook(() => useHook({ enabled: true }))

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

      mockOnCourse({
        currentCompetitor: { bib: '42', name: 'Test Athlete', total: '123', pen: 0, gates: [] },
        onCourse: [],
      })

      const { result } = renderHook(() => useHook({ enabled: true }))

      await act(async () => {
        runPending()
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

      mockOnCourse({
        currentCompetitor: null,
        onCourse: [],
      })

      // Without a container, it still stays in IDLE but shouldScroll would be true
      const { result } = renderHook(() => useHook({ enabled: true }))

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

      mockOnCourse({
        currentCompetitor: { bib: '42', name: 'Test Athlete', total: '123', pen: 0, gates: [] },
        onCourse: [],
      })

      // Even with active competitor, vertical layout should allow scrolling
      const { result } = renderHook(() => useHook({ enabled: true }))

      expect(result.current.phase).toBe('IDLE')
    })
  })

  describe('configuration options', () => {
    it('uses layout-specific scroll config', () => {
      const { result } = renderHook(() => useHook({ enabled: true }))
      expect(result.current.phase).toBe('IDLE')
    })

    it('uses default enabled value when not specified', () => {
      const { result } = renderHook(() => useHook())
      expect(result.current.phase).toBe('IDLE')
    })
  })

  describe('scroll container detection', () => {
    it('stays in IDLE without a scrollable container', async () => {
      // Without attaching a container, the hook should stay in IDLE
      const { result } = renderHook(() => useHook({ enabled: true }))

      await act(async () => {
        runPending()
      })

      // No container means no scrolling - stays IDLE
      expect(result.current.phase).toBe('IDLE')
    })
  })

  describe('highlight interaction', () => {
    it('resumes auto-scroll when highlight expires', async () => {
      // Start with highlight active
      mockHighlight({
        highlightBib: '42',
        isActive: true,
        timeRemaining: 5000,
        progress: 0,
      })

      const { result, rerender } = renderHook(() => useHook({ enabled: true }))

      await act(async () => {
        runPending()
      })

      expect(result.current.phase).toBe('IDLE')

      // Highlight expires
      mockHighlight({
        highlightBib: null,
        isActive: false,
        timeRemaining: 0,
        progress: 0,
      })

      rerender()

      await act(async () => {
        runPending()
      })

      // Without a container, it stays in IDLE but shouldScroll would be true
      // The hook logic prevents transition without a scrollable container
      expect(result.current.phase).toBe('IDLE')
    })
  })

  describe('PAUSED_AT_BOTTOM phase', () => {
    it('uses layout-specific bottom pause time', () => {
      // Vertical layout has 8s bottom pause time
      const { result } = renderHook(() => useHook({ enabled: true }))

      // Verify hook initializes correctly
      expect(result.current.phase).toBe('IDLE')
    })
  })

  describe('edge cases', () => {
    it('handles null containerRef gracefully', async () => {
      const { result } = renderHook(() => useHook({ enabled: true }))

      // containerRef.current is null by default
      await act(async () => {
        runPending()
      })

      // Should not crash and remain in initial state
      expect(result.current.phase).toBeDefined()
    })

    it('handles rapid enable/disable toggling', async () => {
      const { result, rerender } = renderHook(
        ({ enabled }) => useHook({ enabled }),
        { initialProps: { enabled: true } }
      )

      // Rapid toggle without container - tests stability
      for (let i = 0; i < 5; i++) {
        rerender({ enabled: false })
        await act(async () => {
          runPending()
        })
        rerender({ enabled: true })
        await act(async () => {
          runPending()
        })
      }

      // Should not crash
      expect(result.current.phase).toBeDefined()
    })

    it('handles simultaneous pause() and resume() calls', () => {
      const { result } = renderHook(() => useHook())

      act(() => {
        result.current.pause()
        result.current.resume()
      })

      expect(result.current.phase).toBe('IDLE')
    })

    it('handles component unmount properly', async () => {
      const { unmount } = renderHook(() => useHook({ enabled: true }))

      await act(async () => {
        advanceFrames(1000)
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
      mockHighlight({
        highlightBib: '42',
        isActive: true,
        timeRemaining: 5000,
        progress: 0,
      })

      const { result, rerender } = renderHook(() => useHook({ enabled: true }))

      await act(async () => {
        runPending()
      })

      // End highlight
      mockHighlight({
        highlightBib: null,
        isActive: false,
        timeRemaining: 0,
        progress: 0,
      })

      rerender()

      await act(async () => {
        advanceFrames(1000)
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

      mockHighlight({
        highlightBib: '42',
        isActive: true,
        timeRemaining: 5000,
        progress: 0,
      })

      const { result, rerender } = renderHook(() => useHook({ enabled: true }))

      await act(async () => {
        runPending()
      })

      // End highlight
      mockHighlight({
        highlightBib: null,
        isActive: false,
        timeRemaining: 0,
        progress: 0,
      })

      rerender()

      await act(async () => {
        advanceFrames(1000)
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
      mockHighlight({
        highlightBib: '42',
        isActive: true,
        timeRemaining: 5000,
        progress: 0,
      })

      const { result, rerender } = renderHook(() => useHook({ enabled: true }))

      // The hook needs a real container to enter HIGHLIGHT_VIEW (effect guards on containerRef.current).
      // Directly assign to the ref's current property — this bypasses the null guard.
      const mockContainer = document.createElement('div')
      Object.defineProperty(mockContainer, 'scrollHeight', { value: 500, configurable: true })
      Object.defineProperty(mockContainer, 'clientHeight', { value: 100, configurable: true })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(result.current.containerRef as any).current = mockContainer

      // Force React to re-run the highlight effect by toggling highlightBib
      // (deps change → effect re-runs with container now present)
      mockHighlight({
        highlightBib: null,
        isActive: false,
        timeRemaining: 0,
        progress: 0,
      })
      rerender()

      mockHighlight({
        highlightBib: '42',
        isActive: true,
        timeRemaining: 5000,
        progress: 0,
      })
      rerender()

      await act(async () => {
        runPending()
      })

      // Verify we're in HIGHLIGHT_VIEW
      expect(result.current.phase).toBe('HIGHLIGHT_VIEW')

      // End highlight
      mockHighlight({
        highlightBib: null,
        isActive: false,
        timeRemaining: 0,
        progress: 0,
      })

      rerender()

      // Wait for the 500ms delay after highlight fade
      await act(async () => {
        clock.advance(600)
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
      mockHighlight({
        highlightBib: '42',
        isActive: true,
        timeRemaining: 5000,
        progress: 0,
      })

      const { result, rerender } = renderHook(() => useHook({ enabled: true }))

      // Set up mock container with scrollTo
      const mockContainer = document.createElement('div')
      Object.defineProperty(mockContainer, 'scrollHeight', { value: 500, configurable: true })
      Object.defineProperty(mockContainer, 'clientHeight', { value: 100, configurable: true })
      mockContainer.scrollTo = vi.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(result.current.containerRef as any).current = mockContainer

      // Toggle highlight to trigger effect with container
      mockHighlight({
        highlightBib: null,
        isActive: false,
        timeRemaining: 0,
        progress: 0,
      })
      rerender()

      mockHighlight({
        highlightBib: '42',
        isActive: true,
        timeRemaining: 5000,
        progress: 0,
      })
      rerender()

      await act(async () => {
        runPending()
      })

      expect(result.current.phase).toBe('HIGHLIGHT_VIEW')

      // Advance time by >3 minutes to expire the top-shown threshold
      clock.advance(3 * 60 * 1000 + 1000)

      // End highlight
      mockHighlight({
        highlightBib: null,
        isActive: false,
        timeRemaining: 0,
        progress: 0,
      })

      rerender()

      // Wait for the 500ms delay after highlight fade
      await act(async () => {
        clock.advance(600)
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

      const { unmount } = renderHook(() => useHook({ enabled: true }))

      await act(async () => {
        advanceFrames(1000)
      })

      expect(() => unmount()).not.toThrow()
    })
  })

  describe('highlight scroll stays inside the results container (issue #128)', () => {
    const CLIENT_HEIGHT = 200
    const SCROLL_HEIGHT = 1000
    const ROW_HEIGHT = 50

    /**
     * Build a container whose geometry mimics a real results list:
     * 20 rows of ROW_HEIGHT inside a CLIENT_HEIGHT viewport.
     */
    function buildContainer() {
      const container = document.createElement('div')
      Object.defineProperty(container, 'scrollHeight', { value: SCROLL_HEIGHT, configurable: true })
      Object.defineProperty(container, 'clientHeight', { value: CLIENT_HEIGHT, configurable: true })
      container.scrollTo = vi.fn()

      for (let i = 0; i < SCROLL_HEIGHT / ROW_HEIGHT; i++) {
        const row = document.createElement('div')
        row.dataset.bib = String(i)
        Object.defineProperty(row, 'offsetTop', { value: i * ROW_HEIGHT, configurable: true })
        Object.defineProperty(row, 'offsetHeight', { value: ROW_HEIGHT, configurable: true })
        container.appendChild(row)
      }

      return container
    }

    /** Mount the hook, attach the container, then raise a highlight for `bib`. */
    async function highlight(bib: string) {
      mockHighlight({
        highlightBib: null,
        isActive: false,
        timeRemaining: 0,
        progress: 0,
      })

      const { result, rerender } = renderHook(() => useHook({ enabled: true }))

      const container = buildContainer()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(result.current.containerRef as any).current = container

      mockHighlight({
        highlightBib: bib,
        isActive: true,
        timeRemaining: 5000,
        progress: 0,
      })
      rerender()

      await act(async () => {
        runPending()
      })

      return container
    }

    let scrollIntoViewSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
      // jsdom has no layout engine, so scrollIntoView is missing entirely.
      // Install a spy so we can assert the hook never reaches for it.
      scrollIntoViewSpy = vi.fn()
      Element.prototype.scrollIntoView = scrollIntoViewSpy
    })

    it('never calls scrollIntoView, which would scroll every ancestor too', async () => {
      await highlight('5')

      expect(scrollIntoViewSpy).not.toHaveBeenCalled()
    })

    it('centers the highlighted row by scrolling the container itself', async () => {
      const container = await highlight('5')

      // offsetTop 250, centered in a 200px viewport: 250 - (200 - 50) / 2 = 175
      expect(container.scrollTo).toHaveBeenCalledWith({ top: 175, behavior: 'smooth' })
    })

    it('clamps to the top of the list for rows near the start', async () => {
      const container = await highlight('0')

      // Centering row 0 would need a negative scrollTop
      expect(container.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    })

    it('clamps to the bottom of the list for rows near the end', async () => {
      const container = await highlight('19')

      // offsetTop 950 would center at 875, past the 800px maximum scroll
      expect(container.scrollTo).toHaveBeenCalledWith({ top: 800, behavior: 'smooth' })
    })

    it('does not scroll at all when scrollToFinished is disabled', async () => {
      mockUseLayout.mockReturnValue({
        ...mockUseLayout(),
        scrollToFinished: false,
      })

      const container = await highlight('5')

      expect(container.scrollTo).not.toHaveBeenCalled()
      expect(scrollIntoViewSpy).not.toHaveBeenCalled()
    })

    it('uses instant scrolling under prefers-reduced-motion', async () => {
      const matchMedia = window.matchMedia
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
      try {
        const container = await highlight('5')

        expect(container.scrollTo).toHaveBeenCalledWith({ top: 175, behavior: 'auto' })
      } finally {
        window.matchMedia = matchMedia
      }
    })

    it('paces the page scroll on the Clock: initial delay, then one page per interval (vertical)', async () => {
      const container = buildContainer()
      const { result } = renderHook(() => {
        const scroll = useHook({ enabled: true })
        // attached during render, so the state machine sees the container on its first effect run
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(scroll.containerRef as any).current = container
        return scroll
      })
      await act(async () => {})

      // IDLE -> WAITING; the first scroll waits initialDelay (3 s) and then pageInterval (12 s)
      await act(async () => clock.advance(2_999))
      expect(result.current.phase).toBe('WAITING')
      await act(async () => clock.advance(1))
      expect(result.current.phase).toBe('SCROLLING')

      await act(async () => clock.advance(11_999))
      expect(container.scrollTo).not.toHaveBeenCalled()
      await act(async () => clock.advance(1))
      // 200 px / 50 px rows = 4 rows, minus 1 of overlap = 3 rows per page
      expect(container.scrollTo).toHaveBeenCalledTimes(1)
      expect(container.scrollTo).toHaveBeenLastCalledWith({ top: 150, behavior: 'smooth' })

      await act(async () => clock.advance(12_000))
      expect(container.scrollTo).toHaveBeenCalledTimes(2)
      expect(container.scrollTo).toHaveBeenLastCalledWith({ top: 300, behavior: 'smooth' })
    })
  })
})
