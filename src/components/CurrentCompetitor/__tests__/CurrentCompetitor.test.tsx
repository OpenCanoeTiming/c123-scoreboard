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

    it('renders time as raw value (not formatted)', () => {
      // Component displays raw total value to match original v1 style
      const competitor = createCompetitor({ total: '95.50', time: '93.50' })
      render(<CurrentCompetitor competitor={competitor} />)

      // Uses total (not time), displayed as-is without MM:SS formatting
      expect(screen.getByText('95.50')).toBeInTheDocument()
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
    it('renders only gates with penalties (not all gates)', () => {
      // Gates: 0=clear, 2=touch at gate 2, 50=miss at gate 3, 0=clear, 0=clear
      const competitor = createCompetitor({ gates: '0,2,50,0,0' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      // Should only render 2 badges (gates 2 and 3 with penalties)
      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      const gates = gatesContainer?.querySelectorAll('[class*="gate"]') ?? []
      expect(gates.length).toBe(2)
    })

    it('does not render any gates when all penalties are 0 (clear)', () => {
      const competitor = createCompetitor({ gates: '0,0,0,0,0' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      const gates = gatesContainer?.querySelectorAll('[class*="gate"]') ?? []
      expect(gates.length).toBe(0)
    })

    it('displays gate NUMBER (not penalty value) with touch class for 2s penalty', () => {
      // Gate 1 has 2s penalty
      const competitor = createCompetitor({ gates: '2' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      const gate = gatesContainer?.querySelector('[class*="gate"]')
      expect(gate).not.toBeNull()
      expect(hasClassContaining(gate!, 'touch')).toBe(true)
      // Should show gate NUMBER (1), not penalty value (2)
      expect(gate?.textContent).toBe('1')
    })

    it('displays gate NUMBER (not penalty value) with miss class for 50s penalty', () => {
      // Gate 1 has 50s penalty
      const competitor = createCompetitor({ gates: '50' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      const gate = gatesContainer?.querySelector('[class*="gate"]')
      expect(gate).not.toBeNull()
      expect(hasClassContaining(gate!, 'miss')).toBe(true)
      // Should show gate NUMBER (1), not penalty value (50)
      expect(gate?.textContent).toBe('1')
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

    it('renders gate badges with correct gate numbers and titles', () => {
      // Gates 2 and 3 have penalties
      const competitor = createCompetitor({ gates: '0,2,50' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      const gates = gatesContainer?.querySelectorAll('[class*="gate"]:not([class*="gatesContainer"])')
      expect(gates).not.toBeNull()
      expect(gates?.length).toBe(2)
      // Gate 2 (touch)
      expect(gates?.[0]?.textContent).toBe('2')
      expect(gates?.[0]).toHaveAttribute('title', 'Brána 2')
      // Gate 3 (miss)
      expect(gates?.[1]?.textContent).toBe('3')
      expect(gates?.[1]).toHaveAttribute('title', 'Brána 3')
    })

    it('handles space-separated gates format', () => {
      // Gates: 0=clear, 2=touch at gate 2, 50=miss at gate 3, 0=clear
      const competitor = createCompetitor({ gates: '0 2 50 0' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      const gates = gatesContainer?.querySelectorAll('[class*="gate"]:not([class*="gatesContainer"])')
      // Only gates with penalties: gate 2 (touch) and gate 3 (miss)
      expect(gates?.length).toBe(2)
    })

    it('shows multiple penalty gates in correct order', () => {
      // Penalties at gates 2, 4, 7 (indices 1, 3, 6)
      const competitor = createCompetitor({ gates: '0,2,0,50,0,0,2' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      const gates = gatesContainer?.querySelectorAll('[class*="gate"]:not([class*="gatesContainer"])')
      expect(gates?.length).toBe(3)
      expect(gates?.[0]?.textContent).toBe('2') // Gate 2
      expect(gates?.[1]?.textContent).toBe('4') // Gate 4
      expect(gates?.[2]?.textContent).toBe('7') // Gate 7
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

    it('renders each gate badge with role="listitem" and aria-label', () => {
      // Only gates with penalties are rendered: gate 2 (touch) and gate 3 (miss)
      const competitor = createCompetitor({ gates: '0,2,50' })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      const gates = gatesContainer?.querySelectorAll('[class*="gate"]:not([class*="gatesContainer"])')

      expect(gates?.length).toBe(2)
      expect(gates?.[0]).toHaveAttribute('role', 'listitem')
      expect(gates?.[0]).toHaveAttribute('aria-label', 'Brána 2: dotyk, 2 sekundy')
      expect(gates?.[1]).toHaveAttribute('aria-label', 'Brána 3: neprojetí, 50 sekund')
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

    it('handles competitor with many gates with penalties', () => {
      // 25 gates (typical for slalom), penalties at gates 5, 10, 15, 20
      const gatesArr = Array(25).fill('0')
      gatesArr[4] = '2'  // Gate 5 - touch
      gatesArr[9] = '50' // Gate 10 - miss
      gatesArr[14] = '2' // Gate 15 - touch
      gatesArr[19] = '2' // Gate 20 - touch
      const competitor = createCompetitor({ gates: gatesArr.join(',') })
      const { container } = render(
        <CurrentCompetitor competitor={competitor} />
      )

      const gatesContainer = container.querySelector('[class*="gatesContainer"]')
      const gates = gatesContainer?.querySelectorAll('[class*="gate"]:not([class*="gatesContainer"])')
      // Only 4 gates have penalties
      expect(gates?.length).toBe(4)
      expect(gates?.[0]?.textContent).toBe('5')
      expect(gates?.[1]?.textContent).toBe('10')
      expect(gates?.[2]?.textContent).toBe('15')
      expect(gates?.[3]?.textContent).toBe('20')
    })
  })
})
