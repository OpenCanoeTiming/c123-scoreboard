import { afterEach, describe, expect, it } from 'vitest'
import { createFakeClock } from '../clock/fakeClock'
import { loadAssets, saveAssets } from '../utils/assetStorage'
import {
  CLIENT_RECONNECT_DELAY_MS,
  startClientChannel,
  type ClientPage,
  type OpenClientSocket,
  type SocketHandlers,
} from './clientChannel'

// Shapes pinned here are today's (c123-server RULINGS R-26, ARCHITECTURE §8): the ConfigPush, ClientState and
// ForceRefresh messages the on-site process sends and reads on `/ws/client`, and the ConfigPush handling the
// board has today (URL parameters read by the layout, assets and clientId in localStorage).

const SERVER = 'http://scoreboard-host:27123'
const START = Date.parse('2026-09-15T10:00:00.000Z')

type FakeSocket = { url: string; on: SocketHandlers; sent: unknown[]; closed: boolean }

function setup(href = 'http://board.local/?server=scoreboard-host') {
  const clock = createFakeClock(START)
  const sockets: FakeSocket[] = []
  const navigations: string[] = []
  let reloads = 0
  const current = href

  const openSocket: OpenClientSocket = (url, on) => {
    const socket: FakeSocket = { url, on, sent: [], closed: false }
    sockets.push(socket)
    return {
      send: (data) => socket.sent.push(JSON.parse(data)),
      close: () => {
        socket.closed = true
      },
    }
  }
  const page: ClientPage = {
    href: () => current,
    navigate: (to) => {
      navigations.push(to)
    },
    reload: () => {
      reloads++
    },
  }

  const stop = startClientChannel({ serverUrl: SERVER, openSocket, clock, page, version: '3.0.0' })
  return {
    clock,
    sockets,
    navigations,
    reloads: () => reloads,
    stop,
    last: () => sockets[sockets.length - 1]!,
    push: (data: unknown) =>
      sockets[sockets.length - 1]!.on.message(
        JSON.stringify({ type: 'ConfigPush', timestamp: '2026-09-15T10:00:00.000Z', data })
      ),
  }
}

const CAPABILITIES = ['configPush', 'forceRefresh', 'clientIdPush', 'scrollToFinished', 'browseAfterHighlight', 'assetManagement']

afterEach(() => {
  localStorage.clear()
})

describe('client channel: path and clientId', () => {
  it('opens its own WebSocket on /ws/client, never on /ws, without a clientId when none is known', () => {
    const t = setup()
    expect(t.sockets.map((s) => s.url)).toEqual(['ws://scoreboard-host:27123/ws/client'])
    t.stop()
  })

  it('names the clientId from the page URL, else the one stored from an earlier ConfigPush', () => {
    localStorage.setItem('c123-clientId', 'stored-id')
    const fromUrl = setup('http://board.local/?clientId=finish%20line')
    expect(fromUrl.last().url).toBe('ws://scoreboard-host:27123/ws/client?clientId=finish%20line')
    fromUrl.stop()
    const fromStorage = setup()
    expect(fromStorage.last().url).toBe('ws://scoreboard-host:27123/ws/client?clientId=stored-id')
    fromStorage.stop()
  })
})

describe('client channel: ClientState', () => {
  it('is sent after connecting, in today shape, describing the page as it is', () => {
    const t = setup('http://board.local/?clientId=a&type=ledwall&displayRows=6&customTitle=Finals&scrollToFinished=false')
    expect(t.last().sent).toEqual([])
    t.last().on.open()
    expect(t.last().sent).toEqual([
      {
        type: 'ClientState',
        timestamp: '2026-09-15T10:00:00.000Z',
        data: {
          current: {
            clientId: 'a',
            type: 'ledwall',
            displayRows: 6,
            customTitle: 'Finals',
            scrollToFinished: false,
            browseAfterHighlight: false,
          },
          version: '3.0.0',
          capabilities: CAPABILITIES,
        },
      },
    ])
    t.stop()
  })

  it('reports the defaults when the page names nothing', () => {
    const t = setup()
    t.last().on.open()
    expect((t.last().sent[0] as { data: { current: unknown } }).data.current).toEqual({
      type: 'vertical',
      displayRows: 10,
      scrollToFinished: true,
      browseAfterHighlight: false,
    })
    t.stop()
  })
})

describe('client channel: ConfigPush', () => {
  it('applies every parameter the board supports today, then reports the applied configuration', () => {
    const t = setup('http://board.local/?server=scoreboard-host')
    t.last().on.open()
    t.push({
      type: 'ledwall',
      displayRows: 8,
      customTitle: 'Finals',
      scrollToFinished: false,
      browseAfterHighlight: true,
      clientId: 'finish-line',
      assets: {
        logoUrl: 'https://example.org/logo.png',
        partnerLogoUrl: '/assets/partner.png',
        footerImageUrl: 'data:image/png;base64,iVBORw0KGgo=',
      },
      raceFilter: ['K1M'],
      showOnCourse: false,
      showResults: true,
      custom: { theme: 'dark' },
      label: 'Finish line',
    })

    expect(t.navigations).toHaveLength(1)
    const url = new URL(t.navigations[0]!)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      server: 'scoreboard-host',
      clientId: 'finish-line',
      type: 'ledwall',
      displayRows: '8',
      customTitle: 'Finals',
      scrollToFinished: 'false',
      browseAfterHighlight: 'true',
    })
    expect(localStorage.getItem('c123-clientId')).toBe('finish-line')
    expect(loadAssets()).toEqual({
      logoUrl: 'https://example.org/logo.png',
      partnerLogoUrl: '/assets/partner.png',
      footerImageUrl: 'data:image/png;base64,iVBORw0KGgo=',
    })

    expect(t.last().sent).toHaveLength(2)
    expect(t.last().sent[1]).toEqual({
      type: 'ClientState',
      timestamp: '2026-09-15T10:00:00.000Z',
      data: {
        current: {
          clientId: 'finish-line',
          type: 'ledwall',
          displayRows: 8,
          customTitle: 'Finals',
          scrollToFinished: false,
          browseAfterHighlight: true,
          assets: {
            logoUrl: 'https://example.org/logo.png',
            partnerLogoUrl: '/assets/partner.png',
            footerImageUrl: 'data:image/png;base64,iVBORw0KGgo=',
          },
        },
        version: '3.0.0',
        capabilities: CAPABILITIES,
      },
    })
    t.stop()
  })

  it('a null asset resets it to the default and reloads the page', () => {
    saveAssets({ logoUrl: '/custom/logo.png', footerImageUrl: '/custom/footer.png' })
    const t = setup('http://board.local/?type=vertical')
    t.last().on.open()
    t.push({ assets: { logoUrl: null } })
    expect(loadAssets()).toEqual({ footerImageUrl: '/custom/footer.png' })
    expect(t.navigations).toEqual(['http://board.local/?type=vertical'])
    t.stop()
  })

  it('changes nothing and does not reload when the page already shows the pushed configuration', () => {
    localStorage.setItem('c123-clientId', 'a')
    const t = setup('http://board.local/?type=ledwall&displayRows=8')
    t.last().on.open()
    t.push({ type: 'ledwall', displayRows: 8, clientId: 'a' })
    expect(t.navigations).toEqual([])
    expect(t.last().sent.map((m) => (m as { type: string }).type)).toEqual(['ClientState', 'ClientState'])
    t.stop()
  })
})

describe('client channel: ForceRefresh', () => {
  it('reloads the page, with or without a reason', () => {
    const t = setup()
    t.last().on.open()
    t.last().on.message(JSON.stringify({ type: 'ForceRefresh', timestamp: 'x', data: { reason: 'new layout' } }))
    t.last().on.message(JSON.stringify({ type: 'ForceRefresh', timestamp: 'x', data: {} }))
    expect(t.reloads()).toBe(2)
    expect(t.navigations).toEqual([])
    t.stop()
  })
})

describe('client channel: reconnection on the Clock', () => {
  it('reconnects after the delay once the socket closes, and sends ClientState again', () => {
    const t = setup('http://board.local/?clientId=a')
    t.last().on.open()
    t.last().on.close()
    t.clock.advance(CLIENT_RECONNECT_DELAY_MS - 1)
    expect(t.sockets).toHaveLength(1)
    t.clock.advance(1)
    expect(t.sockets).toHaveLength(2)
    expect(t.last().url).toBe('ws://scoreboard-host:27123/ws/client?clientId=a')
    t.last().on.open()
    expect(t.last().sent.map((m) => (m as { type: string }).type)).toEqual(['ClientState'])
    t.stop()
  })

  it('stop closes the socket and cancels a pending reconnection', () => {
    const t = setup()
    t.last().on.close()
    t.stop()
    t.clock.advance(10 * CLIENT_RECONNECT_DELAY_MS)
    expect(t.sockets).toHaveLength(1)
    const u = setup()
    u.stop()
    expect(u.last().closed).toBe(true)
  })

  it('ignores a late event from a socket it has replaced', () => {
    const t = setup()
    const first = t.last()
    first.on.close()
    t.clock.advance(CLIENT_RECONNECT_DELAY_MS)
    first.on.message(JSON.stringify({ type: 'ForceRefresh', timestamp: 'x', data: {} }))
    first.on.close()
    t.clock.advance(10 * CLIENT_RECONNECT_DELAY_MS)
    expect(t.reloads()).toBe(0)
    expect(t.sockets).toHaveLength(2)
    t.stop()
  })
})
