/**
 * Snapshot tests for stable components
 *
 * These tests ensure component output doesn't change unexpectedly.
 * Run `npm test -- --updateSnapshot` to update snapshots after intentional changes.
 */

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Footer } from '../../Footer/Footer'
import { ResultRow } from '../../ResultsList/ResultRow'
import type { Result } from '@/types'

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

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

describe('Component Snapshots', () => {
  describe('Footer', () => {
    it('renders visible footer correctly', () => {
      const { container } = render(<Footer visible={true} />)
      expect(container).toMatchSnapshot()
    })

    it('renders hidden footer correctly', () => {
      const { container } = render(<Footer visible={false} />)
      expect(container).toMatchSnapshot()
    })
  })

  describe('ResultRow', () => {
    it('renders basic result row', () => {
      const result = createResult()
      const { container } = render(<ResultRow result={result} />)
      expect(container).toMatchSnapshot()
    })

    it('renders highlighted result row', () => {
      const result = createResult()
      const { container } = render(<ResultRow result={result} isHighlighted={true} />)
      expect(container).toMatchSnapshot()
    })

    it('renders result with zero penalty', () => {
      const result = createResult({ pen: 0 })
      const { container } = render(<ResultRow result={result} />)
      expect(container).toMatchSnapshot()
    })

    it('renders result with 2s penalty (touch)', () => {
      const result = createResult({ pen: 2 })
      const { container } = render(<ResultRow result={result} />)
      expect(container).toMatchSnapshot()
    })

    it('renders result with 50s penalty (miss)', () => {
      const result = createResult({ pen: 50 })
      const { container } = render(<ResultRow result={result} />)
      expect(container).toMatchSnapshot()
    })

    it('renders result with behind time', () => {
      const result = createResult({ behind: '1.50' })
      const { container } = render(<ResultRow result={result} />)
      expect(container).toMatchSnapshot()
    })

    it('renders result without penalty column (ledwall mode)', () => {
      const result = createResult({ pen: 4 })
      const { container } = render(<ResultRow result={result} showPenalty={false} />)
      expect(container).toMatchSnapshot()
    })

    it('renders result without behind column (ledwall mode)', () => {
      const result = createResult({ behind: '2.00' })
      const { container } = render(<ResultRow result={result} showBehind={false} />)
      expect(container).toMatchSnapshot()
    })

    it('renders result with long name (truncation)', () => {
      const result = createResult({
        name: 'PRSKAVEC-SKANTAR Jiří Jan',
        familyName: 'PRSKAVEC-SKANTAR',
        givenName: 'Jiří Jan',
      })
      const { container } = render(<ResultRow result={result} />)
      expect(container).toMatchSnapshot()
    })

    it('renders result with high time (over 100s)', () => {
      const result = createResult({ total: '125.75' })
      const { container } = render(<ResultRow result={result} />)
      expect(container).toMatchSnapshot()
    })
  })
})
