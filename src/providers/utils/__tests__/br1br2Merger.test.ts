import { describe, it, expect } from 'vitest'
import {
  createBR2MergeState,
  mergeBR1CacheIntoBR2Results,
} from '../br1br2Merger'
import type { Result, RunResult } from '@/types'

// Type for cache entries (matches CachedBR2Data in br1br2Merger.ts)
interface CachedBR2Data {
  run1: RunResult
  run2: RunResult | undefined
}

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
      expect(state.cache.size).toBe(0)
      expect(state.lastFetchTime).toBe(0)
      expect(state.pendingFetchTimeout).toBeNull()
    })
  })

  describe('mergeBR1CacheIntoBR2Results', () => {
    it('returns original results when cache is empty', () => {
      const results = [createResult({ bib: '1' })]
      const cache = new Map<string, CachedBR2Data>()

      const merged = mergeBR1CacheIntoBR2Results(results, cache)

      expect(merged).toBe(results)
    })

    it('uses BR2 penalty from REST API cache (not WebSocket!)', () => {
      // WebSocket sends: time=87.00, pen=0 (BR1 penalty! because BR1 is better)
      // REST API cache has correct BR2 penalty: 4
      // BR2 total should be: 87.00 + 4 = 91.00
      const results = [
        createResult({
          bib: '1',
          time: '87.00',  // BR2 time from WebSocket
          pen: 0,         // This is BR1 penalty (because BR1 is better) - WRONG for BR2!
          total: '85.00', // BEST (BR1)
          rank: 1,
        }),
      ]
      const cache = new Map<string, CachedBR2Data>([
        ['1', {
          run1: { total: '85.00', pen: 0, rank: 1, status: '' },
          run2: { total: '91.00', pen: 4, rank: 2, status: '' },  // Correct BR2 penalty: 4
        }],
      ])

      const merged = mergeBR1CacheIntoBR2Results(results, cache)

      // BR1 from cache
      expect(merged[0].run1).toEqual({ total: '85.00', pen: 0, rank: 1, status: '' })
      // BR2 with correct penalty from cache (not WebSocket!)
      expect(merged[0].run2?.total).toBe('91.00')
      expect(merged[0].run2?.pen).toBe(4)  // From REST API cache, not WebSocket!
      expect(merged[0].bestRun).toBe(1)
    })

    it('handles competitor with only BR1 (no BR2 yet)', () => {
      const results = [
        createResult({
          bib: '1',
          time: '',       // No BR2 time yet
          pen: 0,
          total: '85.00',
        }),
      ]
      const cache = new Map<string, CachedBR2Data>([
        ['1', {
          run1: { total: '85.00', pen: 0, rank: 1, status: '' },
          run2: undefined,  // No BR2 in cache
        }],
      ])

      const merged = mergeBR1CacheIntoBR2Results(results, cache)

      expect(merged[0].run1).toBeDefined()
      expect(merged[0].run2).toBeUndefined()
      expect(merged[0].bestRun).toBe(1)
    })

    it('correctly identifies BR2 as better run', () => {
      const results = [
        createResult({
          bib: '1',
          time: '85.00',
          pen: 0,
          total: '85.00', // BEST = BR2
        }),
      ]
      const cache = new Map<string, CachedBR2Data>([
        ['1', {
          run1: { total: '90.00', pen: 0, rank: 2, status: '' },
          run2: { total: '85.00', pen: 0, rank: 1, status: '' },
        }],
      ])

      const merged = mergeBR1CacheIntoBR2Results(results, cache)

      expect(merged[0].run1?.total).toBe('90.00')
      expect(merged[0].run2?.total).toBe('85.00')
      expect(merged[0].bestRun).toBe(2)
    })

    it('handles competitor not in cache', () => {
      const results = [
        createResult({ bib: '1', time: '87.00' }),
        createResult({ bib: '99', time: '95.00' }), // Not in cache
      ]
      const cache = new Map<string, CachedBR2Data>([
        ['1', {
          run1: { total: '85.00', pen: 0, rank: 1, status: '' },
          run2: { total: '91.00', pen: 4, rank: 2, status: '' },
        }],
      ])

      const merged = mergeBR1CacheIntoBR2Results(results, cache)

      expect(merged[0].run1).toBeDefined()
      expect(merged[0].run2).toBeDefined()
      expect(merged[1].run1).toBeUndefined()
      expect(merged[1].run2).toBeUndefined()
    })

    it('calculates BR2 total from WebSocket time + cached penalty', () => {
      // WebSocket: time=79.99, pen=0 (wrong - BR1 pen because BR1 better)
      // Cache: run2.pen=6 (correct BR2 penalty)
      // BR2 total should be: 79.99 + 6 = 85.99
      const results = [
        createResult({
          bib: '1',
          time: '79.99',
          pen: 0,         // Wrong! This is BR1 penalty
          total: '80.00', // BEST = BR1
        }),
      ]
      const cache = new Map<string, CachedBR2Data>([
        ['1', {
          run1: { total: '80.00', pen: 0, rank: 1, status: '' },
          run2: { total: '85.99', pen: 6, rank: 2, status: '' },  // Correct BR2: 79.99 + 6
        }],
      ])

      const merged = mergeBR1CacheIntoBR2Results(results, cache)

      expect(merged[0].run2?.total).toBe('85.99')
      expect(merged[0].run2?.pen).toBe(6)  // Correct BR2 penalty from cache
      expect(merged[0].bestRun).toBe(1)
    })

    // === DNS/DNF/DSQ Status Tests ===

    it('displays DNS status in BR2 column', () => {
      const results = [
        createResult({
          bib: '1',
          time: '',
          pen: 0,
          total: '85.00', // BEST = BR1
          status: 'DNS',  // DNS on BR2
        }),
      ]
      const cache = new Map<string, CachedBR2Data>([
        ['1', {
          run1: { total: '85.00', pen: 0, rank: 1, status: '' },
          run2: { total: '', pen: 0, rank: 0, status: 'DNS' },  // DNS in BR2
        }],
      ])

      const merged = mergeBR1CacheIntoBR2Results(results, cache)

      expect(merged[0].run1?.total).toBe('85.00')
      expect(merged[0].run1?.status).toBe('')
      expect(merged[0].run2?.total).toBe('')
      expect(merged[0].run2?.status).toBe('DNS')
      expect(merged[0].bestRun).toBe(1)
    })

    it('displays DNF status in BR1 column', () => {
      const results = [
        createResult({
          bib: '1',
          time: '87.00',
          pen: 0,
          total: '87.00', // BEST = BR2
        }),
      ]
      const cache = new Map<string, CachedBR2Data>([
        ['1', {
          run1: { total: '', pen: 0, rank: 0, status: 'DNF' },  // DNF in BR1
          run2: { total: '87.00', pen: 0, rank: 1, status: '' },
        }],
      ])

      const merged = mergeBR1CacheIntoBR2Results(results, cache)

      expect(merged[0].run1?.total).toBe('')
      expect(merged[0].run1?.status).toBe('DNF')
      expect(merged[0].run2?.total).toBe('87.00')
      expect(merged[0].run2?.status).toBe('')
      expect(merged[0].bestRun).toBe(2)
    })

    it('displays DSQ status in both columns', () => {
      const results = [
        createResult({
          bib: '1',
          time: '',
          pen: 0,
          total: '',
          status: 'DSQ',
        }),
      ]
      const cache = new Map<string, CachedBR2Data>([
        ['1', {
          run1: { total: '', pen: 0, rank: 0, status: 'DSQ' },
          run2: { total: '', pen: 0, rank: 0, status: 'DSQ' },
        }],
      ])

      const merged = mergeBR1CacheIntoBR2Results(results, cache)

      expect(merged[0].run1?.status).toBe('DSQ')
      expect(merged[0].run2?.status).toBe('DSQ')
      expect(merged[0].bestRun).toBeUndefined()
    })
  })
})
