import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CurrentCompetitor } from '../CurrentCompetitor'
import type { OnCourseCompetitor } from '@/types'

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

describe('CurrentCompetitor', () => {
  describe('rendering', () => {
    it('renders data-testid "oncourse"', () => {
      const competitor = createCompetitor()
      render(<CurrentCompetitor competitor={competitor} />)

      expect(screen.getByTestId('oncourse')).toBeInTheDocument()
    })

    it('renders hidden container when competitor is null', () => {
      const { container } = render(<CurrentCompetitor competitor={null} />)

      const element = container.firstChild as HTMLElement
      expect(hasClassContaining(element, 'hidden')).toBe(true)
    })

    it('renders bib number prominently', () => {
      const competitor = createCompetitor({ bib: '123' })
      render(<CurrentCompetitor competitor={competitor} />)

      expect(screen.getByText('123')).toBeInTheDocument()
    })

    it('renders formatted name', () => {
      const competitor = createCompetitor({ name: 'NOVAK Jiri' })
      render(<CurrentCompetitor competitor={competitor} />)

      expect(screen.getByText('NOVAK Jiri')).toBeInTheDocument()
    })

    it('renders club name', () => {
      const competitor = createCompetitor({ club: 'USK Praha' })
      render(<CurrentCompetitor competitor={competitor} />)

      expect(screen.getByText('USK Praha')).toBeInTheDocument()
    })

    it('renders time', () => {
      const competitor = createCompetitor({ time: '95.50' })
      render(<CurrentCompetitor competitor={competitor} />)

      // formatTime converts 95.50 to 1:35.50
      expect(screen.getByText('1:35.50')).toBeInTheDocument()
    })
  })

  describe('visibility', () => {
    it('applies hidden class when visible is false', () => {
      const competitor = createCompetitor()
      render(<CurrentCompetitor competitor={competitor} visible={false} />)

      const container = screen.getByTestId('oncourse')
      expect(hasClassContaining(container, 'hidden')).toBe(true)
    })

    it('does not apply hidden class when visible is true', () => {
      const competitor = createCompetitor()
      render(<CurrentCompetitor competitor={competitor} visible={true} />)

      const container = screen.getByTestId('oncourse')
      expect(hasClassContaining(container, 'hidden')).toBe(false)
    })

    it('defaults visible to true', () => {
      const competitor = createCompetitor()
      render(<CurrentCompetitor competitor={competitor} />)

      const container = screen.getByTestId('oncourse')
      expect(hasClassContaining(container, 'hidden')).toBe(false)
    })
  })

  describe('running indicator', () => {
    it('shows running indicator when competitor has not finished', () => {
      const competitor = createCompetitor({ dtFinish: null })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      // The running indicator is ► (U+25B8)
      const indicator = container.querySelector('[class*="runningIndicator"]')
      expect(indicator).toBeInTheDocument()
      expect(indicator?.textContent).toBe('►')
    })

    it('does not show running indicator when competitor has finished', () => {
      const competitor = createCompetitor({
        dtFinish: '2025-12-28T10:01:35.50',
      })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const indicator = container.querySelector('[class*="runningIndicator"]')
      expect(indicator).not.toBeInTheDocument()
    })
  })

  describe('TTB display', () => {
    it('renders TTB row when ttbDiff is present', () => {
      const competitor = createCompetitor({
        ttbDiff: '-2.50',
        ttbName: 'PRSKAVEC Jiri',
      })
      render(<CurrentCompetitor competitor={competitor} />)

      expect(screen.getByText('TTB')).toBeInTheDocument()
      // formatTTBDiff converts '-2.50' to '-2.50' (keeps original format for short times)
      expect(screen.getByText('-2.50')).toBeInTheDocument()
      expect(screen.getByText('PRSKAVEC Jiri')).toBeInTheDocument()
    })

    it('applies ahead class for negative TTB diff', () => {
      const competitor = createCompetitor({ ttbDiff: '-2.50' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const ttbDiff = container.querySelector('[class*="ttbDiff"]')
      expect(ttbDiff).not.toBeNull()
      expect(hasClassContaining(ttbDiff!, 'ahead')).toBe(true)
    })

    it('applies behind class for positive TTB diff', () => {
      const competitor = createCompetitor({ ttbDiff: '+3.00' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const ttbDiff = container.querySelector('[class*="ttbDiff"]')
      expect(ttbDiff).not.toBeNull()
      expect(hasClassContaining(ttbDiff!, 'behind')).toBe(true)
    })

    it('applies behind class for TTB diff without sign (positive)', () => {
      const competitor = createCompetitor({ ttbDiff: '1.50' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const ttbDiff = container.querySelector('[class*="ttbDiff"]')
      expect(ttbDiff).not.toBeNull()
      expect(hasClassContaining(ttbDiff!, 'behind')).toBe(true)
    })

    it('renders rank when present and greater than 0', () => {
      const competitor = createCompetitor({ rank: 3 })
      render(<CurrentCompetitor competitor={competitor} />)

      expect(screen.getByText('#3')).toBeInTheDocument()
    })

    it('does not render rank when rank is 0', () => {
      const competitor = createCompetitor({ rank: 0 })
      render(<CurrentCompetitor competitor={competitor} />)

      expect(screen.queryByText('#0')).not.toBeInTheDocument()
    })

    it('does not render TTB row when ttbDiff and ttbName are empty', () => {
      const competitor = createCompetitor({ ttbDiff: '', ttbName: '' })
      render(<CurrentCompetitor competitor={competitor} />)

      expect(screen.queryByText('TTB')).not.toBeInTheDocument()
    })
  })

  describe('penalty display', () => {
    it('renders total penalty', () => {
      const competitor = createCompetitor({ pen: 4 })
      render(<CurrentCompetitor competitor={competitor} />)

      expect(screen.getByText('Pen')).toBeInTheDocument()
      expect(screen.getByText('4')).toBeInTheDocument()
    })

    it('applies clear class for zero penalty', () => {
      const competitor = createCompetitor({ pen: 0 })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const penaltyValue = container.querySelector('[class*="penaltyValue"]')
      expect(penaltyValue).not.toBeNull()
      expect(hasClassContaining(penaltyValue!, 'clear')).toBe(true)
    })

    it('applies touch class for 2s penalty', () => {
      const competitor = createCompetitor({ pen: 2 })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const penaltyValue = container.querySelector('[class*="penaltyValue"]')
      expect(penaltyValue).not.toBeNull()
      expect(hasClassContaining(penaltyValue!, 'touch')).toBe(true)
    })

    it('applies touch class for 4s penalty (double touch)', () => {
      const competitor = createCompetitor({ pen: 4 })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const penaltyValue = container.querySelector('[class*="penaltyValue"]')
      expect(penaltyValue).not.toBeNull()
      expect(hasClassContaining(penaltyValue!, 'touch')).toBe(true)
    })

    it('applies miss class for 50s penalty', () => {
      const competitor = createCompetitor({ pen: 50 })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const penaltyValue = container.querySelector('[class*="penaltyValue"]')
      expect(penaltyValue).not.toBeNull()
      expect(hasClassContaining(penaltyValue!, 'miss')).toBe(true)
    })

    it('applies miss class for 100s penalty (double miss)', () => {
      const competitor = createCompetitor({ pen: 100 })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const penaltyValue = container.querySelector('[class*="penaltyValue"]')
      expect(penaltyValue).not.toBeNull()
      expect(hasClassContaining(penaltyValue!, 'miss')).toBe(true)
    })
  })

  describe('gate penalties visualization', () => {
    it('renders gate penalties from gates string', () => {
      const competitor = createCompetitor({ gates: '0,2,50,0,0' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      // Use more specific selector to get only gate elements
      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      const gates = gatesContainer?.querySelectorAll('[class*="gate"]') ?? []
      expect(gates.length).toBe(5)
    })

    it('applies clear class to gates with 0 penalty', () => {
      const competitor = createCompetitor({ gates: '0' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      const gate = gatesContainer?.querySelector('[class*="gate"]')
      expect(gate).not.toBeNull()
      expect(hasClassContaining(gate!, 'clear')).toBe(true)
      expect(gate?.textContent).toBe('0')
    })

    it('applies touch class to gates with 2s penalty', () => {
      const competitor = createCompetitor({ gates: '2' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      const gate = gatesContainer?.querySelector('[class*="gate"]')
      expect(gate).not.toBeNull()
      expect(hasClassContaining(gate!, 'touch')).toBe(true)
      expect(gate?.textContent).toBe('2')
    })

    it('applies miss class to gates with 50s penalty', () => {
      const competitor = createCompetitor({ gates: '50' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      const gate = gatesContainer?.querySelector('[class*="gate"]')
      expect(gate).not.toBeNull()
      expect(hasClassContaining(gate!, 'miss')).toBe(true)
      expect(gate?.textContent).toBe('50')
    })

    it('renders empty gates container when gates string is empty', () => {
      const competitor = createCompetitor({ gates: '' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      // Empty gates string should result in no gate elements inside gatesContainer
      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      expect(gatesContainer).toBeInTheDocument()
      const gates = gatesContainer?.querySelectorAll('[class*="gate"]:not([class*="gatesContainer"])')
      expect(gates?.length).toBe(0)
    })

    it('renders gate title attribute with gate number', () => {
      const competitor = createCompetitor({ gates: '0,2,50' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      const gates = gatesContainer?.querySelectorAll('[class*="gate"]:not([class*="gatesContainer"])')
      expect(gates).not.toBeNull()
      expect(gates?.length).toBe(3)
      expect(gates?.[0]).toHaveAttribute('title', 'Brána 1')
      expect(gates?.[1]).toHaveAttribute('title', 'Brána 2')
      expect(gates?.[2]).toHaveAttribute('title', 'Brána 3')
    })

    it('handles space-separated gates format', () => {
      const competitor = createCompetitor({ gates: '0 2 50 0' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      const gates = gatesContainer?.querySelectorAll('[class*="gate"]:not([class*="gatesContainer"])')
      expect(gates?.length).toBe(4)
    })
  })

  describe('departing state', () => {
    it('applies departing class when isDeparting is true', () => {
      const competitor = createCompetitor()
      render(<CurrentCompetitor competitor={competitor} isDeparting={true} />)

      const container = screen.getByTestId('oncourse')
      expect(hasClassContaining(container, 'departing')).toBe(true)
    })

    it('does not apply departing class when isDeparting is false', () => {
      const competitor = createCompetitor()
      render(<CurrentCompetitor competitor={competitor} isDeparting={false} />)

      const container = screen.getByTestId('oncourse')
      expect(hasClassContaining(container, 'departing')).toBe(false)
    })

    it('renders departing label when isDeparting is true', () => {
      const competitor = createCompetitor()
      render(<CurrentCompetitor competitor={competitor} isDeparting={true} />)

      expect(screen.getByText('Odchod')).toBeInTheDocument()
    })

    it('does not render departing label when isDeparting is false', () => {
      const competitor = createCompetitor()
      render(<CurrentCompetitor competitor={competitor} isDeparting={false} />)

      expect(screen.queryByText('Odchod')).not.toBeInTheDocument()
    })

    it('defaults isDeparting to false', () => {
      const competitor = createCompetitor()
      render(<CurrentCompetitor competitor={competitor} />)

      const container = screen.getByTestId('oncourse')
      expect(hasClassContaining(container, 'departing')).toBe(false)
      expect(screen.queryByText('Odchod')).not.toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('renders gates container with role="list" and aria-label', () => {
      const competitor = createCompetitor({ gates: '0,2,50' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      expect(gatesContainer).toHaveAttribute('role', 'list')
      expect(gatesContainer).toHaveAttribute('aria-label', 'Penalizace na branách')
    })

    it('renders each gate with role="listitem" and aria-label', () => {
      const competitor = createCompetitor({ gates: '0,2,50' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      const gates = gatesContainer?.querySelectorAll('[class*="gate"]:not([class*="gatesContainer"])')

      expect(gates?.[0]).toHaveAttribute('role', 'listitem')
      expect(gates?.[0]).toHaveAttribute('aria-label', 'Brána 1: čistě')
      expect(gates?.[1]).toHaveAttribute('aria-label', 'Brána 2: dotyk, 2 sekundy')
      expect(gates?.[2]).toHaveAttribute('aria-label', 'Brána 3: neprojetí, 50 sekund')
    })

    it('renders TTB diff with aria-label for ahead (negative diff)', () => {
      const competitor = createCompetitor({ ttbDiff: '-2.50' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const ttbDiff = container.querySelector('[class*="ttbDiff"]')
      expect(ttbDiff).toHaveAttribute('aria-label', 'Vpředu o 2.50')
    })

    it('renders TTB diff with aria-label for behind (positive diff with +)', () => {
      const competitor = createCompetitor({ ttbDiff: '+3.00' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const ttbDiff = container.querySelector('[class*="ttbDiff"]')
      expect(ttbDiff).toHaveAttribute('aria-label', 'Pozadu o 3.00')
    })

    it('renders TTB diff with aria-label for behind (positive diff without +)', () => {
      const competitor = createCompetitor({ ttbDiff: '1.50' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const ttbDiff = container.querySelector('[class*="ttbDiff"]')
      expect(ttbDiff).toHaveAttribute('aria-label', 'Pozadu o 1.50')
    })
  })

  describe('edge cases', () => {
    it('handles competitor with empty name', () => {
      const competitor = createCompetitor({ name: '' })
      render(<CurrentCompetitor competitor={competitor} />)

      // Should not crash, container should render
      expect(screen.getByTestId('oncourse')).toBeInTheDocument()
    })

    it('handles competitor with very long name', () => {
      const competitor = createCompetitor({
        name: 'SUPERLONGFAMILYNAME VeryLongGivenNameThatShouldBeTruncated',
      })
      render(<CurrentCompetitor competitor={competitor} />)

      expect(screen.getByTestId('oncourse')).toBeInTheDocument()
    })

    it('handles competitor with empty club', () => {
      const competitor = createCompetitor({ club: '' })
      render(<CurrentCompetitor competitor={competitor} />)

      expect(screen.getByTestId('oncourse')).toBeInTheDocument()
    })

    it('handles competitor with zero time', () => {
      const competitor = createCompetitor({ time: '0' })
      render(<CurrentCompetitor competitor={competitor} />)

      expect(screen.getByTestId('oncourse')).toBeInTheDocument()
    })

    it('handles competitor with empty gates string', () => {
      const competitor = createCompetitor({ gates: '' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      const gates = gatesContainer?.querySelectorAll('[class*="gate"]:not([class*="gatesContainer"])')
      expect(gates?.length).toBe(0)
    })

    it('handles competitor with many gates', () => {
      // 25 gates (typical for slalom)
      const gatesStr = Array(25).fill('0').join(',')
      const competitor = createCompetitor({ gates: gatesStr })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      const gates = gatesContainer?.querySelectorAll('[class*="gate"]:not([class*="gatesContainer"])')
      expect(gates?.length).toBe(25)
    })
  })
})
