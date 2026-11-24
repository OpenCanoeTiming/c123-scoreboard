// Client configuration and remote control (c123-server RULINGS R-26, ARCHITECTURE §8): ConfigPush, ClientState,
// ForceRefresh and `clientId` in today's shapes, on their own WebSocket path `/ws/client`, outside the contract.
// A ConfigPush is applied as today: layout parameters into the page URL, assets and clientId into localStorage,
// then the page loads the new URL. The socket, the page and the Clock are injected.
import type { Clock, TimerHandle } from '../clock/clock'
import type { SocketHandlers } from '../transport/transport'
import { clearAsset, isValidAssetUrl, loadAssets, saveAssets, type AssetConfig } from '../utils/assetStorage'

export type { SocketHandlers }

/** Pause before reconnecting after the socket closed. */
export const CLIENT_RECONNECT_DELAY_MS = 1_000

/** localStorage key of the clientId a ConfigPush assigned. */
const CLIENT_ID_KEY = 'c123-clientId'

const CAPABILITIES = ['configPush', 'forceRefresh', 'clientIdPush', 'scrollToFinished', 'browseAfterHighlight', 'assetManagement']

/** Opens a WebSocket to `url`, reporting to `on`. */
export type OpenClientSocket = (url: string, on: SocketHandlers) => { send(data: string): void; close(): void }

/** The page the board runs in. */
export type ClientPage = {
  href(): string
  /** Loads `href`, so the board starts with the configuration it names. */
  navigate(href: string): void
  /** Hard reload. */
  reload(): void
}

type AssetKey = keyof AssetConfig
const ASSET_KEYS: readonly AssetKey[] = ['logoUrl', 'partnerLogoUrl', 'footerImageUrl']

/** ConfigPush `data`; a `null` asset resets it to the default. */
export type ConfigPushData = {
  clientId?: string
  type?: 'vertical' | 'ledwall'
  displayRows?: number
  customTitle?: string
  raceFilter?: string[]
  showOnCourse?: boolean
  showResults?: boolean
  scrollToFinished?: boolean
  browseAfterHighlight?: boolean
  assets?: Partial<Record<AssetKey, string | null>>
  custom?: Record<string, string | number | boolean>
  label?: string
}

export type ClientChannelOptions = {
  /** The server's HTTP origin, e.g. `http://192.168.1.50:27123`. */
  serverUrl: string
  openSocket: OpenClientSocket
  clock: Clock
  page: ClientPage
  /** Reported in ClientState. */
  version: string
}

/** The browser WebSocket behind `OpenClientSocket`. */
export const browserClientSocket: OpenClientSocket = (url, on) => {
  const ws = new WebSocket(url)
  ws.onopen = () => on.open()
  ws.onmessage = (ev) => on.message(String(ev.data))
  ws.onclose = () => on.close()
  return { send: (data) => ws.send(data), close: () => ws.close() }
}

/** The browser page behind `ClientPage`. */
export const browserPage: ClientPage = {
  href: () => window.location.href,
  navigate: (href) => {
    window.location.href = href
  },
  reload: () => window.location.reload(),
}

function storedClientId(): string | null {
  try {
    return localStorage.getItem(CLIENT_ID_KEY)
  } catch {
    return null
  }
}

function saveClientId(id: string): void {
  try {
    localStorage.setItem(CLIENT_ID_KEY, id)
  } catch {
    // localStorage unavailable: the URL still carries it for this session
  }
}

/** Stores the pushed assets; true when what is stored changed. */
function applyAssets(pushed: ConfigPushData['assets']): boolean {
  const current = loadAssets() ?? {}
  const next: AssetConfig = { ...current }
  const cleared: AssetKey[] = []
  let changed = false
  for (const key of ASSET_KEYS) {
    const value = pushed?.[key]
    if (value === null) {
      if (current[key]) {
        cleared.push(key)
        delete next[key]
        changed = true
      }
    } else if (value && isValidAssetUrl(value)) {
      next[key] = value
      if (current[key] !== value) changed = true
    }
  }
  if (changed) {
    for (const key of cleared) clearAsset(key)
    if (Object.keys(next).length > 0) saveAssets(next)
  }
  return changed
}

/** Starts the channel; returns stop. */
export function startClientChannel(o: ClientChannelOptions): () => void {
  const base = o.serverUrl.replace(/\/+$/, '').replace(/^http/, 'ws')

  let generation = 0
  let socket: ReturnType<OpenClientSocket> | null = null
  let retry: TimerHandle | null = null

  const sendState = (applied: ConfigPushData) => {
    const params = new URL(o.page.href()).searchParams
    const scroll = params.get('scrollToFinished')
    const message = {
      type: 'ClientState',
      timestamp: new Date(o.clock.now()).toISOString(),
      data: {
        current: {
          clientId: params.get('clientId') || applied.clientId || undefined,
          type: params.get('type') || applied.type || 'vertical',
          displayRows: parseInt(params.get('displayRows') || '', 10) || applied.displayRows || 10,
          customTitle: params.get('customTitle') || applied.customTitle || undefined,
          scrollToFinished: scroll !== null ? scroll !== 'false' : (applied.scrollToFinished ?? true),
          browseAfterHighlight: params.get('browseAfterHighlight') === 'true' || (applied.browseAfterHighlight ?? false),
          assets: applied.assets
            ? {
                logoUrl: applied.assets.logoUrl || undefined,
                partnerLogoUrl: applied.assets.partnerLogoUrl || undefined,
                footerImageUrl: applied.assets.footerImageUrl || undefined,
              }
            : undefined,
        },
        version: o.version,
        capabilities: CAPABILITIES,
      },
    }
    socket?.send(JSON.stringify(message))
  }

  const applyConfig = (data: ConfigPushData) => {
    const assetsChanged = applyAssets(data.assets)
    const url = new URL(o.page.href())
    if (data.clientId !== undefined && data.clientId !== (url.searchParams.get('clientId') || storedClientId())) {
      saveClientId(data.clientId)
      url.searchParams.set('clientId', data.clientId)
    }
    if (data.type !== undefined) url.searchParams.set('type', data.type)
    if (data.displayRows !== undefined) url.searchParams.set('displayRows', String(data.displayRows))
    if (data.customTitle !== undefined) url.searchParams.set('customTitle', data.customTitle)
    if (data.scrollToFinished !== undefined) url.searchParams.set('scrollToFinished', String(data.scrollToFinished))
    if (data.browseAfterHighlight !== undefined)
      url.searchParams.set('browseAfterHighlight', String(data.browseAfterHighlight))
    if (url.href !== o.page.href() || assetsChanged) o.page.navigate(url.href)
    sendState(data)
  }

  function connect() {
    const gen = ++generation
    const current = () => gen === generation
    const clientId = new URL(o.page.href()).searchParams.get('clientId') || storedClientId()
    const url = `${base}/ws/client${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`
    socket = o.openSocket(url, {
      open() {
        if (current()) sendState({})
      },
      message(data) {
        if (!current()) return
        let msg: { type?: unknown; data?: unknown }
        try {
          msg = JSON.parse(data) as { type?: unknown; data?: unknown }
        } catch {
          return
        }
        if (msg.type === 'ForceRefresh') o.page.reload()
        else if (msg.type === 'ConfigPush') applyConfig((msg.data ?? {}) as ConfigPushData)
      },
      close() {
        if (!current()) return
        generation++
        socket = null
        retry = o.clock.setTimeout(() => {
          retry = null
          connect()
        }, CLIENT_RECONNECT_DELAY_MS)
      },
    })
  }

  connect()

  return () => {
    generation++
    socket?.close()
    socket = null
    if (retry !== null) o.clock.clearTimeout(retry)
    retry = null
  }
}
