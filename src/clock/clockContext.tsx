import { createContext, useContext, type ReactNode } from 'react'
import type { Clock } from './clock'
import { productionClock } from './productionClock'

const ClockContext = createContext<Clock>(productionClock)

/** Hands one Clock to every timing site below it (TEST-ARCHITECTURE §5). */
export function ClockProvider({ clock, children }: { clock: Clock; children: ReactNode }) {
  return <ClockContext.Provider value={clock}>{children}</ClockContext.Provider>
}

/** The injected Clock; the production Clock when nothing above provides one. */
// eslint-disable-next-line react-refresh/only-export-components
export function useClock(): Clock {
  return useContext(ClockContext)
}
