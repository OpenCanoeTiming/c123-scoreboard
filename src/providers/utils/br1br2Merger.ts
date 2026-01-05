/**
 * BR1/BR2 Merger - Merges first run and second run results
 *
 * When a BR2 race is active, this module fetches BR1 results from REST API
 * and merges them with the current BR2 results from WebSocket.
 *
 * Key concepts:
 * - TCP stream sends Total = best of both runs (not BR2 total!)
 * - BR2 total can be calculated: Time + Pen from TCP
 * - BR1 data comes from REST API with debounced fetch
 */

import type { Result, RunResult, ResultStatus } from '@/types'
import type { MergedResults, MergedResultRow, C123ServerApi } from './c123ServerApi'
import { isBR2Race } from '@/utils/raceUtils'

// =============================================================================
// Types
// =============================================================================

/**
 * BR2 merge state - tracks whether we're in BR2 mode
 */
export interface BR2MergeState {
  /** Whether current race is BR2 */
  isBR2: boolean
  /** Current BR2 race ID (if in BR2 mode) */
  raceId: string | null
  /** Cached BR1 results by bib */
  br1Cache: Map<string, RunResult>
  /** Last fetch timestamp for debouncing */
  lastFetchTime: number
  /** Pending fetch timeout ID */
  pendingFetchTimeout: ReturnType<typeof setTimeout> | null
}

/**
 * Create initial BR2 merge state
 */
export function createBR2MergeState(): BR2MergeState {
  return {
    isBR2: false,
    raceId: null,
    br1Cache: new Map(),
    lastFetchTime: 0,
    pendingFetchTimeout: null,
  }
}

// =============================================================================
// Merge Logic
// =============================================================================

/**
 * Debounce delay for REST API fetch (ms)
 * Prevents excessive API calls when multiple Results messages arrive quickly
 */
const FETCH_DEBOUNCE_MS = 500

/**
 * Convert centiseconds to formatted time string (e.g., "78.99")
 */
function formatCentiseconds(cs: number): string {
  if (cs <= 0) return ''
  const seconds = cs / 100
  return seconds.toFixed(2)
}

/**
 * Parse time string to centiseconds for comparison
 */
function parseTimeToCs(time: string): number {
  if (!time || time === '') return Infinity
  const seconds = parseFloat(time)
  if (isNaN(seconds)) return Infinity
  return Math.round(seconds * 100)
}

/**
 * Determine which run was better (lower total time)
 *
 * @param run1Total - First run total in centiseconds
 * @param run2Total - Second run total in centiseconds
 * @returns 1 if run1 is better, 2 if run2 is better, or undefined if can't compare
 */
function determineBestRun(run1Total: number | null, run2Total: number | null): 1 | 2 | undefined {
  if (run1Total === null && run2Total === null) return undefined
  if (run1Total === null || run1Total <= 0) return 2
  if (run2Total === null || run2Total <= 0) return 1
  return run1Total <= run2Total ? 1 : 2
}

/**
 * Convert MergedResultRow to RunResult
 */
function toRunResult(row: MergedResultRow['run1'] | MergedResultRow['run2']): RunResult | undefined {
  if (!row) return undefined
  return {
    total: formatCentiseconds(row.total),
    pen: row.pen,
    rank: row.rank,
    status: '' as ResultStatus, // REST API provides numeric data, not status strings
  }
}

/**
 * Merge BR1 data into BR2 results
 *
 * Takes current results (from TCP stream) and enriches them with BR1 data (from REST API).
 *
 * @param results - Current results from TCP stream
 * @param mergedData - BR1+BR2 data from REST API
 * @returns Results with run1, run2, and bestRun populated
 */
export function mergeBR1IntoBR2Results(
  results: Result[],
  mergedData: MergedResults | null
): Result[] {
  if (!mergedData || !mergedData.results) {
    return results
  }

  // Create lookup map from REST API data
  const mergedMap = new Map<string, MergedResultRow>()
  for (const row of mergedData.results) {
    mergedMap.set(row.bib, row)
  }

  // Enrich each result with BR1/BR2 data
  return results.map(result => {
    const merged = mergedMap.get(result.bib)
    if (!merged) {
      // No merged data for this competitor - return as-is
      return result
    }

    // Build run1 and run2 from merged data
    const run1 = toRunResult(merged.run1)
    const run2 = toRunResult(merged.run2)

    // Determine best run
    const run1Total = merged.run1?.total ?? null
    const run2Total = merged.run2?.total ?? null
    const bestRun = determineBestRun(run1Total, run2Total)

    return {
      ...result,
      run1,
      run2,
      bestRun,
    }
  })
}

/**
 * Merge BR1 cache data into BR2 results (when REST API not available)
 *
 * Uses locally cached BR1 data when API fetch fails or is pending.
 *
 * @param results - Current results from TCP stream
 * @param br1Cache - Cached BR1 results by bib
 * @returns Results with run1, run2, and bestRun populated from cache
 */
export function mergeBR1CacheIntoBR2Results(
  results: Result[],
  br1Cache: Map<string, RunResult>
): Result[] {
  if (br1Cache.size === 0) {
    return results
  }

  return results.map(result => {
    const run1 = br1Cache.get(result.bib)
    if (!run1) {
      // No cached BR1 data for this competitor - return as-is
      return result
    }

    // Calculate run2 from current result (TCP data)
    // TCP sends: Time=BR2 time, Pen=BR2 penalty, Total=best of both runs
    // So BR2 total needs to be calculated if we want to show it
    // For now, we use the result.total which is the best run total
    const run2: RunResult = {
      total: result.total,
      pen: result.pen,
      rank: result.rank,
      status: result.status || '',
    }

    // Determine best run by comparing totals
    const run1Cs = parseTimeToCs(run1.total || '')
    const run2Cs = parseTimeToCs(run2.total || '')
    const bestRun = determineBestRun(run1Cs, run2Cs)

    return {
      ...result,
      run1,
      run2,
      bestRun,
    }
  })
}

// =============================================================================
// BR2 Manager Class
// =============================================================================

/**
 * BR2 Manager - Handles BR1/BR2 merge logic
 *
 * Coordinates:
 * - Detection of BR2 races
 * - Debounced REST API fetch for BR1 data
 * - Merging BR1 data into results
 */
export class BR2Manager {
  private state: BR2MergeState
  private api: C123ServerApi
  private onMergedResults: (results: Result[]) => void

  constructor(api: C123ServerApi, onMergedResults: (results: Result[]) => void) {
    this.state = createBR2MergeState()
    this.api = api
    this.onMergedResults = onMergedResults
  }

  /**
   * Check if currently in BR2 mode
   */
  get isBR2Mode(): boolean {
    return this.state.isBR2
  }

  /**
   * Process incoming Results and handle BR2 merging
   *
   * @param results - Current results from TCP stream
   * @param raceId - Current race ID
   * @returns Processed results (may be merged if BR2)
   */
  processResults(results: Result[], raceId: string): Result[] {
    const isBR2 = isBR2Race(raceId)

    // Check if race changed
    if (raceId !== this.state.raceId) {
      this.cancelPendingFetch()
      this.state = {
        ...createBR2MergeState(),
        isBR2,
        raceId,
      }
    }

    if (!isBR2) {
      // Not BR2 - return results as-is
      return results
    }

    // BR2 race - schedule debounced fetch and return results with cache merge
    this.scheduleFetch(raceId, results)

    // Apply cached BR1 data while waiting for fresh fetch
    if (this.state.br1Cache.size > 0) {
      return mergeBR1CacheIntoBR2Results(results, this.state.br1Cache)
    }

    return results
  }

  /**
   * Schedule debounced fetch of BR1 data
   */
  private scheduleFetch(raceId: string, currentResults: Result[]): void {
    // Cancel any pending fetch
    this.cancelPendingFetch()

    // Schedule new fetch
    this.state.pendingFetchTimeout = setTimeout(async () => {
      try {
        const merged = await this.api.getMergedResults(raceId)
        if (merged && merged.results) {
          // Update cache from merged results
          this.updateCache(merged)

          // Emit merged results
          const mergedResults = mergeBR1IntoBR2Results(currentResults, merged)
          this.onMergedResults(mergedResults)
        }
      } catch (err) {
        console.warn('BR2Manager: Failed to fetch merged results:', err)
      } finally {
        this.state.lastFetchTime = Date.now()
        this.state.pendingFetchTimeout = null
      }
    }, FETCH_DEBOUNCE_MS)
  }

  /**
   * Update BR1 cache from merged results
   */
  private updateCache(merged: MergedResults): void {
    this.state.br1Cache.clear()
    for (const row of merged.results) {
      if (row.run1) {
        this.state.br1Cache.set(row.bib, toRunResult(row.run1)!)
      }
    }
  }

  /**
   * Cancel pending fetch timeout
   */
  private cancelPendingFetch(): void {
    if (this.state.pendingFetchTimeout) {
      clearTimeout(this.state.pendingFetchTimeout)
      this.state.pendingFetchTimeout = null
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.cancelPendingFetch()
    this.state = createBR2MergeState()
  }
}
