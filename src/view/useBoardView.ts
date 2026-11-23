import { createContext, useContext } from 'react'
import type { BoardView } from './boardView'

/** Carries the BoardView from its producer to the components. */
export const BoardViewContext = createContext<BoardView | null>(null)

/** The current BoardView. Must be used under a BoardViewContext provider. */
export function useBoardView(): BoardView {
  const view = useContext(BoardViewContext)
  if (!view) {
    throw new Error('useBoardView must be used within a BoardViewContext provider')
  }
  return view
}
