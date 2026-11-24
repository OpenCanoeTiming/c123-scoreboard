import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Clock } from '../clock/clock'
import type { StoreState } from '../store/store'
import type { ConnectionView } from './boardView'
import { displayPolicy as defaultPolicy, type DisplayPolicy } from './displayPolicy'
import { anyOpen, emptyLifetimes, observeLifetimes, type Lifetimes } from './lifetimes'
import { selectBoardView } from './selectBoardView'
import { BoardViewContext } from './useBoardView'
import { useLiveStore, type LiveStoreOptions } from './useLiveStore'

interface BoardProviderProps {
  /** The store's domain state */
  store: StoreState
  clock: Clock
  /** The transport's connection state */
  connection: ConnectionView
  policy?: DisplayPolicy
  /** `?category=`: the class the board is pinned to */
  category?: string | null
  children: ReactNode
}

/**
 * Store + view-model + Clock -> the BoardView the components render.
 *
 * Every new store is observed for the receipt stamps of the display lifetimes, on the Clock. While a
 * lifetime is open, the view is re-evaluated on a Clock tick of `policy.lifetimes.tickPeriodMs`, so a
 * lapsed lifetime ends without new data (CLIENT-OBLIGATIONS L121).
 */
export function BoardProvider({
  store,
  clock,
  connection,
  policy = defaultPolicy,
  category = null,
  children,
}: BoardProviderProps) {
  const [seen, setSeen] = useState<{ store: StoreState; lifetimes: Lifetimes }>({ store, lifetimes: emptyLifetimes })
  let lifetimes = seen.lifetimes
  if (seen.store !== store) {
    lifetimes = observeLifetimes(seen.lifetimes, seen.store, store, clock.now())
    setSeen({ store, lifetimes })
  }

  const [tick, setTick] = useState(0)
  const { finishDisplayMs, finishedGraceMs, highlightMs, departingMs, tickPeriodMs } = policy.lifetimes
  const open = anyOpen(lifetimes, Math.max(finishDisplayMs, finishedGraceMs, highlightMs, departingMs), clock.now())
  useEffect(() => {
    if (!open) return
    const handle = clock.setTimeout(() => setTick((t) => t + 1), tickPeriodMs)
    return () => clock.clearTimeout(handle)
  }, [open, tick, clock, tickPeriodMs])

  const view = useMemo(
    () => ({ ...selectBoardView(store, policy, clock, { category, lifetimes }), connection }),
    // `tick` re-evaluates the lifetimes against the Clock
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, policy, clock, category, connection, lifetimes, tick]
  )
  return <BoardViewContext.Provider value={view}>{children}</BoardViewContext.Provider>
}

type LiveBoardProviderProps = LiveStoreOptions & Omit<BoardProviderProps, 'store' | 'connection'>

/**
 * The live board: the transport keeps a store in step with the server (`?server=` or discovery), and
 * BoardProvider turns it into the BoardView. The connection dot is the transport's state.
 */
export function LiveBoardProvider({ serverUrl, fetch, openSocket, clock, ...board }: LiveBoardProviderProps) {
  const live = useLiveStore({ serverUrl, fetch, openSocket, clock })
  return <BoardProvider store={live.state} clock={clock} connection={live.connection} {...board} />
}
