// Connects the store to a c123-server on-site process (CONTRACTS §1.6, §7.1, §7.2): the hydration
// handshake, the same handshake after every reconnection, and the liveness watch on the injected Clock.
// `fetch`, the WebSocket and the Clock are injected; nothing here reads real time.
import type {
  ClassPhasesResponse,
  ErrorEnvelope,
  EventCurrentResponse,
  WsMessage,
} from '@opencanoetiming/c123-contract'
import type { Clock, TimerHandle } from '../clock/clock'
import { applyMessage, hydrate, type StoreState } from '../store/store'

/** §7.2 `heartbeatSeconds`: `sources.updated` arrives at least this often. */
export const HEARTBEAT_MS = 10_000
/** Two missed heartbeat intervals: the connection is dead (§7.2 Liveness). */
export const LIVENESS_TIMEOUT_MS = 2 * HEARTBEAT_MS
/** Pause before a new handshake after the stream closed or a read failed. */
export const RECONNECT_DELAY_MS = 1_000

/** The part of `fetch` the transport uses. */
export type FetchLike = (url: string) => Promise<{ status: number; json(): Promise<unknown> }>

export type SocketHandlers = { open(): void; message(data: string): void; close(): void }
/** Opens a WebSocket to `url`, reporting to `on`. */
export type OpenSocket = (url: string, on: SocketHandlers) => { close(): void }

/** `connecting`: nothing hydrated yet; `stale`: what is held is shown, marked stale, while the handshake repeats. */
export type TransportStatus = 'connecting' | 'live' | 'stale'

export type TransportOptions = {
  /** The server's HTTP origin, e.g. `http://192.168.1.50:27123`. */
  serverUrl: string
  fetch: FetchLike
  openSocket: OpenSocket
  clock: Clock
  onState(state: StoreState): void
  onStatus(status: TransportStatus): void
}

/** The browser WebSocket behind `OpenSocket`. */
export const browserSocket: OpenSocket = (url, on) => {
  const ws = new WebSocket(url)
  ws.onopen = () => on.open()
  ws.onmessage = (ev) => on.message(String(ev.data))
  ws.onclose = () => on.close()
  return { close: () => ws.close() }
}

type Snapshot = { responses: Record<string, unknown>; asOfSeq: number }

function errorCode(body: unknown): string | undefined {
  return (body as Partial<ErrorEnvelope> | null)?.error?.code
}

/** Step 3 of §1.6: every §7.1 body the board needs, keyed by its GET path, and the smallest `asOfSeq`. */
async function readSnapshot(base: string, fetch: FetchLike): Promise<Snapshot> {
  const get = async (path: string): Promise<{ status: number; body: unknown }> => {
    const res = await fetch(base + path)
    return { status: res.status, body: await res.json() }
  }
  const ok = (path: string, r: { status: number; body: unknown }) => {
    if (r.status !== 200) throw new Error(`GET ${path}: HTTP ${r.status} ${errorCode(r.body) ?? ''}`)
    return r.body
  }

  const [current, oncourse] = await Promise.all([get('/api/events/current'), get('/api/oncourse')])
  const responses: Record<string, unknown> = {}

  if (current.status !== 200 && errorCode(current.body) === 'event-not-found') {
    // no event configured yet (§7.1): nothing to read but the on-course set
  } else {
    const event = ok('/api/events/current', current) as EventCurrentResponse
    responses['/api/events/current'] = event

    const classPaths = event.classes.flatMap((c) =>
      ['phases', 'entries', 'standings'].map((kind) => `/api/classes/${encodeURIComponent(c.classId)}/${kind}`)
    )
    const classBodies = await Promise.all(classPaths.map(async (path) => ok(path, await get(path))))
    classPaths.forEach((path, i) => (responses[path] = classBodies[i]))

    const phaseIds = new Set<string>()
    classPaths.forEach((path, i) => {
      if (path.endsWith('/phases')) for (const p of (classBodies[i] as ClassPhasesResponse).phases) phaseIds.add(p.phaseId)
    })
    for (const id of event.pendingPhaseIds) phaseIds.add(id)

    const attemptPaths = [...phaseIds].map((id) => `/api/phases/${encodeURIComponent(id)}/attempts`)
    const attemptBodies = await Promise.all(attemptPaths.map(async (path) => ok(path, await get(path))))
    attemptPaths.forEach((path, i) => (responses[path] = attemptBodies[i]))
  }
  responses['/api/oncourse'] = ok('/api/oncourse', oncourse)

  const asOfSeq = Math.min(...Object.values(responses).map((b) => (b as { asOfSeq: number }).asOfSeq))
  return { responses, asOfSeq }
}

/** Starts the transport; returns stop. */
export function startTransport(o: TransportOptions): () => void {
  const base = o.serverUrl.replace(/\/+$/, '')
  const wsUrl = `${base.replace(/^http/, 'ws')}/ws`

  let generation = 0 // a connection's handlers act only while theirs is current
  let socket: { close(): void } | null = null
  let liveness: TimerHandle | null = null
  let retry: TimerHandle | null = null
  let held: StoreState | null = null
  let status: TransportStatus | null = null

  const setStatus = (next: TransportStatus) => {
    if (next === status) return
    status = next
    o.onStatus(next)
  }

  const drop = () => {
    generation++
    if (liveness !== null) o.clock.clearTimeout(liveness)
    liveness = null
    socket?.close()
    socket = null
  }

  // Nothing held is cleared: the board keeps showing it, marked stale, until the next hydration.
  const dead = () => setStatus(held ? 'stale' : 'connecting')

  const failed = () => {
    drop()
    dead()
    retry = o.clock.setTimeout(() => {
      retry = null
      connect()
    }, RECONNECT_DELAY_MS)
  }

  const armLiveness = () => {
    if (liveness !== null) o.clock.clearTimeout(liveness)
    liveness = o.clock.setTimeout(() => {
      liveness = null
      drop()
      dead()
      connect()
    }, LIVENESS_TIMEOUT_MS)
  }

  function connect() {
    const gen = ++generation
    const current = () => gen === generation
    let buffer: Map<number, WsMessage> | null = new Map() // §1.6 step 2, until hydrated

    armLiveness()
    socket = o.openSocket(wsUrl, {
      open() {
        if (!current()) return
        readSnapshot(base, o.fetch).then(
          ({ responses, asOfSeq }) => {
            if (!current() || !buffer) return
            let state = hydrate(responses, asOfSeq)
            for (const seq of [...buffer.keys()].sort((a, b) => a - b)) {
              if (seq > asOfSeq) state = applyMessage(state, buffer.get(seq)!) // §1.6 step 4
            }
            buffer = null
            held = state
            o.onState(state)
            setStatus('live')
          },
          () => {
            if (current()) failed()
          }
        )
      },
      message(data) {
        if (!current()) return
        armLiveness()
        const msg = JSON.parse(data) as WsMessage
        if (msg.type === 'diagnostics.updated') return // admin audience only (§7.2)
        if (buffer) {
          buffer.set(msg.seq, msg)
          return
        }
        held = applyMessage(held!, msg)
        o.onState(held)
      },
      close() {
        if (current()) failed()
      },
    })
  }

  setStatus('connecting')
  connect()

  return () => {
    drop()
    if (retry !== null) o.clock.clearTimeout(retry)
    retry = null
  }
}
