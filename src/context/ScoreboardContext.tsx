import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import type {
  ConnectionStatus,
  OnCourseCompetitor,
  Result,
  VisibilityState,
} from '@/types'
import { defaultVisibility } from '@/types'
import type {
  DataProvider,
  ResultsData,
  OnCourseData,
  EventInfoData,
  ProviderError,
} from '@/providers/types'
import { DEPARTING_TIMEOUT } from './constants'

/**
 * Scoreboard state interface
 */
export interface ScoreboardState {
  // Connection state
  status: ConnectionStatus
  error: string | null
  initialDataReceived: boolean

  // Provider errors (parse/validation errors that don't break connection)
  providerErrors: ProviderError[]

  // Results data
  results: Result[]
  raceName: string
  raceStatus: string

  // Highlight state (timestamp-based expiration)
  highlightBib: string | null
  highlightTimestamp: number | null

  // Competitors
  currentCompetitor: OnCourseCompetitor | null
  onCourse: OnCourseCompetitor[]

  // Departing competitor (competitor who just left the course but hasn't been highlighted yet)
  departingCompetitor: OnCourseCompetitor | null
  departedAt: number | null

  // Visibility
  visibility: VisibilityState

  // Event info
  title: string
  infoText: string
  dayTime: string
}

/**
 * Context value type - state plus any actions
 */
export interface ScoreboardContextValue extends ScoreboardState {
  // Manual reconnect trigger (for error recovery)
  reconnect: () => void
  // Clear provider errors
  clearProviderErrors: () => void
}

/**
 * Create the context
 * Exported for use by useScoreboard hook
 */
export const ScoreboardContext = createContext<ScoreboardContextValue | null>(
  null
)

/**
 * Provider props
 */
interface ScoreboardProviderProps {
  provider: DataProvider
  children: ReactNode
}

/**
 * ScoreboardProvider component
 *
 * Connects to a DataProvider and manages scoreboard state.
 * Subscribes to all data callbacks and updates state accordingly.
 */
export function ScoreboardProvider({
  provider,
  children,
}: ScoreboardProviderProps) {
  // Connection state
  const [status, setStatus] = useState<ConnectionStatus>(provider.status)
  const [error, setError] = useState<string | null>(null)
  const [initialDataReceived, setInitialDataReceived] = useState(false)

  // Provider errors (parse/validation errors that don't break connection)
  const [providerErrors, setProviderErrors] = useState<ProviderError[]>([])

  // Results data
  const [results, setResults] = useState<Result[]>([])
  const [raceName, setRaceName] = useState('')
  const [raceStatus, setRaceStatus] = useState('')

  // Highlight state (timestamp-based expiration)
  const [highlightBib, setHighlightBib] = useState<string | null>(null)
  const [highlightTimestamp, setHighlightTimestamp] = useState<number | null>(
    null
  )

  // Competitors
  const [currentCompetitor, setCurrentCompetitor] =
    useState<OnCourseCompetitor | null>(null)
  const [onCourse, setOnCourse] = useState<OnCourseCompetitor[]>([])

  // Ref for onCourse to avoid stale closure in handleResults
  // This prevents the useEffect from re-running when onCourse changes
  const onCourseRef = useRef<OnCourseCompetitor[]>(onCourse)
  onCourseRef.current = onCourse

  // Departing competitor state
  const [departingCompetitor, setDepartingCompetitor] =
    useState<OnCourseCompetitor | null>(null)
  const [departedAt, setDepartedAt] = useState<number | null>(null)

  // Visibility
  const [visibility, setVisibility] =
    useState<VisibilityState>(defaultVisibility)

  // Event info
  const [title, setTitle] = useState('')
  const [infoText, setInfoText] = useState('')
  const [dayTime, setDayTime] = useState('')

  /**
   * Reset state on reconnect - clear stale data
   */
  const resetState = useCallback(() => {
    setResults([])
    setRaceName('')
    setRaceStatus('')
    setHighlightBib(null)
    setHighlightTimestamp(null)
    setCurrentCompetitor(null)
    setOnCourse([])
    setDepartingCompetitor(null)
    setDepartedAt(null)
    setInitialDataReceived(false)
    setProviderErrors([])
    // Keep visibility and event info - they will be updated
  }, [])

  /**
   * Handle results data (from top messages)
   *
   * Includes highlight deduplication logic:
   * - If highlightBib is in onCourse, don't activate highlight
   * - This prevents double-display of competitors still on course
   *
   * Also clears departing competitor when highlight arrives for them.
   *
   * Note: Uses onCourseRef to access current onCourse without causing
   * useEffect re-runs when onCourse changes.
   */
  const handleResults = useCallback((data: ResultsData) => {
    setResults(data.results)
    setRaceName(data.raceName)
    setRaceStatus(data.raceStatus)

    // Highlight activation with deduplication
    const newHighlightBib = data.highlightBib
    if (newHighlightBib) {
      // Check if the highlighted competitor is NOT in onCourse (using ref for current value)
      const isOnCourse = onCourseRef.current.some(
        (c) => c.bib === newHighlightBib
      )
      if (!isOnCourse) {
        // Only activate if this is a new highlight
        setHighlightBib((prevBib) => {
          if (prevBib !== newHighlightBib) {
            // New highlight - set timestamp
            setHighlightTimestamp(Date.now())
            return newHighlightBib
          }
          return prevBib
        })

        // Clear departing if this is the departing competitor's highlight
        setDepartingCompetitor((prev) => {
          if (prev && prev.bib === newHighlightBib) {
            setDepartedAt(null)
            return null
          }
          return prev
        })
      }
    }
    // Note: We use timestamp-based expiration, so we don't clear highlight here
    // The highlight will expire naturally via useHighlight hook

    // First top message means we have data
    setInitialDataReceived(true)
  }, []) // No dependencies - uses ref for onCourse

  /**
   * Handle on-course data (from comp/oncourse messages)
   *
   * Departing logic:
   * - When currentCompetitor changes (new or empty bib)
   * - Store the previous competitor as departing with timestamp
   * - Departing is cleared when highlight arrives or timeout expires
   */
  const handleOnCourse = useCallback(
    (data: OnCourseData) => {
      // Detect competitor change for departing logic
      setCurrentCompetitor((prevCompetitor) => {
        // If previous competitor exists and bib is different (or new is null/empty)
        if (prevCompetitor && prevCompetitor.bib !== data.current?.bib) {
          // Store previous as departing
          setDepartingCompetitor(prevCompetitor)
          setDepartedAt(Date.now())
        }
        return data.current
      })
      setOnCourse(data.onCourse)
    },
    [] // No dependencies needed as we use the callback form of setCurrentCompetitor
  )

  /**
   * Handle visibility data (from control messages)
   */
  const handleVisibility = useCallback((newVisibility: VisibilityState) => {
    setVisibility(newVisibility)
  }, [])

  /**
   * Handle event info (from title/infoText/dayTime messages)
   * Note: Only update non-empty values to allow partial updates
   */
  const handleEventInfo = useCallback((info: EventInfoData) => {
    if (info.title) setTitle(info.title)
    if (info.infoText) setInfoText(info.infoText)
    if (info.dayTime) setDayTime(info.dayTime)
  }, [])

  /**
   * Handle connection status changes
   */
  const handleConnectionChange = useCallback(
    (newStatus: ConnectionStatus) => {
      setStatus(newStatus)

      // Clear error on successful connection
      if (newStatus === 'connected') {
        setError(null)
      }

      // Reset state when reconnecting to ensure fresh data
      if (newStatus === 'reconnecting') {
        resetState()
      }
    },
    [resetState]
  )

  /**
   * Handle provider errors (parse/validation errors)
   * Keep last 10 errors to avoid unbounded growth
   */
  const handleProviderError = useCallback((providerError: ProviderError) => {
    setProviderErrors((prev) => {
      const updated = [...prev, providerError]
      // Keep only last 10 errors
      return updated.slice(-10)
    })
  }, [])

  /**
   * Clear provider errors
   */
  const clearProviderErrors = useCallback(() => {
    setProviderErrors([])
  }, [])

  /**
   * Manual reconnect trigger
   */
  const reconnect = useCallback(() => {
    setError(null)
    setProviderErrors([])
    provider.disconnect()
    provider.connect().catch((err: Error) => {
      setError(err.message || 'Connection failed')
    })
  }, [provider])

  /**
   * Subscribe to provider callbacks on mount
   *
   * Note: We intentionally only depend on `provider` to prevent
   * re-subscribing when handlers change. All handlers are stable
   * (no dependencies or use refs) so this is safe.
   */
  useEffect(() => {
    // Subscribe to all data streams
    const unsubResults = provider.onResults(handleResults)
    const unsubOnCourse = provider.onOnCourse(handleOnCourse)
    const unsubVisibility = provider.onVisibility(handleVisibility)
    const unsubEventInfo = provider.onEventInfo(handleEventInfo)
    const unsubConnection = provider.onConnectionChange(handleConnectionChange)
    const unsubError = provider.onError(handleProviderError)

    // Initial connection
    provider.connect().catch((err: Error) => {
      setError(err.message || 'Connection failed')
    })

    // Cleanup on unmount
    return () => {
      unsubResults()
      unsubOnCourse()
      unsubVisibility()
      unsubEventInfo()
      unsubConnection()
      unsubError()
      provider.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider])

  /**
   * Departing competitor timeout effect
   * Clears departing competitor after DEPARTING_TIMEOUT if no highlight arrives
   */
  useEffect(() => {
    if (!departingCompetitor || !departedAt) {
      return
    }

    const elapsed = Date.now() - departedAt
    const remaining = DEPARTING_TIMEOUT - elapsed

    // Set timeout for expiration (use Math.max(0, remaining) to handle already expired case)
    // This avoids synchronous setState within effect body
    const timeoutId = setTimeout(() => {
      setDepartingCompetitor(null)
      setDepartedAt(null)
    }, Math.max(0, remaining))

    return () => clearTimeout(timeoutId)
  }, [departingCompetitor, departedAt])

  // Build context value
  const value: ScoreboardContextValue = {
    status,
    error,
    initialDataReceived,
    providerErrors,
    results,
    raceName,
    raceStatus,
    highlightBib,
    highlightTimestamp,
    currentCompetitor,
    onCourse,
    departingCompetitor,
    departedAt,
    visibility,
    title,
    infoText,
    dayTime,
    reconnect,
    clearProviderErrors,
  }

  return (
    <ScoreboardContext.Provider value={value}>
      {children}
    </ScoreboardContext.Provider>
  )
}

/**
 * Hook to access scoreboard state
 *
 * @throws Error if used outside of ScoreboardProvider
 */
export function useScoreboard(): ScoreboardContextValue {
  const context = useContext(ScoreboardContext)
  if (!context) {
    throw new Error('useScoreboard must be used within a ScoreboardProvider')
  }
  return context
}
