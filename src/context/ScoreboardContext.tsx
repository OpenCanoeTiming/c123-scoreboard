import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
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
} from '@/providers/types'

/**
 * Highlight duration in milliseconds (5 seconds)
 */
export const HIGHLIGHT_DURATION = 5000

/**
 * Scoreboard state interface
 */
export interface ScoreboardState {
  // Connection state
  status: ConnectionStatus
  error: string | null
  initialDataReceived: boolean

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
interface ScoreboardContextValue extends ScoreboardState {
  // Manual reconnect trigger (for error recovery)
  reconnect: () => void
}

/**
 * Create the context
 */
const ScoreboardContext = createContext<ScoreboardContextValue | null>(null)

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
    setInitialDataReceived(false)
    // Keep visibility and event info - they will be updated
  }, [])

  /**
   * Handle results data (from top messages)
   *
   * Includes highlight deduplication logic:
   * - If highlightBib is in onCourse, don't activate highlight
   * - This prevents double-display of competitors still on course
   */
  const handleResults = useCallback(
    (data: ResultsData) => {
      setResults(data.results)
      setRaceName(data.raceName)
      setRaceStatus(data.raceStatus)

      // Highlight activation with deduplication
      const newHighlightBib = data.highlightBib
      if (newHighlightBib) {
        // Check if the highlighted competitor is NOT in onCourse
        const isOnCourse = onCourse.some((c) => c.bib === newHighlightBib)
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
        }
      } else {
        // highlightBib is null/empty from server - clear immediately
        // Note: We use timestamp-based expiration, so we don't clear here
        // The highlight will expire naturally via useHighlight hook
      }

      // First top message means we have data
      setInitialDataReceived(true)
    },
    [onCourse]
  )

  /**
   * Handle on-course data (from comp/oncourse messages)
   */
  const handleOnCourse = useCallback((data: OnCourseData) => {
    setCurrentCompetitor(data.current)
    setOnCourse(data.onCourse)
  }, [])

  /**
   * Handle visibility data (from control messages)
   */
  const handleVisibility = useCallback((newVisibility: VisibilityState) => {
    setVisibility(newVisibility)
  }, [])

  /**
   * Handle event info (from title/infoText/dayTime messages)
   */
  const handleEventInfo = useCallback((info: EventInfoData) => {
    setTitle(info.title)
    setInfoText(info.infoText)
    setDayTime(info.dayTime)
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
   * Manual reconnect trigger
   */
  const reconnect = useCallback(() => {
    setError(null)
    provider.disconnect()
    provider.connect().catch((err: Error) => {
      setError(err.message || 'Connection failed')
    })
  }, [provider])

  /**
   * Subscribe to provider callbacks on mount
   */
  useEffect(() => {
    // Subscribe to all data streams
    const unsubResults = provider.onResults(handleResults)
    const unsubOnCourse = provider.onOnCourse(handleOnCourse)
    const unsubVisibility = provider.onVisibility(handleVisibility)
    const unsubEventInfo = provider.onEventInfo(handleEventInfo)
    const unsubConnection = provider.onConnectionChange(handleConnectionChange)

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
      provider.disconnect()
    }
  }, [
    provider,
    handleResults,
    handleOnCourse,
    handleVisibility,
    handleEventInfo,
    handleConnectionChange,
  ])

  // Build context value
  const value: ScoreboardContextValue = {
    status,
    error,
    initialDataReceived,
    results,
    raceName,
    raceStatus,
    highlightBib,
    highlightTimestamp,
    currentCompetitor,
    onCourse,
    visibility,
    title,
    infoText,
    dayTime,
    reconnect,
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
