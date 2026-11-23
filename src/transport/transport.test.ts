import { describe, expect, it } from 'vitest'
import type { WsMessage } from '@opencanoetiming/c123-contract'
import { createFakeClock } from '../clock/fakeClock'
import type { StoreState } from '../store/store'
import {
  RECONNECT_DELAY_MS,
  startTransport,
  type FetchLike,
  type OpenSocket,
  type SocketHandlers,
  type TransportStatus,
} from './transport'

// Synthetic: every body and message below is written from CONTRACTS §1.4, §1.6, §7.1 and §7.2, no recording.
// Bodies carry only the fields the assertions read.

const SERVER = 'http://scoreboard-host:27123'

type Route = { status: number; body: unknown }

function eventRoutes(): Record<string, Route> {
  return {
    '/api/events/current': {
      status: 200,
      body: {
        asOfSeq: 10,
        event: { eventId: 'E1', name: 'Spring slalom' },
        classes: [{ classId: 'K1M', name: 'K1 men' }],
        courses: [],
        pendingPhaseIds: ['K1M_PENDING'],
      },
    },
    '/api/classes/K1M/phases': { status: 200, body: { asOfSeq: 11, phases: [{ phaseId: 'K1M_BR1_5', classId: 'K1M' }] } },
    '/api/classes/K1M/entries': { status: 200, body: { asOfSeq: 11, entries: [] } },
    '/api/classes/K1M/standings': { status: 200, body: { asOfSeq: 11, standings: [] } },
    '/api/phases/K1M_BR1_5/attempts': {
      status: 200,
      body: { asOfSeq: 12, attempts: [{ attemptId: 'K1M_BR1_5:1', phaseId: 'K1M_BR1_5', bib: '1' }] },
    },
    '/api/phases/K1M_PENDING/attempts': {
      status: 200,
      body: { asOfSeq: 12, attempts: [{ attemptId: 'K1M_PENDING:7', phaseId: 'K1M_PENDING', bib: '7' }] },
    },
    '/api/oncourse': { status: 200, body: { asOfSeq: 12, attempts: [], featuredByUpstream: null, asOf: null } },
  }
}

type FakeSocket = { url: string; on: SocketHandlers; closed: boolean }

function setup(routes: Record<string, Route> = eventRoutes()) {
  const clock = createFakeClock(Date.parse('2026-09-15T10:00:00.000Z'))
  const log: string[] = []
  const sockets: FakeSocket[] = []
  const states: StoreState[] = []
  const statuses: TransportStatus[] = []

  const fetch: FetchLike = (url) => {
    const path = url.slice(SERVER.length)
    log.push(`GET ${path}`)
    const route = routes[path]
    if (!route) return Promise.reject(new Error(`unexpected request ${path}`))
    return Promise.resolve({ status: route.status, json: () => Promise.resolve(structuredClone(route.body)) })
  }
  const openSocket: OpenSocket = (url, on) => {
    log.push(`WS ${url}`)
    const socket: FakeSocket = { url, on, closed: false }
    sockets.push(socket)
    return {
      close() {
        socket.closed = true
      },
    }
  }

  const stop = startTransport({
    serverUrl: SERVER,
    fetch,
    openSocket,
    clock,
    onState: (s) => states.push(s),
    onStatus: (s) => statuses.push(s),
  })

  const socket = () => sockets[sockets.length - 1]
  const send = (msg: object) => socket().on.message(JSON.stringify(msg))
  const last = () => states[states.length - 1]
  return { clock, log, sockets, states, statuses, stop, socket, send, last }
}

async function settle() {
  for (let i = 0; i < 50; i++) await Promise.resolve()
}

/** The deadline is checked at most one tick late; the transport's timer fires exactly at it. */
const TICK_MS = 1_000

const className = (seq: number, name: string, classId = 'K1M') =>
  ({ seq, type: 'class.updated', classId, fields: { name } }) as unknown as WsMessage

describe('transport: the §1.6 handshake', () => {
  it('opens /ws before any REST read and reads only after the stream is open', async () => {
    const t = setup()
    expect(t.log).toEqual(['WS ws://scoreboard-host:27123/ws'])
    await settle()
    expect(t.log).toHaveLength(1)

    t.socket().on.open()
    await settle()
    expect(t.log[0]).toBe('WS ws://scoreboard-host:27123/ws')
    expect(t.log.length).toBeGreaterThan(1)
  })

  it('reads every §7.1 hydration body, pendingPhaseIds included, and no admin read', async () => {
    const t = setup()
    t.socket().on.open()
    await settle()

    const reads = t.log.filter((l) => l.startsWith('GET ')).map((l) => l.slice(4))
    expect([...reads].sort()).toEqual(
      [
        '/api/events/current',
        '/api/classes/K1M/phases',
        '/api/classes/K1M/entries',
        '/api/classes/K1M/standings',
        '/api/phases/K1M_BR1_5/attempts',
        '/api/phases/K1M_PENDING/attempts',
        '/api/oncourse',
      ].sort()
    )
    for (const path of reads) expect(path).not.toMatch(/sources|diagnostics|checks|rebaseline/)

    expect(t.last().event?.eventId).toBe('E1')
    expect(Object.keys(t.last().attempts).sort()).toEqual(['K1M_BR1_5:1', 'K1M_PENDING:7'])
    expect(t.statuses[t.statuses.length - 1]).toBe('live')
  })

  it('discards buffered messages at or below the smallest asOfSeq and applies the rest', async () => {
    const t = setup()
    t.socket().on.open()
    // bodies carry asOfSeq 10, 11 and 12: the smallest is 10
    t.send(className(9, 'nine'))
    t.send(className(10, 'ten'))
    t.send(className(11, 'K2 women', 'K2W')) // above 10, below 12: applied again (§1.6 step 4)
    expect(t.states).toHaveLength(0) // buffered, nothing applied before hydration
    await settle()

    expect(t.last().classes.K1M.name).toBe('K1 men')
    expect(t.last().classes.K2W.name).toBe('K2 women')
  })

  it('applies the buffered messages in seq order, not in arrival order', async () => {
    const t = setup()
    t.socket().on.open()
    t.send(className(14, 'fourteen'))
    t.send(className(13, 'thirteen'))
    await settle()

    expect(t.last().classes.K1M.name).toBe('fourteen')
    expect(t.last().appliedSeq).toBe(14)
  })

  it('applies a lower seq that arrived later when it touches another entity', async () => {
    const t = setup()
    t.socket().on.open()
    t.send(className(14, 'fourteen'))
    t.send(className(13, 'K2 women', 'K2W'))
    await settle()

    expect(t.last().classes.K1M.name).toBe('fourteen')
    expect(t.last().classes.K2W.name).toBe('K2 women')
    expect(t.last().appliedSeq).toBe(14)
  })

  it('applies live messages after hydration as they arrive', async () => {
    const t = setup()
    t.socket().on.open()
    await settle()
    const before = t.states.length

    t.send(className(20, 'live'))
    expect(t.states).toHaveLength(before + 1)
    expect(t.last().classes.K1M.name).toBe('live')
  })

  it('ignores diagnostics.updated', async () => {
    const t = setup()
    t.socket().on.open()
    await settle()
    const before = t.states.length

    t.send({ seq: 21, type: 'diagnostics.updated', diagnostics: [] })
    expect(t.states).toHaveLength(before)
  })
})

describe('transport: no event configured yet', () => {
  it('treats 404 event-not-found as no event, by its code, whatever the message says', async () => {
    const t = setup({
      '/api/events/current': { status: 404, body: { error: { code: 'event-not-found', message: 'reworded at any time' } } },
      '/api/oncourse': { status: 200, body: { asOfSeq: 5, attempts: [], featuredByUpstream: null, asOf: null } },
    })
    t.socket().on.open()
    await settle()

    expect(t.last().event).toBeNull()
    expect(t.statuses[t.statuses.length - 1]).toBe('live')
    expect(t.log.filter((l) => l.startsWith('GET /api/classes'))).toEqual([])
  })

  it('does not read error.message: another code saying "event-not-found" fails the handshake', async () => {
    const t = setup({
      '/api/events/current': { status: 404, body: { error: { code: 'class-not-found', message: 'event-not-found' } } },
      '/api/oncourse': { status: 200, body: { asOfSeq: 5, attempts: [], featuredByUpstream: null, asOf: null } },
    })
    t.socket().on.open()
    await settle()

    expect(t.states).toHaveLength(0)
    expect(t.statuses).not.toContain('live')
    expect(t.sockets[0].closed).toBe(true)
    t.clock.advance(RECONNECT_DELAY_MS)
    expect(t.sockets).toHaveLength(2) // the handshake is repeated
  })
})

describe('transport: reconnection', () => {
  it('repeats the whole handshake after the stream closes, buffering until re-hydrated', async () => {
    const t = setup()
    t.socket().on.open()
    await settle()
    t.send(className(20, 'before the drop'))
    const held = t.last()

    t.socket().on.close()
    expect(t.statuses[t.statuses.length - 1]).toBe('stale')
    t.clock.advance(RECONNECT_DELAY_MS)
    expect(t.sockets).toHaveLength(2)
    expect(t.log.filter((l) => l === 'GET /api/events/current')).toHaveLength(1) // not before the new stream opens

    t.socket().on.open()
    t.send(className(30, 'after the drop'))
    expect(t.last()).toBe(held) // nothing applied before re-hydration, nothing cleared
    await settle()

    expect(t.log.filter((l) => l === 'GET /api/events/current')).toHaveLength(2)
    expect(t.last().classes.K1M.name).toBe('after the drop')
    expect(t.statuses[t.statuses.length - 1]).toBe('live')
  })

  it('ignores whatever an abandoned stream still delivers', async () => {
    const t = setup()
    t.socket().on.open()
    await settle()
    const first = t.sockets[0]
    first.on.close()
    t.clock.advance(RECONNECT_DELAY_MS)
    const count = t.states.length

    first.on.message(JSON.stringify(className(40, 'ghost')))
    expect(t.states).toHaveLength(count)
  })
})

describe('transport: liveness (§7.2, two missed 10 s heartbeats)', () => {
  it('marks the connection stale at 20 s of silence and repeats the handshake, clearing nothing', async () => {
    const t = setup()
    t.socket().on.open()
    await settle()
    const held = t.last()
    const statesBefore = t.states.length

    t.clock.advance(20_000 - 1)
    expect(t.statuses[t.statuses.length - 1]).toBe('live')
    t.clock.advance(1 + TICK_MS)
    expect(t.statuses[t.statuses.length - 1]).toBe('stale')
    expect(t.states).toHaveLength(statesBefore) // nothing cleared, nothing replaced
    expect(t.last()).toBe(held)
    expect(t.sockets[0].closed).toBe(true)
    expect(t.sockets).toHaveLength(2)

    t.socket().on.open()
    await settle()
    expect(t.log.filter((l) => l === 'GET /api/events/current')).toHaveLength(2)
    expect(t.statuses[t.statuses.length - 1]).toBe('live')
  })

  it('counts the 20 s from the last message received', async () => {
    const t = setup()
    t.socket().on.open()
    await settle()

    t.clock.advance(10_000)
    t.send({ seq: 15, type: 'sources.updated', sources: {} })
    t.clock.advance(20_000 - 1)
    expect(t.statuses[t.statuses.length - 1]).toBe('live')
    t.clock.advance(1 + TICK_MS)
    expect(t.statuses[t.statuses.length - 1]).toBe('stale')
  })

  it('stops: no timer, no socket and no state after stop', async () => {
    const t = setup()
    t.socket().on.open()
    await settle()
    t.stop()
    expect(t.sockets[0].closed).toBe(true)
    const count = t.statuses.length
    t.clock.advance(40_000)
    expect(t.statuses).toHaveLength(count)
    expect(t.sockets).toHaveLength(1)
  })
})

describe('transport: event.changed naming another eventId (§7.2)', () => {
  const autumn = (seq: number) =>
    ({ seq, type: 'event.changed', event: { eventId: 'E2', name: 'Autumn slalom' } }) as unknown as WsMessage

  function autumnRoutes(): Record<string, Route> {
    return {
      '/api/events/current': {
        status: 200,
        body: {
          asOfSeq: 50,
          event: { eventId: 'E2', name: 'Autumn slalom' },
          classes: [{ classId: 'C1W', name: 'C1 women' }],
          courses: [],
          pendingPhaseIds: [],
        },
      },
      '/api/classes/C1W/phases': { status: 200, body: { asOfSeq: 50, phases: [{ phaseId: 'C1W_BR1_5', classId: 'C1W' }] } },
      '/api/classes/C1W/entries': { status: 200, body: { asOfSeq: 50, entries: [] } },
      '/api/classes/C1W/standings': { status: 200, body: { asOfSeq: 50, standings: [] } },
      '/api/phases/C1W_BR1_5/attempts': {
        status: 200,
        body: { asOfSeq: 50, attempts: [{ attemptId: 'C1W_BR1_5:3', phaseId: 'C1W_BR1_5', bib: '3' }] },
      },
      '/api/oncourse': { status: 200, body: { asOfSeq: 50, attempts: [], featuredByUpstream: null, asOf: null } },
    }
  }

  /** Sends the message and lets the transport act on it; a new stream, if it opens one, opens (§1.6 step 1). */
  async function sendAndSettle(t: ReturnType<typeof setup>, msg: WsMessage) {
    const opened = t.sockets.length
    t.send(msg)
    await settle()
    if (t.sockets.length > opened) t.socket().on.open()
    await settle()
  }

  it('runs the whole hydration handshake again on an open, hydrated connection', async () => {
    const routes = eventRoutes()
    const t = setup(routes)
    t.socket().on.open()
    await settle()
    expect(t.last().event?.eventId).toBe('E1')
    const reads = t.log.filter((l) => l === 'GET /api/events/current').length

    for (const key of Object.keys(routes)) delete routes[key]
    Object.assign(routes, autumnRoutes())
    await sendAndSettle(t, autumn(60))

    expect(t.log.filter((l) => l === 'GET /api/events/current')).toHaveLength(reads + 1)
    expect(t.log).toContain('GET /api/phases/C1W_BR1_5/attempts')
    expect(t.last().event?.eventId).toBe('E2')
    expect(t.last().rehydrationNeeded).toBe(false)
    expect(Object.keys(t.last().attempts)).toEqual(['C1W_BR1_5:3'])
    expect(t.statuses[t.statuses.length - 1]).toBe('live')
  })

  it('hydrates the configured event when it arrives after the "no event yet" start', async () => {
    const routes: Record<string, Route> = {
      '/api/events/current': { status: 404, body: { error: { code: 'event-not-found', message: 'none yet' } } },
      '/api/oncourse': { status: 200, body: { asOfSeq: 5, attempts: [], featuredByUpstream: null, asOf: null } },
    }
    const t = setup(routes)
    t.socket().on.open()
    await settle()
    expect(t.last().event).toBeNull()

    Object.assign(routes, autumnRoutes())
    await sendAndSettle(t, autumn(60))

    expect(t.log).toContain('GET /api/classes/C1W/phases')
    expect(t.last().event?.eventId).toBe('E2')
    expect(Object.keys(t.last().attempts)).toEqual(['C1W_BR1_5:3'])
    expect(t.statuses[t.statuses.length - 1]).toBe('live')
  })
})
