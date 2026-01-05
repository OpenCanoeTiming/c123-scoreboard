/**
 * Utilities for working with race IDs and BR1/BR2 (Best Run) format
 *
 * Race ID format: {CLASS}_{COURSE}_{RUN}_{VERSION}
 * Examples:
 * - K1M_ST_BR1_6 (K1 Men, Short Track, Best Run 1, version 6)
 * - K1M_ST_BR2_6 (K1 Men, Short Track, Best Run 2, version 6)
 * - C2M_LT_XF_3 (C2 Men, Long Track, Cross Final, version 3)
 */

/**
 * Check if a race is a second run (BR2) race.
 *
 * BR2 races show merged results combining BR1 and BR2 times,
 * displaying the best of two runs for each competitor.
 *
 * @param raceId - Race identifier (e.g., "K1M_ST_BR2_6")
 * @returns true if this is a BR2 race
 */
export function isBR2Race(raceId: string): boolean {
  return raceId.includes('_BR2_')
}

/**
 * Check if a race is a first run (BR1) race.
 *
 * @param raceId - Race identifier (e.g., "K1M_ST_BR1_6")
 * @returns true if this is a BR1 race
 */
export function isBR1Race(raceId: string): boolean {
  return raceId.includes('_BR1_')
}

/**
 * Check if a race is a Best Run format (either BR1 or BR2).
 *
 * @param raceId - Race identifier
 * @returns true if this is a BR1 or BR2 race
 */
export function isBestRunRace(raceId: string): boolean {
  return isBR1Race(raceId) || isBR2Race(raceId)
}

/**
 * Extract class ID from race ID.
 *
 * The class ID identifies the boat class and track combination,
 * used to fetch merged results from the REST API.
 *
 * @param raceId - Race identifier (e.g., "K1M_ST_BR2_6")
 * @returns Class ID (e.g., "K1M_ST") or the full raceId if pattern not matched
 *
 * @example
 * getClassId("K1M_ST_BR2_6") // "K1M_ST"
 * getClassId("C2M_LT_BR1_3") // "C2M_LT"
 * getClassId("InvalidId") // "InvalidId"
 */
export function getClassId(raceId: string): string {
  // Match pattern: anything before _BR1_ or _BR2_
  const match = raceId.match(/^(.+)_BR[12]_/)
  return match ? match[1] : raceId
}

/**
 * Get the run number from a race ID (1 or 2).
 *
 * @param raceId - Race identifier
 * @returns 1 for BR1, 2 for BR2, or null if not a Best Run race
 */
export function getRunNumber(raceId: string): 1 | 2 | null {
  if (isBR1Race(raceId)) return 1
  if (isBR2Race(raceId)) return 2
  return null
}

/**
 * Get the corresponding race ID for the other run.
 *
 * @param raceId - Race identifier (e.g., "K1M_ST_BR1_6")
 * @returns The other run's race ID (e.g., "K1M_ST_BR2_6"), or null if not a BR race
 */
export function getOtherRunRaceId(raceId: string): string | null {
  if (isBR1Race(raceId)) {
    return raceId.replace('_BR1_', '_BR2_')
  }
  if (isBR2Race(raceId)) {
    return raceId.replace('_BR2_', '_BR1_')
  }
  return null
}
