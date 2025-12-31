import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ResultRow } from '../../ResultsList/ResultRow'
import type { Result } from '@/types'

const baseResult: Result = {
  rank: 1,
  bib: '42',
  name: 'NOVAK Jan',
  club: 'SKP Praha',
  time: '95.32',
  total: '95.32',
  pen: 0,
  behind: '',
}

describe('ResultRow snapshots', () => {
  describe('basic states', () => {
    it('should match snapshot - leader (no behind)', () => {
      const { container } = render(<ResultRow result={baseResult} />)
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - with behind time', () => {
      const result: Result = {
        ...baseResult,
        rank: 2,
        bib: '15',
        name: 'SVOBODA Petr',
        total: '97.45',
        behind: '+2.13',
      }
      const { container } = render(<ResultRow result={result} />)
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - highlighted', () => {
      const { container } = render(
        <ResultRow result={baseResult} isHighlighted={true} />
      )
      expect(container).toMatchSnapshot()
    })
  })

  describe('penalty states', () => {
    it('should match snapshot - zero penalty', () => {
      const result: Result = { ...baseResult, pen: 0 }
      const { container } = render(<ResultRow result={result} />)
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - 2s touch penalty', () => {
      const result: Result = { ...baseResult, pen: 2, total: '97.32' }
      const { container } = render(<ResultRow result={result} />)
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - 4s double touch penalty', () => {
      const result: Result = { ...baseResult, pen: 4, total: '99.32' }
      const { container } = render(<ResultRow result={result} />)
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - 50s miss penalty', () => {
      const result: Result = { ...baseResult, pen: 50, total: '145.32' }
      const { container } = render(<ResultRow result={result} />)
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - 52s combined penalty', () => {
      const result: Result = { ...baseResult, pen: 52, total: '147.32' }
      const { container } = render(<ResultRow result={result} />)
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - 100s multiple miss penalty', () => {
      const result: Result = { ...baseResult, pen: 100, total: '195.32' }
      const { container } = render(<ResultRow result={result} />)
      expect(container).toMatchSnapshot()
    })
  })

  describe('column visibility', () => {
    it('should match snapshot - penalty hidden (ledwall mode)', () => {
      const { container } = render(
        <ResultRow result={baseResult} showPenalty={false} />
      )
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - behind hidden', () => {
      const result: Result = { ...baseResult, behind: '+2.13' }
      const { container } = render(
        <ResultRow result={result} showBehind={false} />
      )
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - both columns hidden (compact ledwall)', () => {
      const { container } = render(
        <ResultRow result={baseResult} showPenalty={false} showBehind={false} />
      )
      expect(container).toMatchSnapshot()
    })
  })

  describe('name formatting', () => {
    it('should match snapshot - long name', () => {
      const result: Result = {
        ...baseResult,
        name: 'ALEXANDROPOULOS-SMITHSON Christina Maria',
      }
      const { container } = render(<ResultRow result={result} />)
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - short name', () => {
      const result: Result = {
        ...baseResult,
        name: 'LI Wei',
      }
      const { container } = render(<ResultRow result={result} />)
      expect(container).toMatchSnapshot()
    })
  })

  describe('ledwall mode', () => {
    it('should match snapshot - ledwall layout', () => {
      const { container } = render(
        <ResultRow result={baseResult} layoutMode="ledwall" showBehind={false} />
      )
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - ledwall with long time (>100s)', () => {
      const result: Result = {
        ...baseResult,
        pen: 206,
        total: '353.91',
        behind: '+272.19',
      }
      const { container } = render(
        <ResultRow result={result} layoutMode="ledwall" showBehind={false} />
      )
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - ledwall highlighted', () => {
      const { container } = render(
        <ResultRow result={baseResult} layoutMode="ledwall" showBehind={false} isHighlighted={true} />
      )
      expect(container).toMatchSnapshot()
    })
  })
})
