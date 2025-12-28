import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLayout, type LayoutMode } from '../useLayout'

describe('useLayout', () => {
  const originalInnerWidth = window.innerWidth
  const originalInnerHeight = window.innerHeight
  const originalLocation = window.location

  beforeEach(() => {
    vi.useFakeTimers()

    // Reset window dimensions to default vertical layout
    Object.defineProperty(window, 'innerWidth', {
      value: 1080,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window, 'innerHeight', {
      value: 1920,
      writable: true,
      configurable: true,
    })

    // Mock location.search
    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        search: '',
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()

    // Restore original values
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window, 'innerHeight', {
      value: originalInnerHeight,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    })

    // Clean up CSS variables
    document.documentElement.style.removeProperty('--row-height')
    document.documentElement.style.removeProperty('--visible-rows')
    document.documentElement.style.removeProperty('--header-height')
    document.documentElement.style.removeProperty('--footer-height')
    document.documentElement.style.removeProperty('--layout-mode')
  })

  describe('URL parameter detection', () => {
    it('detects ?type=vertical from URL', () => {
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, search: '?type=vertical' },
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      expect(result.current.layoutMode).toBe('vertical')
    })

    it('detects ?type=ledwall from URL', () => {
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, search: '?type=ledwall' },
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      expect(result.current.layoutMode).toBe('ledwall')
    })

    it('ignores invalid ?type values and uses auto-detection', () => {
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, search: '?type=invalid' },
        writable: true,
        configurable: true,
      })

      // With 1080x1920, aspect ratio is 0.5625 < 1.5, so vertical
      const { result } = renderHook(() => useLayout())

      expect(result.current.layoutMode).toBe('vertical')
    })

    it('URL parameter overrides auto-detection', () => {
      // Set ledwall dimensions (2:1 aspect ratio)
      Object.defineProperty(window, 'innerWidth', {
        value: 768,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 384,
        writable: true,
        configurable: true,
      })

      // But URL says vertical
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, search: '?type=vertical' },
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      // URL parameter wins
      expect(result.current.layoutMode).toBe('vertical')
    })
  })

  describe('aspect ratio auto-detection', () => {
    it('detects vertical layout for portrait displays (height > width)', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 1080,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 1920,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      expect(result.current.layoutMode).toBe('vertical')
    })

    it('detects ledwall layout for wide displays (aspect ratio >= 1.5)', () => {
      // Aspect ratio 768/384 = 2.0 >= 1.5
      Object.defineProperty(window, 'innerWidth', {
        value: 768,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 384,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      expect(result.current.layoutMode).toBe('ledwall')
    })

    it('detects ledwall for ultra-wide display (1920x480)', () => {
      // Aspect ratio 1920/480 = 4.0 >= 1.5
      Object.defineProperty(window, 'innerWidth', {
        value: 1920,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 480,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      expect(result.current.layoutMode).toBe('ledwall')
    })

    it('detects vertical for near-square displays (aspect ratio < 1.5)', () => {
      // Aspect ratio 1280/1024 = 1.25 < 1.5
      Object.defineProperty(window, 'innerWidth', {
        value: 1280,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 1024,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      expect(result.current.layoutMode).toBe('vertical')
    })

    it('handles boundary case at exactly 1.5 aspect ratio', () => {
      // Aspect ratio 1500/1000 = 1.5 (exactly at boundary)
      Object.defineProperty(window, 'innerWidth', {
        value: 1500,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 1000,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      // >= 1.5 is ledwall
      expect(result.current.layoutMode).toBe('ledwall')
    })
  })

  describe('row height calculations', () => {
    it('calculates visibleRows within min/max bounds for vertical', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 1080,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 1920,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      // Vertical: minVisibleRows = 8, maxVisibleRows = 25
      expect(result.current.visibleRows).toBeGreaterThanOrEqual(8)
      expect(result.current.visibleRows).toBeLessThanOrEqual(25)
    })

    it('calculates visibleRows within min/max bounds for ledwall', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 768,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 384,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      // Ledwall: minVisibleRows = 3, maxVisibleRows = 8
      expect(result.current.visibleRows).toBeGreaterThanOrEqual(3)
      expect(result.current.visibleRows).toBeLessThanOrEqual(8)
    })

    it('calculates rowHeight within min/max bounds for vertical', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 1080,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 1920,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      // Vertical: minRowHeight = 44, maxRowHeight = 56
      expect(result.current.rowHeight).toBeGreaterThanOrEqual(44)
      expect(result.current.rowHeight).toBeLessThanOrEqual(56)
    })

    it('calculates rowHeight within min/max bounds for ledwall', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 768,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 384,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      // Ledwall: minRowHeight = 50, maxRowHeight = 64
      expect(result.current.rowHeight).toBeGreaterThanOrEqual(50)
      expect(result.current.rowHeight).toBeLessThanOrEqual(64)
    })

    it('handles very small viewport gracefully', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 320,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 240,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      // Should not crash, should use minimum values
      expect(result.current.visibleRows).toBeGreaterThanOrEqual(3)
      expect(result.current.rowHeight).toBeGreaterThan(0)
    })
  })

  describe('CSS variable updates', () => {
    it('sets --row-height CSS variable', () => {
      const { result } = renderHook(() => useLayout())

      const rowHeight = document.documentElement.style.getPropertyValue('--row-height')
      expect(rowHeight).toBe(`${result.current.rowHeight}px`)
    })

    it('sets --visible-rows CSS variable', () => {
      const { result } = renderHook(() => useLayout())

      const visibleRows = document.documentElement.style.getPropertyValue('--visible-rows')
      expect(visibleRows).toBe(String(result.current.visibleRows))
    })

    it('sets --header-height CSS variable', () => {
      const { result } = renderHook(() => useLayout())

      const headerHeight = document.documentElement.style.getPropertyValue('--header-height')
      expect(headerHeight).toBe(`${result.current.headerHeight}px`)
    })

    it('sets --footer-height CSS variable', () => {
      const { result } = renderHook(() => useLayout())

      const footerHeight = document.documentElement.style.getPropertyValue('--footer-height')
      expect(footerHeight).toBe(`${result.current.footerHeight}px`)
    })

    it('sets --layout-mode CSS variable', () => {
      const { result } = renderHook(() => useLayout())

      const layoutMode = document.documentElement.style.getPropertyValue('--layout-mode')
      expect(layoutMode).toBe(result.current.layoutMode)
    })

    it('updates CSS variables when layout changes', async () => {
      // Start with vertical layout
      Object.defineProperty(window, 'innerWidth', {
        value: 1080,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 1920,
        writable: true,
        configurable: true,
      })

      const { result, rerender } = renderHook(() => useLayout())

      const initialLayoutMode = document.documentElement.style.getPropertyValue('--layout-mode')
      expect(initialLayoutMode).toBe('vertical')

      // Change to ledwall dimensions
      Object.defineProperty(window, 'innerWidth', {
        value: 768,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 384,
        writable: true,
        configurable: true,
      })

      // Trigger resize event
      await act(async () => {
        window.dispatchEvent(new Event('resize'))
        vi.advanceTimersByTime(100) // debounce time
      })

      rerender()

      const updatedLayoutMode = document.documentElement.style.getPropertyValue('--layout-mode')
      expect(updatedLayoutMode).toBe('ledwall')
    })
  })

  describe('footer visibility', () => {
    it('shows footer for vertical layout', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 1080,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 1920,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      expect(result.current.showFooter).toBe(true)
      expect(result.current.footerHeight).toBeGreaterThan(0)
    })

    it('hides footer for ledwall layout', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 768,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 384,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      expect(result.current.showFooter).toBe(false)
      expect(result.current.footerHeight).toBe(0)
    })
  })

  describe('font size category', () => {
    it('returns "small" for vertical layout with height < 1200', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 720,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 1000,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      expect(result.current.fontSizeCategory).toBe('small')
    })

    it('returns "medium" for vertical layout with 1200 <= height < 1600', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 720,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 1400,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      expect(result.current.fontSizeCategory).toBe('medium')
    })

    it('returns "large" for vertical layout with height >= 1600', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 1080,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 1920,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      expect(result.current.fontSizeCategory).toBe('large')
    })

    it('returns "medium" for ledwall with height < 400', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 768,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 384,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      expect(result.current.fontSizeCategory).toBe('medium')
    })

    it('returns "large" for ledwall with height >= 400', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 1920,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 480,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      expect(result.current.fontSizeCategory).toBe('large')
    })
  })

  describe('resize handling', () => {
    it('updates viewport dimensions on resize', async () => {
      const { result } = renderHook(() => useLayout())

      const initialWidth = result.current.viewportWidth
      const initialHeight = result.current.viewportHeight

      // Change window dimensions
      Object.defineProperty(window, 'innerWidth', {
        value: 1200,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 800,
        writable: true,
        configurable: true,
      })

      // Trigger resize
      await act(async () => {
        window.dispatchEvent(new Event('resize'))
        vi.advanceTimersByTime(100) // debounce time
      })

      expect(result.current.viewportWidth).toBe(1200)
      expect(result.current.viewportHeight).toBe(800)
    })

    it('debounces resize events (100ms)', async () => {
      const { result } = renderHook(() => useLayout())

      // Change dimensions
      Object.defineProperty(window, 'innerWidth', {
        value: 800,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 600,
        writable: true,
        configurable: true,
      })

      // Trigger resize but don't wait full debounce time
      await act(async () => {
        window.dispatchEvent(new Event('resize'))
        vi.advanceTimersByTime(50) // Only 50ms
      })

      // Should still have old dimensions
      expect(result.current.viewportWidth).toBe(1080)
      expect(result.current.viewportHeight).toBe(1920)

      // Wait remaining debounce time
      await act(async () => {
        vi.advanceTimersByTime(50)
      })

      // Now should have new dimensions
      expect(result.current.viewportWidth).toBe(800)
      expect(result.current.viewportHeight).toBe(600)
    })

    it('cleans up resize listener on unmount', async () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

      const { unmount } = renderHook(() => useLayout())

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))

      removeEventListenerSpy.mockRestore()
    })
  })

  describe('header height', () => {
    it('uses correct header height for vertical layout', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 1080,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 1920,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      // Vertical header height is 100
      expect(result.current.headerHeight).toBe(100)
    })

    it('uses correct header height for ledwall layout', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 768,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 384,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      // Ledwall header height is 60
      expect(result.current.headerHeight).toBe(60)
    })
  })

  describe('return value structure', () => {
    it('returns all expected properties', () => {
      const { result } = renderHook(() => useLayout())

      expect(result.current).toHaveProperty('layoutMode')
      expect(result.current).toHaveProperty('viewportWidth')
      expect(result.current).toHaveProperty('viewportHeight')
      expect(result.current).toHaveProperty('visibleRows')
      expect(result.current).toHaveProperty('rowHeight')
      expect(result.current).toHaveProperty('showFooter')
      expect(result.current).toHaveProperty('headerHeight')
      expect(result.current).toHaveProperty('footerHeight')
      expect(result.current).toHaveProperty('fontSizeCategory')
    })

    it('returns correct types', () => {
      const { result } = renderHook(() => useLayout())

      expect(['vertical', 'ledwall']).toContain(result.current.layoutMode)
      expect(typeof result.current.viewportWidth).toBe('number')
      expect(typeof result.current.viewportHeight).toBe('number')
      expect(typeof result.current.visibleRows).toBe('number')
      expect(typeof result.current.rowHeight).toBe('number')
      expect(typeof result.current.showFooter).toBe('boolean')
      expect(typeof result.current.headerHeight).toBe('number')
      expect(typeof result.current.footerHeight).toBe('number')
      expect(['small', 'medium', 'large']).toContain(result.current.fontSizeCategory)
    })
  })

  describe('edge cases', () => {
    it('handles zero dimensions gracefully', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 0,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 0,
        writable: true,
        configurable: true,
      })

      // Should not throw
      expect(() => renderHook(() => useLayout())).not.toThrow()
    })

    it('handles very large dimensions', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 10000,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 20000,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useLayout())

      // Should still respect max bounds
      expect(result.current.visibleRows).toBeLessThanOrEqual(25)
      expect(result.current.rowHeight).toBeLessThanOrEqual(56)
    })

    it('handles rapid resize events', async () => {
      const { result } = renderHook(() => useLayout())

      // Rapid resize events
      for (let i = 0; i < 10; i++) {
        Object.defineProperty(window, 'innerWidth', {
          value: 500 + i * 100,
          writable: true,
          configurable: true,
        })
        Object.defineProperty(window, 'innerHeight', {
          value: 800 + i * 100,
          writable: true,
          configurable: true,
        })

        await act(async () => {
          window.dispatchEvent(new Event('resize'))
          vi.advanceTimersByTime(10) // Less than debounce
        })
      }

      // Wait for debounce to complete
      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      // Should have last set dimensions
      expect(result.current.viewportWidth).toBe(1400)
      expect(result.current.viewportHeight).toBe(1700)
    })
  })
})
