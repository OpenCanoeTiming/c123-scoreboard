import { useEffect, useState } from 'react'
import type { Clock } from '../clock/clock'
import { emptyStore, type StoreState } from '../store/store'
import { startTransport, type FetchLike, type OpenSocket, type TransportStatus } from '../transport/transport'
import type { ConnectionView } from './boardView'

export type LiveStoreOptions = {
  /** The server's HTTP origin, e.g. `http://192.168.1.50:27123`. */
  serverUrl: string
  fetch: FetchLike
  openSocket: OpenSocket
  clock: Clock
}

export type LiveStore = { state: StoreState; connection: ConnectionView }

/** A stale connection keeps what it holds and shows the reconnecting dot while the handshake repeats. */
const CONNECTION: Record<TransportStatus, ConnectionView> = {
  connecting: 'connecting',
  live: 'live',
  stale: 'reconnecting',
}

/** The store the transport keeps in step with the server, and the state of the connection dot. */
export function useLiveStore({ serverUrl, fetch, openSocket, clock }: LiveStoreOptions): LiveStore {
  const [state, setState] = useState<StoreState>(emptyStore)
  const [status, setStatus] = useState<TransportStatus>('connecting')

  useEffect(
    () => startTransport({ serverUrl, fetch, openSocket, clock, onState: setState, onStatus: setStatus }),
    [serverUrl, fetch, openSocket, clock]
  )

  return { state, connection: CONNECTION[status] }
}
