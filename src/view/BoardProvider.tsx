import { useMemo, type ReactNode } from 'react'
import type { Clock } from '../clock/clock'
import type { StoreState } from '../store/store'
import type { ConnectionView } from './boardView'
import { displayPolicy as defaultPolicy, type DisplayPolicy } from './displayPolicy'
import { selectBoardView } from './selectBoardView'
import { BoardViewContext } from './useBoardView'

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

/** Store + view-model + Clock -> the BoardView the components render. */
export function BoardProvider({
  store,
  clock,
  connection,
  policy = defaultPolicy,
  category = null,
  children,
}: BoardProviderProps) {
  const view = useMemo(
    () => ({ ...selectBoardView(store, policy, clock, { category }), connection }),
    [store, policy, clock, category, connection]
  )
  return <BoardViewContext.Provider value={view}>{children}</BoardViewContext.Provider>
}
