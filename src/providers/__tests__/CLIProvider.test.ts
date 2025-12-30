import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CLIProvider } from '../CLIProvider'
import type { VisibilityState } from '@/types'

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = []
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  url: string
  readyState: number = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose()
    }
  }

  // Helper methods for testing
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    if (this.onopen) {
      this.onopen()
    }
  }

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) })
    }
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose()
    }
  }

  simulateError(error: unknown) {
    if (this.onerror) {
      this.onerror(error)
    }
  }
}

// Replace global WebSocket with mock
const originalWebSocket = globalThis.WebSocket
beforeEach(() => {
  MockWebSocket.instances = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.WebSocket = MockWebSocket as any
})

afterEach(() => {
  globalThis.WebSocket = originalWebSocket
})

describe('CLIProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('constructor', () => {
    it('should create provider with ws:// URL', () => {
      const provider = new CLIProvider('ws://localhost:8081')
      expect(provider.status).toBe('disconnected')
      expect(provider.connected).toBe(false)
    })

    it('should add ws:// prefix if missing', () => {
      const provider = new CLIProvider('localhost:8081')
      expect(provider.status).toBe('disconnected')
    })

    it('should accept wss:// URL', () => {
      const provider = new CLIProvider('wss://secure.example.com:8081')
      expect(provider.status).toBe('disconnected')
    })

    it('should throw error for invalid URL', () => {
      // Empty hostname after ws:// prefix causes invalid URL
      expect(() => new CLIProvider('')).toThrow('Invalid WebSocket URL')
    })
  })

  describe('connect', () => {
    it('should connect and change status to connected', async () => {
      const provider = new CLIProvider('ws://localhost:8081')
      const statusCallback = vi.fn()
      provider.onConnectionChange(statusCallback)

      const connectPromise = provider.connect()

      // Simulate WebSocket open
      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      await connectPromise

      expect(provider.status).toBe('connected')
      expect(provider.connected).toBe(true)
      expect(statusCallback).toHaveBeenCalledWith('connecting')
      expect(statusCallback).toHaveBeenCalledWith('connected')
    })

    it('should not reconnect if already connected', async () => {
      const provider = new CLIProvider('ws://localhost:8081')

      const connectPromise = provider.connect()
      MockWebSocket.instances[0].simulateOpen()
      await connectPromise

      const statusCallback = vi.fn()
      provider.onConnectionChange(statusCallback)

      await provider.connect()

      expect(statusCallback).not.toHaveBeenCalled()
      expect(MockWebSocket.instances.length).toBe(1) // Only one WebSocket created
    })

    it('should reject on connection error', async () => {
      const provider = new CLIProvider('ws://localhost:8081')

      const connectPromise = provider.connect()

      // Simulate error and close
      const ws = MockWebSocket.instances[0]
      ws.simulateError(new Error('Connection refused'))
      ws.simulateClose()

      await expect(connectPromise).rejects.toThrow()
    })
  })

  describe('disconnect', () => {
    it('should disconnect and change status', async () => {
      const provider = new CLIProvider('ws://localhost:8081')

      const connectPromise = provider.connect()
      MockWebSocket.instances[0].simulateOpen()
      await connectPromise

      provider.disconnect()

      expect(provider.status).toBe('disconnected')
      expect(provider.connected).toBe(false)
    })

    it('should not trigger reconnect on manual disconnect', async () => {
      const provider = new CLIProvider('ws://localhost:8081', { autoReconnect: true })

      const connectPromise = provider.connect()
      MockWebSocket.instances[0].simulateOpen()
      await connectPromise

      const statusCallback = vi.fn()
      provider.onConnectionChange(statusCallback)

      provider.disconnect()

      // Advance timers - should not reconnect
      vi.advanceTimersByTime(5000)

      expect(statusCallback).toHaveBeenCalledWith('disconnected')
      expect(statusCallback).not.toHaveBeenCalledWith('reconnecting')
    })
  })

  describe('auto reconnect', () => {
    it('should attempt reconnect on unexpected disconnect', async () => {
      const provider = new CLIProvider('ws://localhost:8081', { autoReconnect: true })
      const statusCallback = vi.fn()
      provider.onConnectionChange(statusCallback)

      const connectPromise = provider.connect()
      MockWebSocket.instances[0].simulateOpen()
      await connectPromise

      // Simulate unexpected disconnect
      MockWebSocket.instances[0].simulateClose()

      expect(statusCallback).toHaveBeenCalledWith('reconnecting')
    })

    it('should use exponential backoff', async () => {
      const provider = new CLIProvider('ws://localhost:8081', {
        autoReconnect: true,
        initialReconnectDelay: 1000,
      })

      const connectPromise = provider.connect()
      MockWebSocket.instances[0].simulateOpen()
      await connectPromise

      // First disconnect
      MockWebSocket.instances[0].simulateClose()

      // Wait less than first delay - no new connection
      vi.advanceTimersByTime(500)
      expect(MockWebSocket.instances.length).toBe(1)

      // Wait for first delay
      vi.advanceTimersByTime(500)
      expect(MockWebSocket.instances.length).toBe(2)

      // Second disconnect - should have 2s delay
      MockWebSocket.instances[1].simulateClose()
      vi.advanceTimersByTime(1500)
      expect(MockWebSocket.instances.length).toBe(2) // Not yet

      vi.advanceTimersByTime(500)
      expect(MockWebSocket.instances.length).toBe(3)
    })

    it('should cap reconnect delay at maxReconnectDelay', async () => {
      const provider = new CLIProvider('ws://localhost:8081', {
        autoReconnect: true,
        initialReconnectDelay: 10000,
        maxReconnectDelay: 15000,
      })

      const connectPromise = provider.connect()
      MockWebSocket.instances[0].simulateOpen()
      await connectPromise

      // First disconnect - 10s delay
      MockWebSocket.instances[0].simulateClose()
      vi.advanceTimersByTime(10000)

      // Second disconnect - should be 15s (capped from 20s)
      MockWebSocket.instances[1].simulateClose()
      vi.advanceTimersByTime(15000)
      expect(MockWebSocket.instances.length).toBe(3)
    })

    it('should reset backoff on successful connection', async () => {
      const provider = new CLIProvider('ws://localhost:8081', {
        autoReconnect: true,
        initialReconnectDelay: 1000,
      })

      const connectPromise = provider.connect()
      MockWebSocket.instances[0].simulateOpen()
      await connectPromise

      // First disconnect - wait for reconnect
      MockWebSocket.instances[0].simulateClose()
      vi.advanceTimersByTime(1000)

      // Successful reconnect
      MockWebSocket.instances[1].simulateOpen()

      // Second disconnect - should use initial delay (1s) again
      MockWebSocket.instances[1].simulateClose()
      vi.advanceTimersByTime(500)
      expect(MockWebSocket.instances.length).toBe(2) // Not yet

      vi.advanceTimersByTime(500)
      expect(MockWebSocket.instances.length).toBe(3) // 1s delay, not 2s
    })

    it('should not reconnect when autoReconnect is false', async () => {
      const provider = new CLIProvider('ws://localhost:8081', { autoReconnect: false })
      const statusCallback = vi.fn()
      provider.onConnectionChange(statusCallback)

      const connectPromise = provider.connect()
      MockWebSocket.instances[0].simulateOpen()
      await connectPromise

      // Simulate unexpected disconnect
      MockWebSocket.instances[0].simulateClose()

      expect(statusCallback).toHaveBeenCalledWith('disconnected')
      expect(statusCallback).not.toHaveBeenCalledWith('reconnecting')

      // Advance time - should not create new connection
      vi.advanceTimersByTime(30000)
      expect(MockWebSocket.instances.length).toBe(1)
    })
  })

  describe('message handling', () => {
    async function connectedProvider() {
      const provider = new CLIProvider('ws://localhost:8081')
      const connectPromise = provider.connect()
      MockWebSocket.instances[0].simulateOpen()
      await connectPromise
      return provider
    }

    it('should dispatch top message to results callback', async () => {
      const provider = await connectedProvider()
      const callback = vi.fn()
      provider.onResults(callback)

      MockWebSocket.instances[0].simulateMessage({
        msg: 'top',
        data: {
          RaceName: 'K1M Semi-Final',
          RaceStatus: 'Official',
          HighlightBib: '42',
          list: [
            { Rank: 1, Bib: '42', Name: 'Test Athlete', Total: '91.23', Pen: 2, Behind: '' },
            { Rank: 2, Bib: '15', Name: 'Second Place', Total: '93.45', Pen: 0, Behind: '+2.22' },
          ],
        },
      })

      expect(callback).toHaveBeenCalledWith({
        raceName: 'K1M Semi-Final',
        raceStatus: 'Official',
        highlightBib: '42',
        results: [
          expect.objectContaining({ rank: 1, bib: '42', name: 'Test Athlete', pen: 2 }),
          expect.objectContaining({ rank: 2, bib: '15', name: 'Second Place', behind: '+2.22' }),
        ],
      })
    })

    it('should dispatch comp message to onCourse callback', async () => {
      const provider = await connectedProvider()
      const callback = vi.fn()
      provider.onOnCourse(callback)

      MockWebSocket.instances[0].simulateMessage({
        msg: 'comp',
        data: {
          Bib: '9',
          Name: 'Test Athlete',
          Club: 'Test Club',
          Nat: 'CZE',
          Pen: 2,
          Gates: '0,0,2,0,50',
          Total: '95.67',
          TTBDiff: '+1.23',
          TTBName: 'Leader Name',
          Rank: 2,
        },
      })

      expect(callback).toHaveBeenCalledWith({
        current: expect.objectContaining({
          bib: '9',
          name: 'Test Athlete',
          club: 'Test Club',
          pen: 2,
          gates: '0,0,2,0,50',
          ttbDiff: '+1.23',
          ttbName: 'Leader Name',
        }),
        onCourse: expect.arrayContaining([
          expect.objectContaining({ bib: '9' }),
        ]),
      })
    })

    it('should dispatch oncourse message to onCourse callback', async () => {
      const provider = await connectedProvider()
      const callback = vi.fn()
      provider.onOnCourse(callback)

      MockWebSocket.instances[0].simulateMessage({
        msg: 'oncourse',
        data: [
          { Bib: '9', Name: 'First', Club: 'Club A' },
          { Bib: '12', Name: 'Second', Club: 'Club B' },
        ],
      })

      expect(callback).toHaveBeenCalledWith({
        current: expect.objectContaining({ bib: '9' }),
        onCourse: [
          expect.objectContaining({ bib: '9', name: 'First' }),
          expect.objectContaining({ bib: '12', name: 'Second' }),
        ],
      })
    })

    it('should handle empty comp message', async () => {
      const provider = await connectedProvider()
      const callback = vi.fn()
      provider.onOnCourse(callback)

      MockWebSocket.instances[0].simulateMessage({
        msg: 'comp',
        data: { Bib: '', Name: '' },
      })

      expect(callback).toHaveBeenCalledWith({
        current: null,
        onCourse: [],
      })
    })

    it('should dispatch control message to visibility callback', async () => {
      const provider = await connectedProvider()
      const callback = vi.fn()
      provider.onVisibility(callback)

      MockWebSocket.instances[0].simulateMessage({
        msg: 'control',
        data: {
          displayCurrent: '1',
          displayTop: '1',
          displayTitle: '0',
          displayTopBar: '1',
          displayFooter: '0',
          displayDayTime: '1',
          displayOnCourse: '0',
        },
      })

      expect(callback).toHaveBeenCalledWith({
        displayCurrent: true,
        displayTop: true,
        displayTitle: false,
        displayTopBar: true,
        displayFooter: false,
        displayDayTime: true,
        displayOnCourse: false,
      } as VisibilityState)
    })

    it('should dispatch title message to eventInfo callback', async () => {
      const provider = await connectedProvider()
      const callback = vi.fn()
      provider.onEventInfo(callback)

      MockWebSocket.instances[0].simulateMessage({
        msg: 'title',
        data: { text: 'K1 Men Semi-Final' },
      })

      expect(callback).toHaveBeenCalledWith({
        title: 'K1 Men Semi-Final',
        infoText: '',
        dayTime: '',
      })
    })

    it('should dispatch infotext message to eventInfo callback', async () => {
      const provider = await connectedProvider()
      const callback = vi.fn()
      provider.onEventInfo(callback)

      MockWebSocket.instances[0].simulateMessage({
        msg: 'infotext',
        data: { text: 'Race starts in 5 minutes' },
      })

      expect(callback).toHaveBeenCalledWith({
        title: '',
        infoText: 'Race starts in 5 minutes',
        dayTime: '',
      })
    })

    it('should dispatch daytime message to eventInfo callback', async () => {
      const provider = await connectedProvider()
      const callback = vi.fn()
      provider.onEventInfo(callback)

      MockWebSocket.instances[0].simulateMessage({
        msg: 'daytime',
        data: { time: '14:35:22' },
      })

      expect(callback).toHaveBeenCalledWith({
        title: '',
        infoText: '',
        dayTime: '14:35:22',
      })
    })

    it('should handle malformed message gracefully', async () => {
      const provider = await connectedProvider()
      const callback = vi.fn()
      provider.onResults(callback)

      // Send invalid JSON - should not throw
      const ws = MockWebSocket.instances[0]
      if (ws.onmessage) {
        ws.onmessage({ data: 'not valid json' })
      }

      expect(callback).not.toHaveBeenCalled()
    })

    it('should emit error callback for malformed message', async () => {
      const provider = await connectedProvider()
      const errorCallback = vi.fn()
      provider.onError(errorCallback)

      // Send invalid JSON
      const ws = MockWebSocket.instances[0]
      if (ws.onmessage) {
        ws.onmessage({ data: 'not valid json' })
      }

      expect(errorCallback).toHaveBeenCalledTimes(1)
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PARSE_ERROR',
          message: 'Failed to parse WebSocket message as JSON',
          timestamp: expect.any(Number),
        })
      )
    })

    it('should allow unsubscribing from error callback', async () => {
      const provider = await connectedProvider()
      const errorCallback = vi.fn()
      const unsubscribe = provider.onError(errorCallback)
      unsubscribe()

      // Send invalid JSON
      const ws = MockWebSocket.instances[0]
      if (ws.onmessage) {
        ws.onmessage({ data: 'not valid json' })
      }

      expect(errorCallback).not.toHaveBeenCalled()
    })
  })

  describe('callback subscription', () => {
    it('should allow unsubscribing from callbacks', async () => {
      const provider = new CLIProvider('ws://localhost:8081')
      const callback = vi.fn()
      const unsubscribe = provider.onResults(callback)

      unsubscribe()

      const connectPromise = provider.connect()
      MockWebSocket.instances[0].simulateOpen()
      await connectPromise

      MockWebSocket.instances[0].simulateMessage({
        msg: 'top',
        data: { RaceName: 'Test', list: [] },
      })

      expect(callback).not.toHaveBeenCalled()
    })

    it('should support multiple callbacks', async () => {
      const provider = new CLIProvider('ws://localhost:8081')
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      provider.onResults(callback1)
      provider.onResults(callback2)

      const connectPromise = provider.connect()
      MockWebSocket.instances[0].simulateOpen()
      await connectPromise

      MockWebSocket.instances[0].simulateMessage({
        msg: 'top',
        data: { RaceName: 'Test', list: [] },
      })

      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
    })
  })
})
