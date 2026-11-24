import { describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ReactNode } from 'react'
import { ScoreboardContent } from '@/App'
import { ClockProvider } from '@/clock/clockContext'
import { createFakeClock, type FakeClock } from '@/clock/fakeClock'
import { loadFixture, type Fixture } from '@/fixture/harness'
import { createStepper } from '@/fixture/stepper'
import { RECONNECT_DELAY_MS, type FetchLike, type OpenSocket, type SocketHandlers } from '@/transport/transport'
import { BoardProvider, LiveBoardProvider } from './BoardProvider'
import { useLiveStore } from './useLiveStore'

// Tier 3 (c123-scoreboard#165, Check line): the live path, transport -> store -> view-model -> components, composed
// with in-memory `fetch` and WebSocket fakes that serve a synthetic fixture's hydration bodies and send its steps,
// renders the same DOM as the fixture source (the stepper on the Clock) for that fixture.

const SERVER = 'http://scoreboard-host:27123'

function fixture(id: string): Fixture {
  return loadFixture(JSON.parse(readFileSync(resolve(process.cwd(), `tests/fixtures/synthetic/${id}.json`), 'utf8')))
}

type FakeServer = { fetch: FetchLike; openSocket: OpenSocket; sockets: SocketHandlers[]; reads: string[] }

/** Serves the fixture's hydration bodies by GET path; records every socket the transport opens. */
function fakeServer(f: Fixture): FakeServer {
  const responses = f.steps[0].responses
  const sockets: SocketHandlers[] = []
  const reads: string[] = []
  return {
    sockets,
    reads,
    fetch: (url) => {
      const path = url.slice(SERVER.length)
      reads.push(path)
      const body = responses[path]
      if (body === undefined) return Promise.reject(new Error(`unexpected request ${path}`))
      return Promise.resolve({ status: 200, json: () => Promise.resolve(structuredClone(body)) })
    },
    openSocket: (_url, on) => {
      sockets.push(on)
      return { close() {} }
    },
  }
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 50; i++) await Promise.resolve()
  })
}

function withClock(clock: FakeClock, children: ReactNode) {
  return <ClockProvider clock={clock}>{children}</ClockProvider>
}

describe('live path renders what the fixture source renders (tier 3)', () => {
  // The fixtures carry no heartbeats, and their gaps exceed the 20 s liveness window, so the transport's own Clock
  // is held still here; liveness is covered in transport.test.ts. The board's Clock is the one the steps advance.
  function LiveBoard({ server, transportClock, clock }: { server: FakeServer; transportClock: FakeClock; clock: FakeClock }) {
    const live = useLiveStore({ serverUrl: SERVER, fetch: server.fetch, openSocket: server.openSocket, clock: transportClock })
    return (
      <BoardProvider store={live.state} clock={clock} connection={live.connection}>
        <ScoreboardContent />
      </BoardProvider>
    )
  }

  for (const id of ['slalom-k1m-one-run', 'slalom-finish']) {
    it(`${id}: after hydration and after every step`, async () => {
      const f = fixture(id)
      const start = Date.parse(f.steps[0].observedAt)
      const clock = createFakeClock(start)
      const transportClock = createFakeClock(start)
      const server = fakeServer(f)
      const stepper = createStepper(f)

      const reference = () =>
        withClock(
          clock,
          <BoardProvider store={stepper.state} clock={clock} connection="live">
            <ScoreboardContent />
          </BoardProvider>
        )
      const ref = render(reference())
      const live = render(withClock(clock, <LiveBoard server={server} transportClock={transportClock} clock={clock} />))

      expect(server.sockets).toHaveLength(1)
      act(() => server.sockets[0].open())
      await settle()
      ref.rerender(reference())
      expect(live.container.innerHTML).toBe(ref.container.innerHTML)
      expect(live.container.querySelectorAll('[data-bib]').length).toBeGreaterThan(0)

      let index = 1
      while (!stepper.done) {
        act(() => clock.advance(stepper.gapToNext))
        act(() => {
          stepper.apply()
          const message: Record<string, unknown> = { ...f.steps[index++] }
          delete message.observedAt // the wire message carries none
          server.sockets[0].message(JSON.stringify(message))
        })
        ref.rerender(reference())
        expect(live.container.innerHTML, `after step ${index - 1}`).toBe(ref.container.innerHTML)
      }
    })
  }
})

describe('LiveBoardProvider: a dropped socket (tier 3)', () => {
  it('marks the connection dot, keeps what it shows, and re-hydrates on the next stream', async () => {
    const f = fixture('slalom-k1m-one-run')
    const clock = createFakeClock(Date.parse(f.steps[0].observedAt))
    const server = fakeServer(f)
    const { container } = render(
      withClock(
        clock,
        <LiveBoardProvider serverUrl={SERVER} fetch={server.fetch} openSocket={server.openSocket} clock={clock}>
          <ScoreboardContent />
        </LiveBoardProvider>
      )
    )
    const dot = () => container.firstElementChild!.className
    const rows = () => container.querySelectorAll('[data-bib]').length

    expect(dot()).toMatch(/connecting/)
    act(() => server.sockets[0].open())
    await settle()
    expect(dot()).toMatch(/connected/)
    const shown = rows()
    expect(shown).toBe(3)
    const hydrations = server.reads.filter((p) => p === '/api/events/current').length

    act(() => server.sockets[0].close())
    expect(dot()).toMatch(/reconnecting/)
    expect(rows()).toBe(shown)

    act(() => clock.advance(RECONNECT_DELAY_MS))
    expect(server.sockets).toHaveLength(2)
    act(() => server.sockets[1].open())
    await settle()
    expect(server.reads.filter((p) => p === '/api/events/current')).toHaveLength(hydrations + 1)
    expect(dot()).toMatch(/connected/)
    expect(rows()).toBe(shown)
  })
})
