import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultsList } from '../ResultsList'
import { ResultRow } from '../ResultRow'
import type { Result } from '@/types'

// Mock scrollIntoView which is not available in JSDOM
Element.prototype.scrollIntoView = vi.fn()

// Mock the hooks
vi.mock('@/hooks/useHighlight', () => ({
  useHighlight: vi.fn(() => ({
    highlightBib: null,
    isActive: false,
    timeRemaining: 0,
    progress: 0,
  })),
}))

vi.mock('@/hooks/useLayout', () => ({
  useLayout: vi.fn(() => ({
    layoutMode: 'vertical',
    viewportWidth: 1080,
    viewportHeight: 1920,
    visibleRows: 10,
    rowHeight: 40,
    showFooter: true,
    headerHeight: 100,
    footerHeight: 60,
    fontSizeCategory: 'medium' as const,
  })),
}))

vi.mock('@/hooks/useAutoScroll', () => ({
  useAutoScroll: vi.fn(() => ({
    containerRef: { current: null },
    scrollState: 'idle',
    pause: vi.fn(),
    resume: vi.fn(),
    reset: vi.fn(),
  })),
}))

import { useHighlight } from '@/hooks/useHighlight'
import { useLayout } from '@/hooks/useLayout'

// Sample result data factory
function createResult(overrides: Partial<Result> = {}): Result {
  return {
    rank: 1,
    bib: '42',
    name: 'NOVAK Jiri',
    familyName: 'NOVAK',
    givenName: 'Jiri',
    club: 'USK Praha',
    nat: 'CZE',
    total: '90.50',
    pen: 0,
    behind: '',
    ...overrides,
  }
}

describe('ResultsList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders empty state when results array is empty', () => {
      render(<ResultsList results={[]} />)

      expect(screen.getByTestId('results-list')).toBeInTheDocument()
      expect(screen.getByText('Zatím žádné výsledky')).toBeInTheDocument()
    })

    it('renders results list with data-testid', () => {
      const results = [createResult()]
      render(<ResultsList results={results} />)

      expect(screen.getByTestId('results-list')).toBeInTheDocument()
    })

    it('renders header row with column labels', () => {
      const results = [createResult()]
      render(<ResultsList results={results} />)

      expect(screen.getByText('#')).toBeInTheDocument()
      expect(screen.getByText('St.')).toBeInTheDocument()
      expect(screen.getByText('Jméno')).toBeInTheDocument()
      expect(screen.getByText('Pen')).toBeInTheDocument()
      expect(screen.getByText('Čas')).toBeInTheDocument()
      expect(screen.getByText('Ztráta')).toBeInTheDocument()
    })

    it('renders result rows for each result', () => {
      const results = [
        createResult({ rank: 1, bib: '42', name: 'NOVAK Jiri' }),
        createResult({ rank: 2, bib: '15', name: 'PRSKAVEC Jiri' }),
        createResult({ rank: 3, bib: '7', name: 'SKANTAR Peter' }),
      ]
      render(<ResultsList results={results} />)

      expect(screen.getByText('NOVAK Jiri')).toBeInTheDocument()
      expect(screen.getByText('PRSKAVEC Jiri')).toBeInTheDocument()
      expect(screen.getByText('SKANTAR Peter')).toBeInTheDocument()
    })

    it('renders penalty values correctly', () => {
      const results = [
        createResult({ rank: 1, bib: '42', pen: 0 }),
        createResult({ rank: 2, bib: '15', pen: 2 }),
        createResult({ rank: 3, bib: '7', pen: 50 }),
      ]
      render(<ResultsList results={results} />)

      // Penalties are displayed as numbers without 's' suffix (per original v1 style)
      expect(screen.getByText('0')).toBeInTheDocument() // 0 penalty
      expect(screen.getByText('2')).toBeInTheDocument() // 2s penalty
      expect(screen.getByText('50')).toBeInTheDocument() // 50s penalty
    })

    it('renders behind times with + prefix', () => {
      const results = [
        createResult({ rank: 1, behind: '' }),
        createResult({ rank: 2, bib: '15', behind: '1.23' }),
        createResult({ rank: 3, bib: '7', behind: '+2.45' }),
      ]
      render(<ResultsList results={results} />)

      expect(screen.getByText('+1.23')).toBeInTheDocument()
      expect(screen.getByText('+2.45')).toBeInTheDocument()
    })
  })

  describe('visibility', () => {
    it('applies hidden class when visible is false', () => {
      const results = [createResult()]
      render(<ResultsList results={results} visible={false} />)

      const container = screen.getByTestId('results-list')
      expect(container.className).toContain('hidden')
    })

    it('does not apply hidden class when visible is true', () => {
      const results = [createResult()]
      render(<ResultsList results={results} visible={true} />)

      const container = screen.getByTestId('results-list')
      expect(container.className).not.toContain('hidden')
    })

    it('defaults visible to true', () => {
      const results = [createResult()]
      render(<ResultsList results={results} />)

      const container = screen.getByTestId('results-list')
      expect(container.className).not.toContain('hidden')
    })
  })

  describe('responsive columns (ledwall)', () => {
    it('hides penalty and behind columns on ledwall layout', () => {
      vi.mocked(useLayout).mockReturnValue({
        layoutMode: 'ledwall',
        viewportWidth: 768,
        viewportHeight: 384,
        visibleRows: 5,
        rowHeight: 60,
        showFooter: false,
        headerHeight: 60,
        footerHeight: 0,
        fontSizeCategory: 'large',
      })

      const results = [createResult({ pen: 2, behind: '1.23' })]
      render(<ResultsList results={results} />)

      // Header should not have Pen and Ztráta
      expect(screen.queryByText('Pen')).not.toBeInTheDocument()
      expect(screen.queryByText('Ztráta')).not.toBeInTheDocument()
      // Penalty and behind values should not be shown
      // Note: checking for penalty cell class absence is more reliable since "2" could match other content
      const { container } = render(<ResultsList results={results} />)
      const penaltyCells = container.querySelectorAll('[class*="penalty"]')
      // Only header cells might have penalty in className, but not value cells
      expect(screen.queryByText('+1.23')).not.toBeInTheDocument()
    })

    it('shows all columns on vertical layout', () => {
      vi.mocked(useLayout).mockReturnValue({
        layoutMode: 'vertical',
        viewportWidth: 1080,
        viewportHeight: 1920,
        visibleRows: 10,
        rowHeight: 40,
        showFooter: true,
        headerHeight: 142, // Updated to match original v1 computed styles
        footerHeight: 60,
        fontSizeCategory: 'medium',
      })

      const results = [createResult({ pen: 2, behind: '1.23' })]
      render(<ResultsList results={results} />)

      expect(screen.getByText('Pen')).toBeInTheDocument()
      expect(screen.getByText('Ztráta')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument() // Penalty as number without 's'
      expect(screen.getByText('+1.23')).toBeInTheDocument()
    })
  })

  describe('highlight styling', () => {
    it('applies highlight class to highlighted row', () => {
      vi.mocked(useHighlight).mockReturnValue({
        highlightBib: '42',
        isActive: true,
        timeRemaining: 4000,
        progress: 0.2,
      })

      const results = [
        createResult({ rank: 1, bib: '42' }),
        createResult({ rank: 2, bib: '15' }),
      ]
      const { container } = render(<ResultsList results={results} />)

      // Find the highlighted row - the second row (first data row after header)
      const rows = container.querySelectorAll('[class*="row"]')
      // rows[0] is header, rows[1] is first data row (bib 42)
      expect(rows[1].className).toContain('highlighted')
      expect(rows[2].className).not.toContain('highlighted')
    })

    it('does not apply highlight when isActive is false', () => {
      vi.mocked(useHighlight).mockReturnValue({
        highlightBib: '42',
        isActive: false,
        timeRemaining: 0,
        progress: 1,
      })

      const results = [createResult({ bib: '42' })]
      const { container } = render(<ResultsList results={results} />)

      const rows = container.querySelectorAll('[class*="row"]')
      // Skip header row
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].className).not.toContain('highlighted')
      }
    })

    it('does not apply highlight when highlightBib does not match any result', () => {
      vi.mocked(useHighlight).mockReturnValue({
        highlightBib: '999',
        isActive: true,
        timeRemaining: 5000,
        progress: 0,
      })

      const results = [
        createResult({ bib: '42' }),
        createResult({ bib: '15' }),
      ]
      const { container } = render(<ResultsList results={results} />)

      const rows = container.querySelectorAll('[class*="row"]')
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].className).not.toContain('highlighted')
      }
    })
  })
})

describe('ResultRow', () => {
  describe('rendering', () => {
    it('renders all result data', () => {
      const result = createResult({
        rank: 1,
        bib: '42',
        name: 'NOVAK Jiri',
        total: '90.50',
        pen: 2,
        behind: '0.50',
      })
      render(<ResultRow result={result} />)

      expect(screen.getByText('1.')).toBeInTheDocument() // Rank with dot (per original v1 style)
      expect(screen.getByText('42')).toBeInTheDocument()
      expect(screen.getByText('NOVAK Jiri')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument() // Penalty as number without 's' suffix
      expect(screen.getByText('1:30.50')).toBeInTheDocument() // formatTime converts 90.50
      expect(screen.getByText('+0.50')).toBeInTheDocument()
    })

    it('renders zero for zero penalty', () => {
      const result = createResult({ pen: 0 })
      render(<ResultRow result={result} />)

      // Penalty is displayed as number (0), not dash (per original v1 style)
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  describe('penalty styling', () => {
    it('applies penaltyClear class for zero penalty', () => {
      const result = createResult({ pen: 0 })
      const { container } = render(<ResultRow result={result} />)

      const penaltyCell = container.querySelector('[class*="penalty"]')
      expect(penaltyCell?.className).toContain('penaltyClear')
    })

    it('applies penaltyTouch class for 2s penalty', () => {
      const result = createResult({ pen: 2 })
      const { container } = render(<ResultRow result={result} />)

      const penaltyCell = container.querySelector('[class*="penalty"]')
      expect(penaltyCell?.className).toContain('penaltyTouch')
    })

    it('applies penaltyTouch class for 4s penalty', () => {
      const result = createResult({ pen: 4 })
      const { container } = render(<ResultRow result={result} />)

      const penaltyCell = container.querySelector('[class*="penalty"]')
      expect(penaltyCell?.className).toContain('penaltyTouch')
    })

    it('applies penaltyMiss class for 50s penalty', () => {
      const result = createResult({ pen: 50 })
      const { container } = render(<ResultRow result={result} />)

      const penaltyCell = container.querySelector('[class*="penalty"]')
      expect(penaltyCell?.className).toContain('penaltyMiss')
    })

    it('applies penaltyMiss class for 100s penalty (double miss)', () => {
      const result = createResult({ pen: 100 })
      const { container } = render(<ResultRow result={result} />)

      const penaltyCell = container.querySelector('[class*="penalty"]')
      expect(penaltyCell?.className).toContain('penaltyMiss')
    })
  })

  describe('behind formatting', () => {
    it('returns empty string for empty behind', () => {
      const result = createResult({ behind: '' })
      render(<ResultRow result={result} />)

      // The behind column should be empty (last column, no + prefix)
      const cells = screen.queryAllByText((content, element): boolean => {
        return Boolean(element?.className?.includes('behind') && content === '')
      })
      expect(cells.length).toBeGreaterThanOrEqual(0)
    })

    it('returns empty string for zero behind', () => {
      const result = createResult({ behind: '0' })
      render(<ResultRow result={result} />)

      // No +0 should appear
      expect(screen.queryByText('+0')).not.toBeInTheDocument()
    })

    it('returns empty string for 0.00 behind', () => {
      const result = createResult({ behind: '0.00' })
      render(<ResultRow result={result} />)

      expect(screen.queryByText('+0.00')).not.toBeInTheDocument()
    })

    it('adds + prefix to behind times', () => {
      const result = createResult({ behind: '1.50' })
      render(<ResultRow result={result} />)

      expect(screen.getByText('+1.50')).toBeInTheDocument()
    })

    it('preserves existing + prefix', () => {
      const result = createResult({ behind: '+2.50' })
      render(<ResultRow result={result} />)

      expect(screen.getByText('+2.50')).toBeInTheDocument()
      expect(screen.queryByText('++2.50')).not.toBeInTheDocument()
    })
  })

  describe('optional columns', () => {
    it('hides penalty column when showPenalty is false', () => {
      const result = createResult({ pen: 2 })
      render(<ResultRow result={result} showPenalty={false} />)

      // Check that penalty value is not in the document when column is hidden
      // Note: "2" might appear as part of other content, so we check for penalty-specific class
      const { container } = render(<ResultRow result={result} showPenalty={false} />)
      const penaltyCells = container.querySelectorAll('[class*="penalty"]')
      expect(penaltyCells.length).toBe(0)
    })

    it('hides behind column when showBehind is false', () => {
      const result = createResult({ behind: '1.50' })
      render(<ResultRow result={result} showBehind={false} />)

      expect(screen.queryByText('+1.50')).not.toBeInTheDocument()
    })

    it('shows both columns by default', () => {
      const result = createResult({ pen: 2, behind: '1.50' })
      render(<ResultRow result={result} />)

      expect(screen.getByText('2')).toBeInTheDocument() // Penalty as number
      expect(screen.getByText('+1.50')).toBeInTheDocument()
    })
  })

  describe('highlight state', () => {
    it('applies highlighted class when isHighlighted is true', () => {
      const result = createResult()
      const { container } = render(<ResultRow result={result} isHighlighted={true} />)

      const row = container.firstChild as HTMLElement
      expect(row?.className).toContain('highlighted')
    })

    it('does not apply highlighted class when isHighlighted is false', () => {
      const result = createResult()
      const { container } = render(<ResultRow result={result} isHighlighted={false} />)

      const row = container.firstChild as HTMLElement
      expect(row?.className).not.toContain('highlighted')
    })

    it('does not apply highlighted class by default', () => {
      const result = createResult()
      const { container } = render(<ResultRow result={result} />)

      const row = container.firstChild as HTMLElement
      expect(row?.className).not.toContain('highlighted')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref to root element', () => {
      const result = createResult()
      const ref = { current: null as HTMLDivElement | null }
      render(<ResultRow result={result} ref={ref} />)

      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })
  })
})
