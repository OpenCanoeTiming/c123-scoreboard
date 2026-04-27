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
import {
  DEPARTING_TIMEOUT,
  FINISH_DISPLAY_DURATION,
  FINISHED_GRACE_PERIOD,
  STALE_COMPETITOR_TIMEOUT,
} from './constants'
import { getCategoryFromRaceId } from '@/utils/raceUtils'

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
  raceId: string // Current race ID being displayed

  // Active race tracking for Results filtering
  // This ensures we display results for the race that's actually running
  activeRaceId: string | null // Race ID from current on-course competitors
  lastActiveRaceId: string | null // Last known active race (for when no one is on course)

  // Highlight state (timestamp-based expiration)
  highlightBib: string | null
  highlightTimestamp: number | null

  // Competitors
  currentCompetitor: OnCourseCompetitor | null
  onCourse: OnCourseCompetitor[]

  // Track when competitors finished (got dtFinish) for grace period removal
  // Maps bib -> timestamp when dtFinish was first detected
  // Competitors are removed from onCourse after FINISHED_GRACE_PERIOD
  onCourseFinishedAt: Record<string, number>

  // Track when each competitor was last seen in an OnCourse message
  // Maps bib -> timestamp of last message containing this competitor
  // Competitors not seen for STALE_COMPETITOR_TIMEOUT are evicted
  onCourseLastSeenAt: Record<string, number>

  // Departing competitor (competitor who just left the course but hasn't been highlighted yet)
  departingCompetitor: OnCourseCompetitor | null
  departedAt: number | null

  // Pending highlight - bib that just finished but waiting for results to update
  // The actual highlight triggers when results contain updated data for this bib
  pendingHighlightBib: string | null
  // Timestamp when the pending highlight was set, used for timeout-based fallback
  pendingHighlightTimestamp: number | null

  // Visibility
  visibility: VisibilityState

  // Event info
  title: string
  infoText: string
  dayTime: string

  // Fixed category filter from URL parameter (?category=K1M)
  // When set, only data matching this category prefix is accepted
  fixedCategory: string | null
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
      raceId: string | null
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
  raceId: '',
  activeRaceId: null,
  lastActiveRaceId: null,
  highlightBib: null,
  highlightTimestamp: null,
  currentCompetitor: null,
  onCourse: [],
  onCourseFinishedAt: {},
  onCourseLastSeenAt: {},
  departingCompetitor: null,
  departedAt: null,
  pendingHighlightBib: null,
  pendingHighlightTimestamp: null,
  visibility: defaultVisibility,
  title: '',
  infoText: '',
  dayTime: '',
  fixedCategory: null,
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
      // Fixed category filter: takes precedence over targetRaceId logic
      if (state.fixedCategory && action.raceId) {
        const incomingCategory = getCategoryFromRaceId(action.raceId)
        if (incomingCategory !== state.fixedCategory) {
          // Results for a different category — clear stale results
          return {
            ...state,
            results: [],
            raceName: '',
            raceStatus: '',
            raceId: '',
          }
        }
        // Category matches — proceed to update results below
      } else {
        // Original targetRaceId filtering (no fixedCategory set)
        // Determine which race we should display results for:
        // 1. If someone is on course → their race (activeRaceId)
        // 2. If no one is on course → last active race (lastActiveRaceId)
        // 3. If no history → accept any results
        const targetRaceId = state.activeRaceId || state.lastActiveRaceId

        // Filter results: only update if they match the target race
        // This prevents random category results from appearing when they shouldn't
        // But if we have no target race yet, accept any results (initial state)
        if (targetRaceId && action.raceId && action.raceId !== targetRaceId) {
          // Results are for a different race than what's currently active - ignore
          // This fixes the issue where C123 sends rotated results for all categories
          return state
        }
      }

      // Check if we have a pending highlight that matches a result in the new results
      // The highlight triggers when results contain the competitor who just finished
      const newState: ScoreboardState = {
        ...state,
        results: action.results,
        raceName: action.raceName,
        raceStatus: action.raceStatus,
        raceId: action.raceId || state.raceId,
        initialDataReceived: true,
      }

      // If we have a pending highlight, check if results contain this competitor
      // We trigger highlight when:
      // 1. Results contain the competitor who just finished
      // 2. The pending was set recently (within 10 seconds) to avoid stale highlights
      if (state.pendingHighlightBib && state.pendingHighlightTimestamp) {
        const result = action.results.find(r => r.bib.trim() === state.pendingHighlightBib)
        const pendingAge = Date.now() - state.pendingHighlightTimestamp

        // Only trigger if pending is fresh (within 10 seconds) and result exists
        // This prevents stale pending highlights from triggering on unrelated result updates
        if (result && pendingAge < 10000) {
          // Results contain the competitor - trigger highlight
          // Note: We don't compare totals because in BR2 the result.total is the best
          // of both runs, while OnCourse total is just the current run's time.
          // This fixes highlight not working when second run is worse.
          newState.highlightBib = state.pendingHighlightBib
          newState.highlightTimestamp = Date.now()
          newState.pendingHighlightBib = null
          newState.pendingHighlightTimestamp = null
          // Clear departing if this was the departing competitor.
          // Exception: if the departing competitor has dtFinish, let the
          // timeout path clear it so the finisher stays pinned in the
          // CurrentCompetitor slot for the full FINISH_DISPLAY_DURATION
          // instead of being cut short by the results update.
          if (
            state.departingCompetitor?.bib === state.pendingHighlightBib &&
            !state.departingCompetitor?.dtFinish
          ) {
            newState.departingCompetitor = null
            newState.departedAt = null
          }
        } else if (pendingAge >= 10000) {
          // Pending expired without getting results - clear it
          newState.pendingHighlightBib = null
          newState.pendingHighlightTimestamp = null
        }
      }

      return newState
    }

    case 'SET_ON_COURSE': {
      // Fixed category filter: reject data from non-matching categories
      if (state.fixedCategory) {
        const incomingRaceId = action.current?.raceId
          || action.onCourse.find(c => c.raceId)?.raceId
          || ''
        const incomingCategory = getCategoryFromRaceId(incomingRaceId)

        if (incomingCategory && incomingCategory !== state.fixedCategory) {
          return {
            ...state,
            currentCompetitor: null,
            onCourse: [],
            onCourseFinishedAt: {},
            onCourseLastSeenAt: {},
            activeRaceId: null,
            lastActiveRaceId: state.lastActiveRaceId &&
              getCategoryFromRaceId(state.lastActiveRaceId) === state.fixedCategory
              ? state.lastActiveRaceId
              : null,
            departingCompetitor: null,
            departedAt: null,
            pendingHighlightBib: null,
            pendingHighlightTimestamp: null,
          }
        }
      }

      // Only update onCourse if updateOnCourse flag is true (from oncourse message)
      // comp messages set updateOnCourse=false to preserve existing onCourse list
      const shouldUpdateOnCourse = action.updateOnCourse !== false

      // For partial/merge messages (C123), detect finish BEFORE filtering
      // This allows us to catch the dtFinish transition before removing finished competitors
      let partialFinishBib: string | null = null
      if (!shouldUpdateOnCourse && action.current?.dtFinish) {
        const prevComp = state.onCourse.find(c => c.bib === action.current!.bib)
        if (prevComp && !prevComp.dtFinish) {
          // Competitor just finished - remember for highlight detection later
          partialFinishBib = action.current.bib
        }
      }

      let newOnCourse: OnCourseCompetitor[]
      if (shouldUpdateOnCourse) {
        // Full list from oncourse message
        newOnCourse = action.onCourse
      } else if (action.current) {
        // comp/partial message - update existing competitor in onCourse list or add if not present
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

        // NOTE: Finished competitors (dtFinish) stay in list for grace period display
      } else {
        newOnCourse = state.onCourse
      }

      // Track when competitors finished (got dtFinish) for grace period removal
      const now = Date.now()
      const newFinishedAt: Record<string, number> = { ...state.onCourseFinishedAt }

      // Add newly finished competitors to tracking
      for (const comp of newOnCourse) {
        if (comp.dtFinish && !newFinishedAt[comp.bib]) {
          // Just finished - record timestamp
          newFinishedAt[comp.bib] = now
        }
      }

      // Remove competitors whose grace period has expired
      // Also clean up tracking for competitors no longer in list
      const validBibs = new Set(newOnCourse.map(c => c.bib))
      for (const bib of Object.keys(newFinishedAt)) {
        if (!validBibs.has(bib)) {
          // Competitor no longer in list - clean up tracking
          delete newFinishedAt[bib]
        } else if (now - newFinishedAt[bib] > FINISHED_GRACE_PERIOD) {
          // Grace period expired - will be filtered out below
        }
      }

      // Filter out finished competitors whose grace period has expired
      newOnCourse = newOnCourse.filter(c => {
        if (!c.dtFinish) return true // Not finished - keep
        const finishedAt = newFinishedAt[c.bib]
        if (!finishedAt) return true // No tracking - keep (shouldn't happen)
        if (now - finishedAt <= FINISHED_GRACE_PERIOD) return true // Within grace period - keep
        // Grace period expired - remove
        delete newFinishedAt[c.bib]
        return false
      })

      // Remove stale competitors that C123 stopped reporting
      // This handles DNS/skip at end of category: C123 just stops sending
      // OnCourse for removed competitors without an explicit dtFinish.
      // Only applies to partial/merge messages — full-replace messages
      // are authoritative and don't need stale cleanup.
      const newLastSeenAt: Record<string, number> = shouldUpdateOnCourse
        ? {} // Full replace — reset tracking, all competitors are fresh
        : { ...state.onCourseLastSeenAt }

      // Update lastSeenAt for bibs in the incoming message
      if (action.current) {
        newLastSeenAt[action.current.bib] = now
      }
      for (const comp of action.onCourse) {
        // Only track competitors who have actually started — action.onCourse may
        // include competitors in the start queue (no dtStart) who are filtered out
        // by the mapper. action.current is always started, so no guard needed there.
        if (comp.dtStart) {
          newLastSeenAt[comp.bib] = now
        }
      }

      // For full-replace, seed all competitors in the new list
      if (shouldUpdateOnCourse) {
        for (const comp of newOnCourse) {
          newLastSeenAt[comp.bib] = now
        }
      }

      // Evict stale competitors (only from partial messages — full-replace is authoritative)
      if (!shouldUpdateOnCourse) {
        newOnCourse = newOnCourse.filter(c => {
          if (c.dtFinish) return true // Finished — managed by grace period, not stale timeout
          const lastSeen = newLastSeenAt[c.bib]
          if (!lastSeen) return true // No tracking — keep (newly added)
          if (now - lastSeen <= STALE_COMPETITOR_TIMEOUT) return true // Fresh — keep
          // Stale — remove
          delete newLastSeenAt[c.bib]
          return false
        })
      }

      // Clean up tracking for bibs no longer in the list
      const finalBibs = new Set(newOnCourse.map(c => c.bib))
      for (const bib of Object.keys(newLastSeenAt)) {
        if (!finalBibs.has(bib)) {
          delete newLastSeenAt[bib]
        }
      }

      // currentCompetitor is always the oldest (lowest dtStart) from onCourse
      // This ensures stable selection when multiple competitors are on course
      // IMPORTANT: Filter out finished competitors (dtFinish) for current selection
      // They stay in onCourse for display but shouldn't be "current"
      const activeOnCourse = newOnCourse.filter(c => !c.dtFinish)
      let newCurrent: OnCourseCompetitor | null = null
      if (activeOnCourse.length === 1) {
        newCurrent = activeOnCourse[0]
      } else if (activeOnCourse.length > 1) {
        // Sort by dtStart ascending (oldest first)
        const sorted = [...activeOnCourse].sort((a, b) => {
          if (!a.dtStart && !b.dtStart) return 0
          if (!a.dtStart) return 1
          if (!b.dtStart) return -1
          return a.dtStart.localeCompare(b.dtStart)
        })
        newCurrent = sorted[0]
      }

      // Determine active race from on-course competitors
      // This is used to filter Results to show only the current race
      let newActiveRaceId: string | null = null
      if (newCurrent?.raceId) {
        newActiveRaceId = newCurrent.raceId
      } else if (newOnCourse.length > 0) {
        // Use first competitor's raceId if current is not set
        const firstWithRaceId = newOnCourse.find(c => c.raceId)
        if (firstWithRaceId) {
          newActiveRaceId = firstWithRaceId.raceId || null
        }
      }

      const newState: ScoreboardState = {
        ...state,
        currentCompetitor: newCurrent,
        onCourse: newOnCourse,
        onCourseFinishedAt: newFinishedAt,
        onCourseLastSeenAt: newLastSeenAt,
        activeRaceId: newActiveRaceId,
        // Update lastActiveRaceId when we have a new active race
        // This preserves the last known race when no one is on course
        lastActiveRaceId: newActiveRaceId || state.lastActiveRaceId,
      }

      // Clear results when category changes
      // This prevents showing results from previous category when new category starts
      // Condition: new active race exists, differs from currently displayed results,
      // and we have results to clear
      // NOTE: We only clear if state.raceId is set. CLI/replay messages don't provide
      // RaceId in top messages, so results have raceId: ''. Without this check,
      // oncourse messages would wipe CLI results when they arrive with a raceId.
      if (newActiveRaceId && state.raceId && newActiveRaceId !== state.raceId && state.results.length > 0) {
        newState.results = []
        newState.raceName = ''
        newState.raceId = ''
        newState.raceStatus = ''
      }

      // Atomic departing update - if previous competitor exists and bib differs.
      // If the departing competitor just finished, prefer the version from
      // newOnCourse (which has dtFinish + final time) over the stale prev copy.
      // This allows App.tsx to pin finishers for FINISH_DISPLAY_DURATION.
      const prev = state.currentCompetitor
      if (prev && prev.bib !== newCurrent?.bib) {
        const finishedVersion = newOnCourse.find(
          c => c.bib === prev.bib && c.dtFinish
        )
        newState.departingCompetitor = finishedVersion ?? prev
        newState.departedAt = Date.now()
      }

      // Detect finish by dtFinish transition (null -> timestamp)
      // This works independently of CLI HighlightBib and is protocol-agnostic
      // (works with CLI, C123, and Replay providers)
      //
      // IMPORTANT: We don't trigger highlight immediately. Instead, we store
      // the pending highlight info and wait for SET_RESULTS to contain the
      // actual updated result for this competitor. This ensures the scroll
      // and highlight happen at the right time.
      //
      // For partial messages (C123), finish is detected earlier (partialFinishBib)
      // because finished competitors are filtered out of newOnCourse.
      if (partialFinishBib) {
        // Finish detected from partial message before filtering
        newState.pendingHighlightBib = partialFinishBib
        newState.pendingHighlightTimestamp = Date.now()
      } else {
        // For full list messages (CLI oncourse), scan the list for finish transitions
        for (const curr of newOnCourse) {
          const prevComp = state.onCourse.find(c => c.bib === curr.bib)
          // Only trigger if we've seen this competitor before without dtFinish
          // This prevents false highlights on reconnect or initial load
          if (prevComp && !prevComp.dtFinish && curr.dtFinish) {
            // Competitor just finished - set pending highlight with timestamp
            // Actual highlight will trigger in SET_RESULTS when results contain this bib
            // Note: We don't store curr.total because in BR2 the Results total differs
            // from OnCourse total (Results has best of both runs, OnCourse has current run)
            newState.pendingHighlightBib = curr.bib
            newState.pendingHighlightTimestamp = Date.now()
            break // Only one competitor can finish at a time
          }
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
        fixedCategory: state.fixedCategory,
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
  fixedCategory?: string
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
  fixedCategory,
  children,
}: ScoreboardProviderProps) {
  const [state, dispatch] = useReducer(scoreboardReducer, {
    ...initialState,
    status: provider.status,
    fixedCategory: fixedCategory?.toUpperCase() || null,
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
      raceId: data.raceId ?? null,
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
   * Finishers (dtFinish) stay for FINISH_DISPLAY_DURATION so the final time
   * gets a visible pause in the CurrentCompetitor slot. Non-finishers clear
   * after the shorter DEPARTING_TIMEOUT.
   */
  useEffect(() => {
    if (!state.departingCompetitor || !state.departedAt) {
      return
    }

    const timeout = state.departingCompetitor.dtFinish
      ? FINISH_DISPLAY_DURATION
      : DEPARTING_TIMEOUT
    const elapsed = Date.now() - state.departedAt
    const remaining = timeout - elapsed

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
