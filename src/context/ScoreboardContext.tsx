import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useReducer,
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
 * Reducer action types for atomic state updates
 */
type ScoreboardAction =
  | { type: 'SET_STATUS'; status: ConnectionStatus }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'ADD_PROVIDER_ERROR'; error: ProviderError }
  | { type: 'CLEAR_PROVIDER_ERRORS' }
  | {
      type: 'SET_RESULTS'
      results: Result[]
      raceName: string
      raceStatus: string
      highlightBib: string | null
    }
  | {
      type: 'SET_ON_COURSE'
      current: OnCourseCompetitor | null
      onCourse: OnCourseCompetitor[]
      updateOnCourse?: boolean
    }
  | { type: 'SET_VISIBILITY'; visibility: VisibilityState }
  | { type: 'SET_EVENT_INFO'; title?: string; infoText?: string; dayTime?: string }
  | { type: 'CLEAR_DEPARTING' }
  | { type: 'RESET_STATE' }

/**
 * Initial state
 */
const initialState: ScoreboardState = {
  status: 'disconnected',
  error: null,
  initialDataReceived: false,
  providerErrors: [],
  results: [],
  raceName: '',
  raceStatus: '',
  highlightBib: null,
  highlightTimestamp: null,
  currentCompetitor: null,
  onCourse: [],
  departingCompetitor: null,
  departedAt: null,
  visibility: defaultVisibility,
  title: '',
  infoText: '',
  dayTime: '',
}

/**
 * Reducer for atomic state updates
 * Ensures related state changes happen together
 */
function scoreboardReducer(
  state: ScoreboardState,
  action: ScoreboardAction
): ScoreboardState {
  switch (action.type) {
    case 'SET_STATUS': {
      const newState = { ...state, status: action.status }
      if (action.status === 'connected') {
        newState.error = null
      }
      return newState
    }

    case 'SET_ERROR':
      return { ...state, error: action.error }

    case 'ADD_PROVIDER_ERROR': {
      const updated = [...state.providerErrors, action.error]
      return { ...state, providerErrors: updated.slice(-10) }
    }

    case 'CLEAR_PROVIDER_ERRORS':
      return { ...state, providerErrors: [] }

    case 'SET_RESULTS': {
      // Note: We intentionally ignore action.highlightBib from CLI.
      // Highlight is triggered by dtFinish transition in SET_ON_COURSE instead.
      // This makes the system protocol-agnostic (works with CLI, C123, Replay).
      // The dtFinish detection in oncourse data is the source of truth for finish timing.
      return {
        ...state,
        results: action.results,
        raceName: action.raceName,
        raceStatus: action.raceStatus,
        initialDataReceived: true,
      }
    }

    case 'SET_ON_COURSE': {
      // Only update onCourse if updateOnCourse flag is true (from oncourse message)
      // comp messages set updateOnCourse=false to preserve existing onCourse list
      const shouldUpdateOnCourse = action.updateOnCourse !== false

      let newOnCourse: OnCourseCompetitor[]
      if (shouldUpdateOnCourse) {
        // Full list from oncourse message
        newOnCourse = action.onCourse
      } else if (action.current) {
        // comp message - update existing competitor in onCourse list or add if not present
        const existingIndex = state.onCourse.findIndex(c => c.bib === action.current!.bib)
        if (existingIndex >= 0) {
          // Update existing competitor's data, preserving dtStart/dtFinish from oncourse
          // (comp messages don't include these fields but oncourse messages do)
          const existing = state.onCourse[existingIndex]
          newOnCourse = [...state.onCourse]
          newOnCourse[existingIndex] = {
            ...action.current,
            dtStart: action.current.dtStart || existing.dtStart,
            dtFinish: action.current.dtFinish || existing.dtFinish,
          }
        } else {
          // New competitor - add to list
          newOnCourse = [...state.onCourse, action.current]
        }
      } else {
        newOnCourse = state.onCourse
      }

      // currentCompetitor is always the oldest (lowest dtStart) from onCourse
      // This ensures stable selection when multiple competitors are on course
      let newCurrent: OnCourseCompetitor | null = null
      if (newOnCourse.length === 1) {
        newCurrent = newOnCourse[0]
      } else if (newOnCourse.length > 1) {
        // Sort by dtStart ascending (oldest first)
        const sorted = [...newOnCourse].sort((a, b) => {
          if (!a.dtStart && !b.dtStart) return 0
          if (!a.dtStart) return 1
          if (!b.dtStart) return -1
          return a.dtStart.localeCompare(b.dtStart)
        })
        newCurrent = sorted[0]
      }

      const newState: ScoreboardState = {
        ...state,
        currentCompetitor: newCurrent,
        onCourse: newOnCourse,
      }

      // Atomic departing update - if previous competitor exists and bib differs
      const prev = state.currentCompetitor
      if (prev && prev.bib !== newCurrent?.bib) {
        newState.departingCompetitor = prev
        newState.departedAt = Date.now()
      }

      // Detect finish by dtFinish transition (null -> timestamp)
      // This works independently of CLI HighlightBib and is protocol-agnostic
      // (works with CLI, C123, and Replay providers)
      for (const curr of newOnCourse) {
        const prevComp = state.onCourse.find(c => c.bib === curr.bib)
        // Only trigger if we've seen this competitor before without dtFinish
        // This prevents false highlights on reconnect or initial load
        if (prevComp && !prevComp.dtFinish && curr.dtFinish) {
          // Competitor just finished - trigger highlight
          newState.highlightBib = curr.bib
          newState.highlightTimestamp = Date.now()
          // Clear departing if this was the departing competitor
          if (state.departingCompetitor?.bib === curr.bib) {
            newState.departingCompetitor = null
            newState.departedAt = null
          }
          break // Only one competitor can finish at a time
        }
      }

      return newState
    }

    case 'SET_VISIBILITY':
      // Override certain visibility flags to always be true
      // These should be displayed regardless of CLI instructions
      return {
        ...state,
        visibility: {
          ...action.visibility,
          displayTopBar: true, // logos always visible
          displayTitle: true, // title always visible
          displayFooter: true, // footer always visible
          displayCurrent: true, // current competitor always visible
          displayTop: true, // results always visible
          displayOnCourse: true, // on-course list always visible
        },
      }

    case 'SET_EVENT_INFO':
      return {
        ...state,
        title: action.title || state.title,
        infoText: action.infoText || state.infoText,
        dayTime: action.dayTime || state.dayTime,
      }

    case 'CLEAR_DEPARTING':
      return { ...state, departingCompetitor: null, departedAt: null }

    case 'RESET_STATE':
      return {
        ...initialState,
        status: state.status,
        visibility: state.visibility,
        title: state.title,
        infoText: state.infoText,
        dayTime: state.dayTime,
      }

    default:
      return state
  }
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
 * Uses useReducer for atomic state updates of related fields.
 */
export function ScoreboardProvider({
  provider,
  children,
}: ScoreboardProviderProps) {
  const [state, dispatch] = useReducer(scoreboardReducer, {
    ...initialState,
    status: provider.status,
  })

  /**
   * Handle results data (from top messages)
   * Atomic update of results + highlight state
   */
  const handleResults = useCallback((data: ResultsData) => {
    dispatch({
      type: 'SET_RESULTS',
      results: data.results,
      raceName: data.raceName,
      raceStatus: data.raceStatus,
      highlightBib: data.highlightBib ?? null,
    })
  }, [])

  /**
   * Handle on-course data (from comp/oncourse messages)
   * Reducer handles departing detection by comparing with current state
   */
  const handleOnCourse = useCallback((data: OnCourseData) => {
    dispatch({
      type: 'SET_ON_COURSE',
      current: data.current,
      onCourse: data.onCourse,
      updateOnCourse: data.updateOnCourse,
    })
  }, [])

  /**
   * Handle visibility data (from control messages)
   */
  const handleVisibility = useCallback((newVisibility: VisibilityState) => {
    dispatch({ type: 'SET_VISIBILITY', visibility: newVisibility })
  }, [])

  /**
   * Handle event info (from title/infoText/dayTime messages)
   */
  const handleEventInfo = useCallback((info: EventInfoData) => {
    dispatch({
      type: 'SET_EVENT_INFO',
      title: info.title,
      infoText: info.infoText,
      dayTime: info.dayTime,
    })
  }, [])

  /**
   * Handle connection status changes
   */
  const handleConnectionChange = useCallback((newStatus: ConnectionStatus) => {
    dispatch({ type: 'SET_STATUS', status: newStatus })
    if (newStatus === 'reconnecting') {
      dispatch({ type: 'RESET_STATE' })
    }
  }, [])

  /**
   * Handle provider errors (parse/validation errors)
   */
  const handleProviderError = useCallback((providerError: ProviderError) => {
    dispatch({ type: 'ADD_PROVIDER_ERROR', error: providerError })
  }, [])

  /**
   * Clear provider errors
   */
  const clearProviderErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_PROVIDER_ERRORS' })
  }, [])

  /**
   * Manual reconnect trigger
   */
  const reconnect = useCallback(() => {
    dispatch({ type: 'SET_ERROR', error: null })
    dispatch({ type: 'CLEAR_PROVIDER_ERRORS' })
    provider.disconnect()
    provider.connect().catch((err: Error) => {
      dispatch({ type: 'SET_ERROR', error: err.message || 'Connection failed' })
    })
  }, [provider])

  /**
   * Subscribe to provider callbacks on mount
   */
  useEffect(() => {
    const unsubResults = provider.onResults(handleResults)
    const unsubOnCourse = provider.onOnCourse(handleOnCourse)
    const unsubVisibility = provider.onVisibility(handleVisibility)
    const unsubEventInfo = provider.onEventInfo(handleEventInfo)
    const unsubConnection = provider.onConnectionChange(handleConnectionChange)
    const unsubError = provider.onError(handleProviderError)

    provider.connect().catch((err: Error) => {
      dispatch({ type: 'SET_ERROR', error: err.message || 'Connection failed' })
    })

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
    if (!state.departingCompetitor || !state.departedAt) {
      return
    }

    const elapsed = Date.now() - state.departedAt
    const remaining = DEPARTING_TIMEOUT - elapsed

    const timeoutId = setTimeout(() => {
      dispatch({ type: 'CLEAR_DEPARTING' })
    }, Math.max(0, remaining))

    return () => clearTimeout(timeoutId)
  }, [state.departingCompetitor, state.departedAt])

  // Build context value
  const value: ScoreboardContextValue = {
    ...state,
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
