import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OnCourseDisplay } from '../OnCourseDisplay'
import type { OnCourseCompetitor } from '@/types'

// Mock useLayout hook
vi.mock('@/hooks', () => ({
  useLayout: () => ({
    layoutMode: 'vertical' as const,
    visibleRows: 10,
    rowHeight: 48,
    fontSize: 16,
    showFooter: true,
    disableScroll: false,
  }),
}))

/**
 * Factory function to create test competitor data
 */
function createCompetitor(
  overrides: Partial<OnCourseCompetitor> = {}
): OnCourseCompetitor {
  return {
    bib: '42',
    name: 'NOVAK Jiri',
    club: 'USK Praha',
    nat: 'CZE',
    raceId: 'R1',
    time: '95.50',
    total: '97.50',
    pen: 2,
    gates: '0,0,2,0,0',
    dtStart: '2025-12-28T10:00:00',
    dtFinish: null,
    ttbDiff: '-1.50',
    ttbName: 'PRSKAVEC Jiri',
    rank: 1,
    ...overrides,
  }
}

/**
 * Helper to check if element has a class containing substring
 * (CSS modules hash class names, so we check for substrings)
 */
function hasClassContaining(element: Element, substring: string): boolean {
  return element.className.includes(substring)
}

describe('OnCourseDisplay', () => {
  describe('rendering', () => {
    it('renders data-testid "oncourse-display"', () => {
      const competitors = [createCompetitor()]
      render(<OnCourseDisplay competitors={competitors} />)

      expect(screen.getByTestId('oncourse-display')).toBeInTheDocument()
    })

    it('renders nothing when competitors array is empty', () => {
      const { container } = render(<OnCourseDisplay competitors={[]} />)

      expect(container.firstChild).toBeNull()
    })

    it('renders nothing when visible is false', () => {
      const competitors = [createCompetitor()]
      const { container } = render(
        <OnCourseDisplay competitors={competitors} visible={false} />
      )

      expect(container.firstChild).toBeNull()
    })

    it('renders one row per competitor', () => {
      const competitors = [
        createCompetitor({ bib: '1' }),
        createCompetitor({ bib: '2' }),
        createCompetitor({ bib: '3' }),
      ]
      render(<OnCourseDisplay competitors={competitors} />)

      const rows = screen.getAllByTestId('oncourse-row')
      expect(rows.length).toBe(3)
    })

    it('renders bib number for each competitor', () => {
      const competitors = [
        createCompetitor({ bib: '42' }),
        createCompetitor({ bib: '123' }),
      ]
      render(<OnCourseDisplay competitors={competitors} />)

      expect(screen.getByText('42')).toBeInTheDocument()
      expect(screen.getByText('123')).toBeInTheDocument()
    })

    it('renders formatted name for each competitor', () => {
      const competitors = [
        createCompetitor({ bib: '1', name: 'NOVAK Jiri' }),
        createCompetitor({ bib: '2', name: 'PRSKAVEC Jakub' }),
      ]
      render(<OnCourseDisplay competitors={competitors} />)

      expect(screen.getByText('NOVAK Jiri')).toBeInTheDocument()
      expect(screen.getByText('PRSKAVEC Jakub')).toBeInTheDocument()
    })

    it('renders time for each competitor', () => {
      const competitors = [createCompetitor({ total: '95.50' })]
      render(<OnCourseDisplay competitors={competitors} />)

      expect(screen.getByText('95.50')).toBeInTheDocument()
    })
  })

  describe('filtering', () => {
    it('excludes competitor with excludeBib', () => {
      const competitors = [
        createCompetitor({ bib: '101', gates: '' }),
        createCompetitor({ bib: '102', gates: '' }),
        createCompetitor({ bib: '103', gates: '' }),
      ]
      render(<OnCourseDisplay competitors={competitors} excludeBib="102" />)

      const rows = screen.getAllByTestId('oncourse-row')
      expect(rows.length).toBe(2)
      expect(screen.getByText('101')).toBeInTheDocument()
      expect(screen.queryByText('102')).not.toBeInTheDocument()
      expect(screen.getByText('103')).toBeInTheDocument()
    })

    it('filters out competitors with zero time', () => {
      const competitors = [
        createCompetitor({ bib: '1', total: '95.50' }),
        createCompetitor({ bib: '2', total: '0:00.00' }),
        createCompetitor({ bib: '3', total: '0.00' }),
        createCompetitor({ bib: '4', total: '0' }),
      ]
      render(<OnCourseDisplay competitors={competitors} />)

      const rows = screen.getAllByTestId('oncourse-row')
      expect(rows.length).toBe(1)
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('filters out competitors with empty time', () => {
      const competitors = [
        createCompetitor({ bib: '1', total: '95.50', time: '95.50' }),
        createCompetitor({ bib: '2', total: '', time: '' }),
      ]
      render(<OnCourseDisplay competitors={competitors} />)

      const rows = screen.getAllByTestId('oncourse-row')
      expect(rows.length).toBe(1)
    })

    it('uses time if total is empty', () => {
      const competitors = [
        createCompetitor({ bib: '1', total: '', time: '95.50' }),
      ]
      render(<OnCourseDisplay competitors={competitors} />)

      expect(screen.getByText('95.50')).toBeInTheDocument()
    })

    it('renders nothing if all competitors are filtered', () => {
      const competitors = [
        createCompetitor({ bib: '1', total: '0:00.00' }),
        createCompetitor({ bib: '2', total: '0' }),
      ]
      const { container } = render(
        <OnCourseDisplay competitors={competitors} />
      )

      expect(container.firstChild).toBeNull()
    })
  })

  describe('running indicator', () => {
    it('shows running indicator for each competitor', () => {
      const competitors = [createCompetitor(), createCompetitor({ bib: '2' })]
      const { container } = render(
        <OnCourseDisplay competitors={competitors} />
      )

      // The running indicator is ► (U+25B8)
      const indicators = container.querySelectorAll(
        '[class*="runningIndicator"]'
      )
      expect(indicators.length).toBe(2)
      expect(indicators[0].textContent).toBe('►')
    })
  })

  describe('penalty display', () => {
    it('renders total penalty for each competitor', () => {
      const competitors = [
        createCompetitor({ bib: '100', pen: 4, gates: '' }),
        createCompetitor({ bib: '101', pen: 52, gates: '' }),
      ]
      const { container } = render(
        <OnCourseDisplay competitors={competitors} />
      )

      // Check penalty div elements exist in gates containers
      const gatesContainers = container.querySelectorAll('[class*="gatesContainer"]')
      expect(gatesContainers.length).toBe(2)
      const penDivs = container.querySelectorAll('div[class*="pen"]:not([class*="gatePenalty"])')
      expect(penDivs.length).toBe(2)
      expect(penDivs[0].textContent).toBe('4')
      expect(penDivs[1].textContent).toBe('52')
    })

    it('applies hasPenalty class for non-zero penalty', () => {
      const competitors = [createCompetitor({ pen: 2, gates: '' })]
      const { container } = render(
        <OnCourseDisplay competitors={competitors} />
      )

      // Find the pen element inside gatesContainer - it's the div after gatePenalty spans
      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      const penDiv = gatesContainer?.querySelector('div[class*="pen"]')
      expect(penDiv).not.toBeNull()
      expect(hasClassContaining(penDiv!, 'hasPenalty')).toBe(true)
    })

    it('applies noPenalty class for zero penalty', () => {
      const competitors = [createCompetitor({ pen: 0, gates: '' })]
      const { container } = render(
        <OnCourseDisplay competitors={competitors} />
      )

      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      const penDiv = gatesContainer?.querySelector('div[class*="pen"]')
      expect(penDiv).not.toBeNull()
      expect(hasClassContaining(penDiv!, 'noPenalty')).toBe(true)
    })
  })

  describe('gate penalties', () => {
    it('shows only gates with penalties (2s or 50s)', () => {
      const competitors = [createCompetitor({ gates: '0,2,0,50,0' })]
      const { container } = render(
        <OnCourseDisplay competitors={competitors} />
      )

      // Only gates 2 (2s penalty) and 4 (50s penalty) should be shown
      const gatePenalties = container.querySelectorAll(
        '[class*="gatePenalty"]'
      )
      expect(gatePenalties.length).toBe(2)
      expect(gatePenalties[0].textContent).toBe('2') // Gate number
      expect(gatePenalties[1].textContent).toBe('4') // Gate number
    })

    it('applies penalty2 class for 2s penalty gates', () => {
      const competitors = [createCompetitor({ gates: '0,2,0' })]
      const { container } = render(
        <OnCourseDisplay competitors={competitors} />
      )

      const gatePenalty = container.querySelector('[class*="gatePenalty"]')
      expect(gatePenalty).not.toBeNull()
      expect(hasClassContaining(gatePenalty!, 'penalty2')).toBe(true)
    })

    it('applies penalty50 class for 50s penalty gates', () => {
      const competitors = [createCompetitor({ gates: '0,50,0' })]
      const { container } = render(
        <OnCourseDisplay competitors={competitors} />
      )

      const gatePenalty = container.querySelector('[class*="gatePenalty"]')
      expect(gatePenalty).not.toBeNull()
      expect(hasClassContaining(gatePenalty!, 'penalty50')).toBe(true)
    })

    it('shows no gate penalties when all gates are clean', () => {
      const competitors = [createCompetitor({ gates: '0,0,0,0,0' })]
      const { container } = render(
        <OnCourseDisplay competitors={competitors} />
      )

      const gatePenalties = container.querySelectorAll(
        '[class*="gatePenalty"]'
      )
      expect(gatePenalties.length).toBe(0)
    })
  })

  describe('visibility', () => {
    it('renders when visible is true (default)', () => {
      const competitors = [createCompetitor()]
      render(<OnCourseDisplay competitors={competitors} />)

      expect(screen.getByTestId('oncourse-display')).toBeInTheDocument()
    })

    it('renders when visible is explicitly true', () => {
      const competitors = [createCompetitor()]
      render(<OnCourseDisplay competitors={competitors} visible={true} />)

      expect(screen.getByTestId('oncourse-display')).toBeInTheDocument()
    })

    it('renders nothing when visible is false', () => {
      const competitors = [createCompetitor()]
      const { container } = render(
        <OnCourseDisplay competitors={competitors} visible={false} />
      )

      expect(container.firstChild).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('handles null competitors array', () => {
      // @ts-expect-error Testing runtime null handling
      const { container } = render(<OnCourseDisplay competitors={null} />)

      expect(container.firstChild).toBeNull()
    })

    it('handles undefined competitors array', () => {
      // @ts-expect-error Testing runtime undefined handling
      const { container } = render(<OnCourseDisplay competitors={undefined} />)

      expect(container.firstChild).toBeNull()
    })

    it('handles competitor with empty name', () => {
      const competitors = [createCompetitor({ name: '' })]
      render(<OnCourseDisplay competitors={competitors} />)

      expect(screen.getByTestId('oncourse-display')).toBeInTheDocument()
    })

    it('handles competitor with very long name', () => {
      const competitors = [
        createCompetitor({
          name: 'SUPERLONGFAMILYNAME VeryLongGivenNameThatShouldBeTruncated',
        }),
      ]
      render(<OnCourseDisplay competitors={competitors} />)

      expect(screen.getByTestId('oncourse-display')).toBeInTheDocument()
    })

    it('handles competitor with empty gates string', () => {
      const competitors = [createCompetitor({ gates: '' })]
      const { container } = render(
        <OnCourseDisplay competitors={competitors} />
      )

      const gatePenalties = container.querySelectorAll(
        '[class*="gatePenalty"]'
      )
      expect(gatePenalties.length).toBe(0)
    })

    it('handles competitor with many gates', () => {
      // 25 gates with some penalties
      const gatesStr = Array(25)
        .fill(0)
        .map((_, i) => (i % 5 === 2 ? 2 : 0))
        .join(',')
      const competitors = [createCompetitor({ gates: gatesStr })]
      const { container } = render(
        <OnCourseDisplay competitors={competitors} />
      )

      // Should show 5 gate penalties (at positions 2, 7, 12, 17, 22)
      const gatePenalties = container.querySelectorAll(
        '[class*="gatePenalty"]'
      )
      expect(gatePenalties.length).toBe(5)
    })

    it('handles many competitors', () => {
      const competitors = Array(10)
        .fill(null)
        .map((_, i) => createCompetitor({ bib: String(i + 1) }))
      render(<OnCourseDisplay competitors={competitors} />)

      const rows = screen.getAllByTestId('oncourse-row')
      expect(rows.length).toBe(10)
    })
  })

  describe('layout mode', () => {
    it('applies layout mode class to rows', () => {
      const competitors = [createCompetitor()]
      const { container } = render(
        <OnCourseDisplay competitors={competitors} />
      )

      const row = container.querySelector('[class*="row"]')
      expect(row).not.toBeNull()
      expect(hasClassContaining(row!, 'vertical')).toBe(true)
    })
  })
})
