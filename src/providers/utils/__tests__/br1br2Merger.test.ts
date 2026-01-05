import { describe, it, expect } from 'vitest'
import {
  createBR2MergeState,
  mergeBR1IntoBR2Results,
  mergeBR1CacheIntoBR2Results,
} from '../br1br2Merger'
import type { Result, RunResult } from '@/types'
import type { MergedResults } from '../c123ServerApi'

// Factory for creating test results
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

describe('br1br2Merger', () => {
  describe('createBR2MergeState', () => {
    it('creates initial state with defaults', () => {
      const state = createBR2MergeState()

      expect(state.isBR2).toBe(false)
      expect(state.raceId).toBeNull()
      expect(state.br1Cache.size).toBe(0)
      expect(state.lastFetchTime).toBe(0)
      expect(state.pendingFetchTimeout).toBeNull()
    })
  })

  describe('mergeBR1IntoBR2Results', () => {
    it('returns original results when mergedData is null', () => {
      const results = [createResult({ bib: '1' }), createResult({ bib: '2' })]

      const merged = mergeBR1IntoBR2Results(results, null)

      expect(merged).toBe(results)
    })

    it('returns original results when mergedData.results is empty', () => {
      const results = [createResult({ bib: '1' })]
      const mergedData: MergedResults = {
        raceId: 'K1M_ST_BR2_6',
        results: [],
      }

      const merged = mergeBR1IntoBR2Results(results, mergedData)

      expect(merged).toEqual(results)
    })

    it('merges run1 and run2 data from REST API', () => {
      const results = [
        createResult({ bib: '1', total: '85.00', pen: 0, rank: 1 }),
        createResult({ bib: '2', total: '87.50', pen: 2, rank: 2 }),
      ]
      const mergedData: MergedResults = {
        raceId: 'K1M_ST_BR2_6',
        results: [
          {
            bib: '1',
            run1: { total: 8500, pen: 0, rank: 1 },
            run2: { total: 8700, pen: 2, rank: 3 },
          },
          {
            bib: '2',
            run1: { total: 9000, pen: 4, rank: 2 },
            run2: { total: 8750, pen: 2, rank: 2 },
          },
        ],
      }

      const merged = mergeBR1IntoBR2Results(results, mergedData)

      expect(merged[0].run1).toEqual({
        total: '85.00',
        pen: 0,
        rank: 1,
        status: '',
      })
      expect(merged[0].run2).toEqual({
        total: '87.00',
        pen: 2,
        rank: 3,
        status: '',
      })
      expect(merged[0].bestRun).toBe(1) // 8500 < 8700

      expect(merged[1].run1).toEqual({
        total: '90.00',
        pen: 4,
        rank: 2,
        status: '',
      })
      expect(merged[1].run2).toEqual({
        total: '87.50',
        pen: 2,
        rank: 2,
        status: '',
      })
      expect(merged[1].bestRun).toBe(2) // 8750 < 9000
    })

    it('handles competitor not in merged data', () => {
      const results = [
        createResult({ bib: '1' }),
        createResult({ bib: '99' }), // Not in merged data
      ]
      const mergedData: MergedResults = {
        raceId: 'K1M_ST_BR2_6',
        results: [
          {
            bib: '1',
            run1: { total: 8500, pen: 0, rank: 1 },
            run2: { total: 8700, pen: 2, rank: 1 },
          },
        ],
      }

      const merged = mergeBR1IntoBR2Results(results, mergedData)

      // First competitor has merged data
      expect(merged[0].run1).toBeDefined()
      expect(merged[0].run2).toBeDefined()

      // Second competitor has no merged data
      expect(merged[1].run1).toBeUndefined()
      expect(merged[1].run2).toBeUndefined()
    })

    it('determines bestRun correctly when run1 is better', () => {
      const results = [createResult({ bib: '1' })]
      const mergedData: MergedResults = {
        raceId: 'K1M_ST_BR2_6',
        results: [
          {
            bib: '1',
            run1: { total: 8000, pen: 0, rank: 1 },
            run2: { total: 9000, pen: 4, rank: 2 },
          },
        ],
      }

      const merged = mergeBR1IntoBR2Results(results, mergedData)

      expect(merged[0].bestRun).toBe(1)
    })

    it('determines bestRun correctly when run2 is better', () => {
      const results = [createResult({ bib: '1' })]
      const mergedData: MergedResults = {
        raceId: 'K1M_ST_BR2_6',
        results: [
          {
            bib: '1',
            run1: { total: 9500, pen: 6, rank: 3 },
            run2: { total: 8500, pen: 0, rank: 1 },
          },
        ],
      }

      const merged = mergeBR1IntoBR2Results(results, mergedData)

      expect(merged[0].bestRun).toBe(2)
    })

    it('handles missing run1 data', () => {
      const results = [createResult({ bib: '1' })]
      const mergedData: MergedResults = {
        raceId: 'K1M_ST_BR2_6',
        results: [
          {
            bib: '1',
            run2: { total: 8500, pen: 0, rank: 1 },
          },
        ],
      }

      const merged = mergeBR1IntoBR2Results(results, mergedData)

      expect(merged[0].run1).toBeUndefined()
      expect(merged[0].run2).toBeDefined()
      expect(merged[0].bestRun).toBe(2) // Only run2 exists
    })

    it('handles missing run2 data', () => {
      const results = [createResult({ bib: '1' })]
      const mergedData: MergedResults = {
        raceId: 'K1M_ST_BR2_6',
        results: [
          {
            bib: '1',
            run1: { total: 8500, pen: 0, rank: 1 },
          },
        ],
      }

      const merged = mergeBR1IntoBR2Results(results, mergedData)

      expect(merged[0].run1).toBeDefined()
      expect(merged[0].run2).toBeUndefined()
      expect(merged[0].bestRun).toBe(1) // Only run1 exists
    })
  })

  describe('mergeBR1CacheIntoBR2Results', () => {
    it('returns original results when cache is empty', () => {
      const results = [createResult({ bib: '1' })]
      const cache = new Map<string, RunResult>()

      const merged = mergeBR1CacheIntoBR2Results(results, cache)

      expect(merged).toBe(results)
    })

    it('merges cached BR1 data into results', () => {
      const results = [
        createResult({ bib: '1', total: '87.00', pen: 2, rank: 1 }),
        createResult({ bib: '2', total: '89.50', pen: 4, rank: 2 }),
      ]
      const cache = new Map<string, RunResult>([
        ['1', { total: '85.00', pen: 0, rank: 1, status: '' }],
        ['2', { total: '90.00', pen: 6, rank: 2, status: '' }],
      ])

      const merged = mergeBR1CacheIntoBR2Results(results, cache)

      // First competitor
      expect(merged[0].run1).toEqual({ total: '85.00', pen: 0, rank: 1, status: '' })
      expect(merged[0].run2?.total).toBe('87.00')
      expect(merged[0].bestRun).toBe(1) // 85.00 < 87.00

      // Second competitor
      expect(merged[1].run1).toEqual({ total: '90.00', pen: 6, rank: 2, status: '' })
      expect(merged[1].run2?.total).toBe('89.50')
      expect(merged[1].bestRun).toBe(2) // 89.50 < 90.00
    })

    it('handles competitor not in cache', () => {
      const results = [
        createResult({ bib: '1', total: '87.00' }),
        createResult({ bib: '99', total: '95.00' }), // Not in cache
      ]
      const cache = new Map<string, RunResult>([
        ['1', { total: '85.00', pen: 0, rank: 1, status: '' }],
      ])

      const merged = mergeBR1CacheIntoBR2Results(results, cache)

      // First has cache data
      expect(merged[0].run1).toBeDefined()
      expect(merged[0].run2).toBeDefined()

      // Second has no cache data
      expect(merged[1].run1).toBeUndefined()
      expect(merged[1].run2).toBeUndefined()
    })
  })
})
