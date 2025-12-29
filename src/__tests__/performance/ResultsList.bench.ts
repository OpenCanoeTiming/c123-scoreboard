/**
 * Performance benchmark tests for ResultsList component
 *
 * Run with: npx vitest bench --reporter=verbose
 *
 * These tests measure render time and DOM update performance
 * for different numbers of results.
 */

import { describe, bench, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import React from 'react'
import type { Result } from '@/types'

// Mock hooks to isolate component rendering performance
let mockUseHighlight = { highlightBib: null as string | null, isActive: false, timeRemaining: 0 }
let mockUseLayout = {
  layoutMode: 'vertical' as 'vertical' | 'ledwall',
  visibleRows: 10,
  rowHeight: 48,
  fontSize: 16,
  showFooter: true
}
const mockContainerRef = { current: null }
const mockUseAutoScroll = {
  containerRef: mockContainerRef,
  phase: 'idle' as const,
  pause: () => {},
  resume: () => {},
  reset: () => {}
}

// Mock the hooks before importing
vi.mock('@/hooks/useHighlight', () => ({
  useHighlight: () => mockUseHighlight
}))

vi.mock('@/hooks/useLayout', () => ({
  useLayout: () => mockUseLayout
}))

vi.mock('@/hooks/useAutoScroll', () => ({
  useAutoScroll: () => mockUseAutoScroll
}))

// Import component after mocking hooks - use dynamic import
import { ResultsList } from '@/components/ResultsList/ResultsList'

/**
 * Generate mock results data
 */
function generateResults(count: number): Result[] {
  const results: Result[] = []
  for (let i = 0; i < count; i++) {
    results.push({
      rank: i + 1,
      bib: String(100 + i),
      name: `TESTOVIC Test${i}`,
      familyName: 'TESTOVIC',
      givenName: `Test${i}`,
      club: `Club ${i % 10}`,
      nat: 'CZE',
      total: `${90 + i}:${(i % 60).toString().padStart(2, '0')}.${(i % 100).toString().padStart(2, '0')}`,
      pen: i % 5 === 0 ? 2 : 0,
      behind: i === 0 ? '' : `+${i}.${(i % 100).toString().padStart(2, '0')}`,
    })
  }
  return results
}

describe('ResultsList Performance Benchmarks', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockUseHighlight.highlightBib = null
    mockUseHighlight.isActive = false
  })

  afterEach(() => {
    cleanup()
  })

  describe('Initial Render Performance', () => {
    bench('render with 10 results', () => {
      const results = generateResults(10)
      const { unmount } = render(React.createElement(ResultsList, { results, visible: true }))
      unmount()
    })

    bench('render with 50 results', () => {
      const results = generateResults(50)
      const { unmount } = render(React.createElement(ResultsList, { results, visible: true }))
      unmount()
    })

    bench('render with 100 results', () => {
      const results = generateResults(100)
      const { unmount } = render(React.createElement(ResultsList, { results, visible: true }))
      unmount()
    })

    bench('render with 200 results', () => {
      const results = generateResults(200)
      const { unmount } = render(React.createElement(ResultsList, { results, visible: true }))
      unmount()
    })

    bench('render with 500 results', () => {
      const results = generateResults(500)
      const { unmount } = render(React.createElement(ResultsList, { results, visible: true }))
      unmount()
    })
  })

  describe('Re-render Performance (data update)', () => {
    bench('update from 50 to 51 results', () => {
      const results50 = generateResults(50)
      const results51 = generateResults(51)

      const { rerender, unmount } = render(
        React.createElement(ResultsList, { results: results50, visible: true })
      )
      rerender(React.createElement(ResultsList, { results: results51, visible: true }))
      unmount()
    })

    bench('update 1 result in 100 results list', () => {
      const results = generateResults(100)
      const updatedResults = [...results]
      updatedResults[50] = { ...updatedResults[50], total: '100:00.00' }

      const { rerender, unmount } = render(
        React.createElement(ResultsList, { results, visible: true })
      )
      rerender(React.createElement(ResultsList, { results: updatedResults, visible: true }))
      unmount()
    })

    bench('reorder all 100 results', () => {
      const results = generateResults(100)
      const reversed = [...results].reverse()

      const { rerender, unmount } = render(
        React.createElement(ResultsList, { results, visible: true })
      )
      rerender(React.createElement(ResultsList, { results: reversed, visible: true }))
      unmount()
    })
  })

  describe('Highlight Performance', () => {
    bench('activate highlight in 100 results', () => {
      const results = generateResults(100)

      const { rerender, unmount } = render(
        React.createElement(ResultsList, { results, visible: true })
      )

      // Activate highlight for middle result
      mockUseHighlight.highlightBib = '150'
      mockUseHighlight.isActive = true

      rerender(React.createElement(ResultsList, { results, visible: true }))

      // Reset
      mockUseHighlight.highlightBib = null
      mockUseHighlight.isActive = false

      unmount()
    })

    bench('deactivate highlight in 100 results', () => {
      const results = generateResults(100)

      mockUseHighlight.highlightBib = '150'
      mockUseHighlight.isActive = true

      const { rerender, unmount } = render(
        React.createElement(ResultsList, { results, visible: true })
      )

      // Deactivate highlight
      mockUseHighlight.highlightBib = null
      mockUseHighlight.isActive = false

      rerender(React.createElement(ResultsList, { results, visible: true }))
      unmount()
    })
  })

  describe('Visibility Toggle Performance', () => {
    bench('toggle visibility on 100 results', () => {
      const results = generateResults(100)

      const { rerender, unmount } = render(
        React.createElement(ResultsList, { results, visible: true })
      )
      rerender(React.createElement(ResultsList, { results, visible: false }))
      rerender(React.createElement(ResultsList, { results, visible: true }))
      unmount()
    })
  })

  describe('Layout Mode Switch Performance', () => {
    bench('switch from vertical to ledwall layout (100 results)', () => {
      const results = generateResults(100)

      const { rerender, unmount } = render(
        React.createElement(ResultsList, { results, visible: true })
      )

      // Simulate layout mode change
      mockUseLayout.layoutMode = 'ledwall'

      rerender(React.createElement(ResultsList, { results, visible: true }))

      // Reset
      mockUseLayout.layoutMode = 'vertical'

      unmount()
    })
  })

  describe('Empty State Performance', () => {
    bench('render empty list', () => {
      const { unmount } = render(
        React.createElement(ResultsList, { results: [], visible: true })
      )
      unmount()
    })

    bench('transition from empty to 50 results', () => {
      const results = generateResults(50)

      const { rerender, unmount } = render(
        React.createElement(ResultsList, { results: [], visible: true })
      )
      rerender(React.createElement(ResultsList, { results, visible: true }))
      unmount()
    })

    bench('transition from 50 results to empty', () => {
      const results = generateResults(50)

      const { rerender, unmount } = render(
        React.createElement(ResultsList, { results, visible: true })
      )
      rerender(React.createElement(ResultsList, { results: [], visible: true }))
      unmount()
    })
  })
})
