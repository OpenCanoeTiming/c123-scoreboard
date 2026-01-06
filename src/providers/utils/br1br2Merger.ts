/**
 * BR1/BR2 Merger - Merges first run and second run results
 *
 * Data sources:
 * - BR1: REST API (getMergedResults) - stable, fetched once per race
 * - BR2: WebSocket Results - LIVE! Calculate from time + pen
 *        (NOT total - that's BEST of both runs!)
 *
 * Key insight from TCP stream:
 * - Time = BR2 time (without penalty)
 * - Pen = BR2 penalty
 * - Total = BEST of both runs (NOT BR2 total!)
 * - BR2 total = Time + Pen
 */

import type { Result, RunResult, ResultStatus } from '@/types'
import type { MergedResults, MergedResultRow, C123ServerApi } from './c123ServerApi'
import { isBR2Race } from '@/utils/raceUtils'

// =============================================================================
// Types
// =============================================================================

/**
 * Cached BR1 and BR2 data for a competitor
 * Both from REST API - WebSocket's pen field contains BEST run's penalty, not BR2!
 */
interface CachedBR2Data {
  run1: RunResult
  run2: RunResult | undefined  // undefined = hasn't run BR2 yet
}

/**
 * OnCourse penalty entry with timestamp for grace period
 */
interface OnCoursePenaltyEntry {
  pen: number
  lastSeen: number  // timestamp when last seen in OnCourse
}

/**
 * BR2 merge state
 */
export interface BR2MergeState {
  isBR2: boolean
  raceId: string | null
  cache: Map<string, CachedBR2Data>
  /** Live penalties from OnCourse - with timestamp for grace period */
  onCoursePenalties: Map<string, OnCoursePenaltyEntry>
  lastFetchTime: number
  pendingFetchTimeout: ReturnType<typeof setTimeout> | null
  refreshIntervalId: ReturnType<typeof setInterval> | null
  debounceFetchTimeout: ReturnType<typeof setTimeout> | null
}

export function createBR2MergeState(): BR2MergeState {
  return {
    isBR2: false,
    raceId: null,
    cache: new Map(),
    onCoursePenalties: new Map(),
    lastFetchTime: 0,
    pendingFetchTimeout: null,
    refreshIntervalId: null,
    debounceFetchTimeout: null,
  }
}

// =============================================================================
// Constants
// =============================================================================

const INITIAL_FETCH_DELAY_MS = 500
const DEBOUNCE_FETCH_MS = 1000  // Debounce for fetching on each Results
const BR1_REFRESH_INTERVAL_MS = 30_000
const ONCOURSE_PENALTY_GRACE_MS = 10_000  // Keep OnCourse penalty for 10s after leaving

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert milliseconds to formatted time string (e.g., "78.99")
 * REST API returns time values in milliseconds
 */
function formatMilliseconds(ms: number): string {
  if (ms <= 0) return ''
  const seconds = ms / 1000
  return seconds.toFixed(2)
}

/**
 * Calculate BR2 total from WebSocket's time + pen
 * This is the CORRECT BR2 total (not result.total which is BEST!)
 */
function calculateBR2Total(time: string | undefined, pen: number): string {
  if (!time || time === '' || time === '0') return ''
  const timeSeconds = parseFloat(time)
  if (isNaN(timeSeconds)) return ''
  const total = timeSeconds + pen
  return total.toFixed(2)
}

/**
 * Parse time string to milliseconds for comparison
 */
function parseTimeToMs(time: string): number {
  if (!time || time === '') return Infinity
  const seconds = parseFloat(time)
  if (isNaN(seconds)) return Infinity
  return Math.round(seconds * 1000)
}

/**
 * Check if status is a valid invalid status (DNS/DNF/DSQ)
 */
function isInvalidStatus(status: string | undefined): status is 'DNS' | 'DNF' | 'DSQ' {
  return status === 'DNS' || status === 'DNF' || status === 'DSQ'
}

/**
 * Convert REST API run data to RunResult
 * Handles both valid results and DNS/DNF/DSQ status
 */
function toRunResult(row: MergedResultRow['run1']): RunResult | undefined {
  // Check for undefined/null OR empty object (REST API returns {} for no data)
  if (!row || Object.keys(row).length === 0) return undefined

  // Has invalid status (DNS/DNF/DSQ)
  if (isInvalidStatus(row.status)) {
    return {
      total: '',
      pen: row.pen ?? 0,
      rank: row.rank ?? 0,
      status: row.status as ResultStatus,
    }
  }

  // Has valid time
  if (row.total > 0) {
    return {
      total: formatMilliseconds(row.total),
      pen: row.pen,
      rank: row.rank,
      status: '' as ResultStatus,
    }
  }

  // No valid time and no status - not started yet
  return undefined
}

// =============================================================================
// Merge Logic
// =============================================================================

/**
 * Merge cached BR1/BR2 data into results
 *
 * IMPORTANT: WebSocket's `pen` field contains penalty from BEST run, not BR2!
 * So we use REST API data for both runs.
 *
 * Penalty priority (most accurate first):
 * 1. OnCourse penalties - live, most up-to-date (even after finish)
 * 2. REST API cache - authoritative but may be delayed
 * 3. WebSocket pen - only correct when BR2 is better than BR1
 *
 * @param results - Current results from WebSocket
 * @param cache - Cached BR1 and BR2 results from REST API
 * @param onCoursePenalties - Live penalties from OnCourse messages (with timestamps)
 * @returns Results with run1, run2, and bestRun populated
 */
export function mergeBR1CacheIntoBR2Results(
  results: Result[],
  cache: Map<string, CachedBR2Data>,
  onCoursePenalties: Map<string, OnCoursePenaltyEntry> = new Map()
): Result[] {
  if (cache.size === 0 && onCoursePenalties.size === 0) {
    return results
  }

  return results.map(result => {
    const cached = cache.get(result.bib)
    const hasBR2Time = result.time !== undefined && result.time !== '' && result.time !== '0'

    // Get penalty from best source available
    // Priority: OnCourse (live) > REST cache > WebSocket (may be wrong)
    const onCoursePen = onCoursePenalties.get(result.bib)?.pen

    // Not in cache - try to show BR2 from WebSocket if available
    if (!cached) {
      if (hasBR2Time) {
        // Use OnCourse penalty if available (most accurate for just-finished)
        const br2Pen = onCoursePen ?? result.pen
        const br2Total = calculateBR2Total(result.time, br2Pen)
        return {
          ...result,
          run2: {
            total: br2Total,
            pen: br2Pen,
            rank: result.rank,
            status: '' as ResultStatus,
          },
        }
      }
      return result
    }

    const { run1, run2: cachedRun2 } = cached

    // BR2: Build from WebSocket (live) + cache (for status/penalty accuracy)
    // WebSocket is primary source for BR2 time, cache provides status and accurate penalty
    let run2: RunResult | undefined

    // Check for invalid status first (DSQ/DNS/DNF from cache)
    if (cachedRun2?.status === 'DSQ' || cachedRun2?.status === 'DNS' || cachedRun2?.status === 'DNF') {
      // Invalid status from REST API - authoritative
      run2 = cachedRun2
    } else if (hasBR2Time) {
      // WebSocket has BR2 time - use it (live data)
      // Penalty priority: OnCourse (live) > cache (REST API) > WebSocket
      const br2Pen = onCoursePen ?? cachedRun2?.pen ?? result.pen
      const br2Total = calculateBR2Total(result.time, br2Pen)
      run2 = {
        total: br2Total,
        pen: br2Pen,
        rank: result.rank,
        status: '',
      }
    } else if (cachedRun2) {
      // No live time, but cache has data (competitor ran earlier)
      run2 = cachedRun2
    }
    // else: no BR2 data from either source - leave undefined

    // Determine best run
    const run1Ms = parseTimeToMs(run1.total || '')
    const run2Ms = run2 ? parseTimeToMs(run2.total || '') : null
    let bestRun: 1 | 2 | undefined
    if (run1Ms === Infinity && (run2Ms === null || run2Ms === Infinity)) {
      // Both runs invalid or only run1 exists and is invalid
      bestRun = undefined
    } else if (run2Ms === null || run2Ms === Infinity) {
      // run1 valid, run2 missing or invalid
      bestRun = 1
    } else if (run1Ms === Infinity) {
      // run1 invalid, run2 valid
      bestRun = 2
    } else {
      // Both valid - pick better time
      bestRun = run1Ms <= run2Ms ? 1 : 2
    }

    return {
      ...result,
      run1,
      run2,
      bestRun,
    }
  })
}

// Legacy export for backward compatibility
export function mergeBR1IntoBR2Results(results: Result[], _mergedData: unknown): Result[] {
  return results
}

// =============================================================================
// BR2 Manager Class
// =============================================================================

/**
 * BR2 Manager - Handles BR1/BR2 merge logic
 *
 * Fetches BR1 data from REST API (once + periodic refresh)
 * Merges with live BR2 data from WebSocket
 */
export class BR2Manager {
  private state: BR2MergeState
  private api: C123ServerApi
  private onCacheUpdated?: () => void

  constructor(api: C123ServerApi, onCacheUpdated?: () => void) {
    this.state = createBR2MergeState()
    this.api = api
    this.onCacheUpdated = onCacheUpdated
  }

  get isBR2Mode(): boolean {
    return this.state.isBR2
  }

  /**
   * Update live penalties from OnCourse data
   * OnCourse has the most up-to-date penalty info, even for just-finished competitors
   *
   * Keeps penalties for a grace period after competitor leaves OnCourse,
   * preventing fallback to wrong WebSocket penalty before REST cache catches up.
   *
   * @param competitors - OnCourse competitors with their current penalties
   */
  updateOnCoursePenalties(competitors: Array<{ bib: string; pen: number }>): void {
    if (!this.state.isBR2) return

    const now = Date.now()
    const currentBibs = new Set(competitors.map(c => c.bib))

    // Update current competitors
    for (const comp of competitors) {
      this.state.onCoursePenalties.set(comp.bib, {
        pen: comp.pen,
        lastSeen: now,
      })
    }

    // Remove entries older than grace period
    for (const [bib, entry] of this.state.onCoursePenalties) {
      if (!currentBibs.has(bib) && now - entry.lastSeen > ONCOURSE_PENALTY_GRACE_MS) {
        this.state.onCoursePenalties.delete(bib)
      }
    }
  }

  /**
   * Process incoming Results
   */
  processResults(results: Result[], raceId: string): Result[] {
    const isBR2 = isBR2Race(raceId)

    // Race changed?
    if (raceId !== this.state.raceId) {
      this.stopAllFetching()
      this.state = {
        ...createBR2MergeState(),
        isBR2,
        raceId,
      }

      if (isBR2) {
        this.startBR1Fetching(raceId)
      }
    }

    if (!isBR2) {
      return results
    }

    // Trigger debounced fetch on each Results message
    // BR2 penalties arrive gradually, so we need to refresh frequently
    this.triggerDebouncedFetch(raceId)

    // Apply cached BR1/BR2 data + live OnCourse penalties
    if (this.state.cache.size > 0 || this.state.onCoursePenalties.size > 0) {
      return mergeBR1CacheIntoBR2Results(
        results,
        this.state.cache,
        this.state.onCoursePenalties
      )
    }

    return results
  }

  /**
   * Trigger debounced fetch - called on each Results message
   */
  private triggerDebouncedFetch(raceId: string): void {
    // Clear existing debounce timeout
    if (this.state.debounceFetchTimeout) {
      clearTimeout(this.state.debounceFetchTimeout)
    }

    // Schedule fetch after debounce period
    this.state.debounceFetchTimeout = setTimeout(() => {
      this.fetchBR1Data(raceId)
      this.state.debounceFetchTimeout = null
    }, DEBOUNCE_FETCH_MS)
  }

  private startBR1Fetching(raceId: string): void {
    this.state.pendingFetchTimeout = setTimeout(async () => {
      await this.fetchBR1Data(raceId)
      this.state.pendingFetchTimeout = null

      this.state.refreshIntervalId = setInterval(() => {
        this.fetchBR1Data(raceId)
      }, BR1_REFRESH_INTERVAL_MS)
    }, INITIAL_FETCH_DELAY_MS)
  }

  private async fetchBR1Data(raceId: string): Promise<void> {
    try {
      const merged = await this.api.getMergedResults(raceId)
      if (merged && merged.results) {
        this.updateCache(merged)
        console.log(`BR2Manager: Loaded ${this.state.cache.size} results for ${raceId}`)

        // Always trigger update - cache content may have changed (new run2 data)
        // even if cache size is the same
        if (this.onCacheUpdated) {
          this.onCacheUpdated()
        }
      }
    } catch (err) {
      console.warn('BR2Manager: Failed to fetch results:', err)
    } finally {
      this.state.lastFetchTime = Date.now()
    }
  }

  /**
   * Update cache with BOTH run1 and run2 from REST API
   * WebSocket pen field contains BEST run's penalty, so we need REST API for correct BR2 penalty
   * Includes DNS/DNF/DSQ status for both runs
   */
  private updateCache(merged: MergedResults): void {
    this.state.cache.clear()
    for (const row of merged.results) {
      const run1Result = toRunResult(row.run1)
      // Include competitor if they have any run data (valid time OR status)
      if (run1Result) {
        this.state.cache.set(row.bib, {
          run1: run1Result,
          run2: toRunResult(row.run2),
        })
      }
    }
  }

  private stopAllFetching(): void {
    if (this.state.pendingFetchTimeout) {
      clearTimeout(this.state.pendingFetchTimeout)
      this.state.pendingFetchTimeout = null
    }
    if (this.state.refreshIntervalId) {
      clearInterval(this.state.refreshIntervalId)
      this.state.refreshIntervalId = null
    }
    if (this.state.debounceFetchTimeout) {
      clearTimeout(this.state.debounceFetchTimeout)
      this.state.debounceFetchTimeout = null
    }
  }

  dispose(): void {
    this.stopAllFetching()
    this.state = createBR2MergeState()
  }
}
