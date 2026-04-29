/**
 * C123 Server REST API Client
 *
 * HTTP client for C123 Server REST endpoints.
 * Used for syncing data after reconnect and fetching merged BR1/BR2 results.
 */

import type { C123ScheduleData, C123RaceConfigData, C123ResultsData } from '@/types/c123server'

// =============================================================================
// Types
// =============================================================================

/** Server status response from /api/status */
export interface ServerStatus {
  version: string
  uptime: number
  sources: Array<{
    name: string
    type: string
    status: 'connected' | 'connecting' | 'disconnected'
    host?: string
    port?: number
    path?: string
  }>
  scoreboards: {
    connected: number
    list: Array<{
      id: string
      connectedAt: string
      lastActivity: string
    }>
  }
  event: {
    currentRaceId: string | null
    raceName: string | null
    onCourseCount: number
    resultsCount: number
  }
}

/** XML status response from /api/xml/status */
export interface XmlStatus {
  available: boolean
  path: string | null
  lastModified: string | null
  checksum: string | null
  participantCount: number
  scheduleCount: number
}

/** Race info from /api/xml/races/:id */
export interface RaceInfo {
  raceId: string
  classId: string
  disId: string
  name: string
  startTime: string
  raceOrder: number
  raceStatus: number
  participantCount: number
  hasResults: boolean
  startlistCount?: number
  resultsCount?: number
  relatedRaces?: string[]
}

/** Single run result */
export interface RunResult {
  time: number // centiseconds
  pen: number
  total: number // centiseconds
  rank: number
  status?: string // DNS, DNF, DSQ, or empty for valid
}

/** Merged BR1+BR2 result row */
export interface MergedResultRow {
  bib: string
  participantId: string
  familyName: string
  givenName: string
  club: string
  run1?: RunResult
  run2?: RunResult
  bestTotal: number // centiseconds
  bestRank: number
}

/** Merged results response */
export interface MergedResults {
  results: MergedResultRow[]
  merged: true
  classId: string
}

/** REST API result row (from /api/xml/races/:id/results) */
export interface RestResultRow {
  raceId: string
  id: string
  startOrder: number
  bib: string
  startTime?: string
  time?: number        // centiseconds
  pen?: number
  total?: number       // centiseconds
  rank?: number
  catRank?: number
  prevTime?: number    // BR1 time in centiseconds
  prevPen?: number
  prevTotal?: number   // BR1 total in centiseconds
  prevRank?: number
  gates?: string
  status?: string      // DNS, DNF, DSQ
  participant?: {
    familyName: string
    givenName: string
    club: string
    classId: string
    [key: string]: unknown
  }
}

/** REST results response */
export interface RestRaceResults {
  results: RestResultRow[]
}

// =============================================================================
// API Client Class
// =============================================================================

/**
 * REST API client for C123 Server
 *
 * Provides methods for fetching data from C123 Server REST endpoints.
 * All methods return null on error (logged to console).
 */
export class C123ServerApi {
  private baseUrl: string
  private timeout: number

  /**
   * Create API client instance
   *
   * @param baseUrl - Server base URL (e.g., "http://192.168.1.50:27123")
   * @param timeout - Request timeout in ms (default: 5000)
   */
  constructor(baseUrl: string, timeout: number = 5000) {
    // Remove trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.timeout = timeout
  }

  /**
   * Generic fetch with timeout and error handling
   */
  private async fetch<T>(path: string): Promise<T | null> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit',
      })

      if (!response.ok) {
        console.warn(`C123 API request failed: ${path} (${response.status})`)
        return null
      }

      return await response.json()
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn(`C123 API request timed out: ${path}`)
      } else {
        console.warn(`C123 API request failed: ${path}`, err)
      }
      return null
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // ===========================================================================
  // Server Status
  // ===========================================================================

  /**
   * Get server status including connected sources and event info
   */
  async getStatus(): Promise<ServerStatus | null> {
    return this.fetch<ServerStatus>('/api/status')
  }

  /**
   * Get XML data availability status
   */
  async getXmlStatus(): Promise<XmlStatus | null> {
    return this.fetch<XmlStatus>('/api/xml/status')
  }

  // ===========================================================================
  // Schedule
  // ===========================================================================

  /**
   * Get race schedule (list of all races)
   */
  async getSchedule(): Promise<C123ScheduleData | null> {
    const response = await this.fetch<{ schedule: C123ScheduleData['races'] }>('/api/xml/schedule')
    if (!response) return null
    return { races: response.schedule }
  }

  // ===========================================================================
  // Results
  // ===========================================================================

  /**
   * Get race info
   *
   * @param raceId - Race identifier (e.g., "K1M_ST_BR1_6")
   */
  async getRaceInfo(raceId: string): Promise<RaceInfo | null> {
    const response = await this.fetch<{ race: RaceInfo }>(`/api/xml/races/${encodeURIComponent(raceId)}`)
    return response?.race ?? null
  }

  /**
   * Get merged BR1+BR2 results for a class
   *
   * @param raceId - Any race ID from the class (BR1 or BR2)
   */
  async getMergedResults(raceId: string): Promise<MergedResults | null> {
    return this.fetch<MergedResults>(`/api/xml/races/${encodeURIComponent(raceId)}/results?merged=true`)
  }

  /**
   * Get results for a race via REST API.
   *
   * Returns raw REST format (times in centiseconds, nested participant).
   * Use mapRestResultsToWsFormat() to convert for scoreboard consumption.
   */
  async getResultsForRace(raceId: string): Promise<RestRaceResults | null> {
    return this.fetch<RestRaceResults>(`/api/xml/races/${encodeURIComponent(raceId)}/results`)
  }

  /**
   * Get race config (number of gates, etc.)
   *
   * Note: This comes from WebSocket messages, not REST API.
   * Provided here for sync purposes if needed.
   */
  async getRaceConfig(): Promise<C123RaceConfigData | null> {
    // RaceConfig is not exposed via REST API in current C123 Server version
    // It comes through WebSocket. Return null for now.
    return null
  }
}

// =============================================================================
// REST → WS Format Mapper
// =============================================================================

/**
 * Format centiseconds as seconds string (e.g., 75320 → "75.32")
 */
function formatCentiseconds(cs: number | undefined): string {
  if (cs === undefined || cs === 0) return ''
  return (cs / 100).toFixed(2)
}

/**
 * Calculate behind string from leader's total.
 * Returns "" for the leader, "+X.XX" for others.
 */
function calculateBehind(total: number | undefined, leaderTotal: number | undefined): string {
  if (!total || !leaderTotal || total === leaderTotal) return ''
  const diff = (total - leaderTotal) / 100
  return `+${diff.toFixed(2)}`
}

/**
 * Map REST API results to C123ResultsData format (WS-compatible).
 *
 * REST returns times in centiseconds and nested participant data.
 * WS format uses formatted strings and flat row structure.
 */
export function mapRestResultsToC123Format(
  results: RestRaceResults,
  raceId: string,
  raceInfo: RaceInfo,
): C123ResultsData {
  const leaderTotal = results.results[0]?.total
  return {
    raceId,
    classId: raceInfo.classId,
    isCurrent: raceInfo.raceStatus === 3,
    mainTitle: raceInfo.classId,
    subTitle: '',
    rows: results.results.map(r => ({
      rank: r.rank ?? 0,
      bib: r.bib,
      name: `${r.participant?.familyName ?? ''} ${r.participant?.givenName ?? ''}`.trim(),
      familyName: r.participant?.familyName ?? '',
      givenName: r.participant?.givenName ?? '',
      club: r.participant?.club ?? '',
      nat: '',
      startOrder: r.startOrder,
      startTime: r.startTime ?? '',
      gates: r.gates?.trim() ?? '',
      pen: r.pen ?? 0,
      time: formatCentiseconds(r.time),
      total: formatCentiseconds(r.total),
      behind: calculateBehind(r.total, leaderTotal),
      status: r.status,
      prevTime: r.prevTime,
      prevPen: r.prevPen,
      prevTotal: r.prevTotal,
      prevRank: r.prevRank,
    })),
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create API client from server URL
 *
 * @param serverUrl - Server URL (e.g., "http://192.168.1.50:27123")
 * @param timeout - Request timeout in ms
 */
export function createC123Api(serverUrl: string, timeout?: number): C123ServerApi {
  return new C123ServerApi(serverUrl, timeout)
}
