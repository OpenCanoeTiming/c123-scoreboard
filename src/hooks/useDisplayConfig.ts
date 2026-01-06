import { useMemo } from 'react'

/**
 * Display configuration from URL parameters
 *
 * These parameters control visibility and filtering of scoreboard sections.
 * Can be set via URL params or ConfigPush from C123 Server.
 *
 * URL Parameters:
 * - ?showOnCourse=true/false - Show/hide OnCourse section (default: true)
 * - ?showResults=true/false - Show/hide Results section (default: true)
 * - ?raceFilter=K1M_ST,K1W_ST - Only show results for these races (comma-separated)
 */
export interface DisplayConfig {
  /** Whether to show OnCourse/CurrentCompetitor section (default: true) */
  showOnCourse: boolean
  /** Whether to show Results section (default: true) */
  showResults: boolean
  /** Race IDs to filter (empty = show all) */
  raceFilter: string[]
}

/**
 * Parse display configuration from URL parameters
 */
function getDisplayConfigFromURL(): DisplayConfig {
  if (typeof window === 'undefined') {
    return { showOnCourse: true, showResults: true, raceFilter: [] }
  }

  const params = new URLSearchParams(window.location.search)

  // showOnCourse: default true, explicit 'false' disables
  const showOnCourse = params.get('showOnCourse') !== 'false'

  // showResults: default true, explicit 'false' disables
  const showResults = params.get('showResults') !== 'false'

  // raceFilter: comma-separated list of race IDs
  const raceFilterParam = params.get('raceFilter')
  const raceFilter = raceFilterParam
    ? raceFilterParam.split(',').map(id => id.trim()).filter(id => id.length > 0)
    : []

  return { showOnCourse, showResults, raceFilter }
}

/**
 * Check if a race ID matches the filter
 *
 * @param raceId - Race ID to check (e.g., "K1M_ST_BR2_6")
 * @param filter - Array of race ID prefixes to match (e.g., ["K1M_ST", "K1W_ST"])
 * @returns true if filter is empty or raceId starts with any filter prefix
 */
export function matchesRaceFilter(raceId: string, filter: string[]): boolean {
  if (filter.length === 0) return true
  return filter.some(prefix => raceId.startsWith(prefix))
}

/**
 * Hook for display configuration
 *
 * Reads URL parameters for showOnCourse, showResults, and raceFilter.
 * Used to control visibility of scoreboard sections.
 *
 * @example
 * ```tsx
 * const { showOnCourse, showResults, raceFilter } = useDisplayConfig()
 *
 * return (
 *   <>
 *     {showOnCourse && <CurrentCompetitor ... />}
 *     {showResults && <ResultsList ... />}
 *   </>
 * )
 * ```
 */
export function useDisplayConfig(): DisplayConfig {
  // URL params don't change during session (memoized once)
  const config = useMemo(() => getDisplayConfigFromURL(), [])
  return config
}

export default useDisplayConfig
