import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { C123Provider } from '../C123Provider'

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

  simulateMessage(data: string) {
    if (this.onmessage) {
      this.onmessage({ data })
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

describe('C123Provider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('constructor', () => {
    it('should create provider with ws:// URL', () => {
      const provider = new C123Provider('ws://localhost:8082')
      expect(provider.status).toBe('disconnected')
      expect(provider.connected).toBe(false)
    })

    it('should add ws:// prefix if missing', () => {
      const provider = new C123Provider('localhost:8082')
      expect(provider.status).toBe('disconnected')
    })

    it('should throw error for invalid URL', () => {
      expect(() => new C123Provider('')).toThrow('Invalid WebSocket URL')
    })
  })

  describe('connect', () => {
    it('should connect and change status to connected', async () => {
      const provider = new C123Provider('ws://localhost:8082')
      const statusCallback = vi.fn()
      provider.onConnectionChange(statusCallback)

      const connectPromise = provider.connect()

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      await connectPromise

      expect(provider.status).toBe('connected')
      expect(provider.connected).toBe(true)
      expect(statusCallback).toHaveBeenCalledWith('connecting')
      expect(statusCallback).toHaveBeenCalledWith('connected')
    })

    it('should reject on connection error', async () => {
      const provider = new C123Provider('ws://localhost:8082')

      const connectPromise = provider.connect()

      const ws = MockWebSocket.instances[0]
      ws.simulateError(new Error('Connection refused'))
      ws.simulateClose()

      await expect(connectPromise).rejects.toThrow()
    })
  })

  describe('disconnect', () => {
    it('should disconnect and change status', async () => {
      const provider = new C123Provider('ws://localhost:8082')

      const connectPromise = provider.connect()
      MockWebSocket.instances[0].simulateOpen()
      await connectPromise

      provider.disconnect()

      expect(provider.status).toBe('disconnected')
      expect(provider.connected).toBe(false)
    })

    it('should not trigger reconnect on manual disconnect', async () => {
      const provider = new C123Provider('ws://localhost:8082', { autoReconnect: true })

      const connectPromise = provider.connect()
      MockWebSocket.instances[0].simulateOpen()
      await connectPromise

      const statusCallback = vi.fn()
      provider.onConnectionChange(statusCallback)

      provider.disconnect()

      vi.advanceTimersByTime(5000)

      expect(statusCallback).toHaveBeenCalledWith('disconnected')
      expect(statusCallback).not.toHaveBeenCalledWith('reconnecting')
    })
  })

  describe('auto reconnect', () => {
    it('should attempt reconnect on unexpected disconnect', async () => {
      const provider = new C123Provider('ws://localhost:8082', { autoReconnect: true })
      const statusCallback = vi.fn()
      provider.onConnectionChange(statusCallback)

      const connectPromise = provider.connect()
      MockWebSocket.instances[0].simulateOpen()
      await connectPromise

      MockWebSocket.instances[0].simulateClose()

      expect(statusCallback).toHaveBeenCalledWith('reconnecting')
    })
  })

  describe('XML message handling', () => {
    async function connectedProvider() {
      const provider = new C123Provider('ws://localhost:8082')
      const connectPromise = provider.connect()
      MockWebSocket.instances[0].simulateOpen()
      await connectPromise
      return provider
    }

    describe('OnCourse messages', () => {
      it('should parse OnCourse XML with single competitor', async () => {
        const provider = await connectedProvider()
        const callback = vi.fn()
        provider.onOnCourse(callback)

        const xml = `
          <Canoe123 System="Main">
            <OnCourse Total="1" Position="1">
              <Participant
                Bib="9"
                Name="KOPEČEK Michal"
                Club="VS Tábor"
                Nat="CZE"
                RaceId="K1M_ST_BR2_6" />
              <Result Type="C"
                Gates="0,0,0,2,0,0,2,0,50"
                dtStart="16:14:00.000"
                dtFinish="" />
              <Result Type="T"
                Pen="54"
                Time="8115"
                Total="8169"
                TTBDiff="+12.79"
                TTBName="J. KREJČÍ"
                Rank="8" />
            </OnCourse>
          </Canoe123>
        `

        MockWebSocket.instances[0].simulateMessage(xml)

        expect(callback).toHaveBeenCalledWith({
          current: expect.objectContaining({
            bib: '9',
            name: 'KOPEČEK Michal',
            club: 'VS Tábor',
            nat: 'CZE',
            raceId: 'K1M_ST_BR2_6',
            pen: 54,
            time: '8115',
            total: '8169',
            gates: '0,0,0,2,0,0,2,0,50',
            dtStart: '16:14:00.000',
            dtFinish: null,
            ttbDiff: '+12.79',
            ttbName: 'J. KREJČÍ',
            rank: 8,
          }),
          onCourse: [expect.objectContaining({ bib: '9' })],
          updateOnCourse: true,
        })
      })

      it('should parse OnCourse with empty dtFinish as null', async () => {
        const provider = await connectedProvider()
        const callback = vi.fn()
        provider.onOnCourse(callback)

        const xml = `
          <Canoe123 System="Main">
            <OnCourse>
              <Participant Bib="5" Name="Test" Club="Club" Nat="" RaceId="TEST" />
              <Result Type="C" dtStart="10:00:00" dtFinish="" />
              <Result Type="T" Pen="0" Time="" Total="" />
            </OnCourse>
          </Canoe123>
        `

        MockWebSocket.instances[0].simulateMessage(xml)

        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            current: expect.objectContaining({
              dtFinish: null,
            }),
          })
        )
      })

      it('should parse OnCourse with dtFinish timestamp', async () => {
        const provider = await connectedProvider()
        const callback = vi.fn()
        provider.onOnCourse(callback)

        const xml = `
          <Canoe123 System="Main">
            <OnCourse>
              <Participant Bib="5" Name="Test" Club="Club" Nat="" RaceId="TEST" />
              <Result Type="C" dtStart="10:00:00" dtFinish="10:01:30.500" />
              <Result Type="T" Pen="2" Time="9050" Total="9250" />
            </OnCourse>
          </Canoe123>
        `

        MockWebSocket.instances[0].simulateMessage(xml)

        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            current: expect.objectContaining({
              dtFinish: '10:01:30.500',
            }),
          })
        )
      })
    })

    describe('Results messages', () => {
      it('should parse Results XML with multiple rows', async () => {
        const provider = await connectedProvider()
        const callback = vi.fn()
        provider.onResults(callback)

        const xml = `
          <Canoe123 System="Main">
            <Results RaceId="K1M_ST_BR2_6" Current="Y" MainTitle="K1m - střední trať" SubTitle="1st and 2nd Run">
              <Row Number="1">
                <Participant
                  Bib="1"
                  Name="KREJČÍ Jakub"
                  FamilyName="KREJČÍ"
                  GivenName="Jakub"
                  Club="TJ DUKLA Praha"
                  Nat="CZE" />
                <Result Type="T" Pen="2" Time="79.99" Total="78.99" Rank="1" Behind="" />
              </Row>
              <Row Number="2">
                <Participant
                  Bib="5"
                  Name="NOVÁK Petr"
                  FamilyName="NOVÁK"
                  GivenName="Petr"
                  Club="SK Tábor"
                  Nat="CZE" />
                <Result Type="T" Pen="0" Time="81.50" Total="81.50" Rank="2" Behind="+2.51" />
              </Row>
            </Results>
          </Canoe123>
        `

        MockWebSocket.instances[0].simulateMessage(xml)

        expect(callback).toHaveBeenCalledWith({
          results: [
            expect.objectContaining({
              rank: 1,
              bib: '1',
              name: 'KREJČÍ Jakub',
              familyName: 'KREJČÍ',
              givenName: 'Jakub',
              club: 'TJ DUKLA Praha',
              nat: 'CZE',
              total: '78.99',
              pen: 2,
              behind: '',
            }),
            expect.objectContaining({
              rank: 2,
              bib: '5',
              name: 'NOVÁK Petr',
              total: '81.50',
              behind: '+2.51',
            }),
          ],
          raceName: 'K1m - střední trať - 1st and 2nd Run',
          raceStatus: '3', // Current=Y means running
          highlightBib: null,
        })
      })

      it('should sort results by rank', async () => {
        const provider = await connectedProvider()
        const callback = vi.fn()
        provider.onResults(callback)

        const xml = `
          <Canoe123 System="Main">
            <Results MainTitle="Test" SubTitle="">
              <Row Number="3">
                <Participant Bib="3" Name="Third" />
                <Result Type="T" Rank="3" />
              </Row>
              <Row Number="1">
                <Participant Bib="1" Name="First" />
                <Result Type="T" Rank="1" />
              </Row>
              <Row Number="2">
                <Participant Bib="2" Name="Second" />
                <Result Type="T" Rank="2" />
              </Row>
            </Results>
          </Canoe123>
        `

        MockWebSocket.instances[0].simulateMessage(xml)

        const results = callback.mock.calls[0][0].results
        expect(results[0].rank).toBe(1)
        expect(results[1].rank).toBe(2)
        expect(results[2].rank).toBe(3)
      })
    })

    describe('TimeOfDay messages', () => {
      it('should parse TimeOfDay XML', async () => {
        const provider = await connectedProvider()
        const callback = vi.fn()
        provider.onEventInfo(callback)

        const xml = `
          <Canoe123 System="Main">
            <TimeOfDay>14:35:22</TimeOfDay>
          </Canoe123>
        `

        MockWebSocket.instances[0].simulateMessage(xml)

        expect(callback).toHaveBeenCalledWith({
          title: '',
          infoText: '',
          dayTime: '14:35:22',
        })
      })
    })

    describe('RaceConfig messages', () => {
      it('should parse RaceConfig XML', async () => {
        const provider = await connectedProvider()
        const callback = vi.fn()
        provider.onConfig(callback)

        const xml = `
          <Canoe123 System="Main">
            <RaceConfig NrSplits="0" NrGates="24" GateConfig="NNRNNRNRNNNRNNRNRNNRNNRN" />
          </Canoe123>
        `

        MockWebSocket.instances[0].simulateMessage(xml)

        expect(callback).toHaveBeenCalledWith({
          raceName: '',
          raceStatus: '',
          gateCount: 24,
        })
      })
    })

    describe('Proxy status messages', () => {
      it('should emit error on proxy disconnect', async () => {
        const provider = await connectedProvider()
        const errorCallback = vi.fn()
        provider.onError(errorCallback)

        MockWebSocket.instances[0].simulateMessage(
          JSON.stringify({ type: 'proxy_status', status: 'disconnected' })
        )

        expect(errorCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'CONNECTION_ERROR',
            message: 'Proxy lost connection to C123',
          })
        )
      })

      it('should not emit error on proxy connected', async () => {
        const provider = await connectedProvider()
        const errorCallback = vi.fn()
        provider.onError(errorCallback)

        MockWebSocket.instances[0].simulateMessage(
          JSON.stringify({ type: 'proxy_status', status: 'connected' })
        )

        expect(errorCallback).not.toHaveBeenCalled()
      })
    })

    describe('Error handling', () => {
      it('should emit error for invalid XML', async () => {
        const provider = await connectedProvider()
        const errorCallback = vi.fn()
        provider.onError(errorCallback)

        MockWebSocket.instances[0].simulateMessage('<invalid xml without closing')

        expect(errorCallback).toHaveBeenCalled()
      })

      it('should emit error for missing Canoe123 root', async () => {
        const provider = await connectedProvider()
        const errorCallback = vi.fn()
        provider.onError(errorCallback)

        MockWebSocket.instances[0].simulateMessage('<SomeOtherRoot><Data /></SomeOtherRoot>')

        expect(errorCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Missing Canoe123 root element',
          })
        )
      })

      it('should ignore unknown XML elements', async () => {
        const provider = await connectedProvider()
        const resultsCallback = vi.fn()
        const onCourseCallback = vi.fn()
        provider.onResults(resultsCallback)
        provider.onOnCourse(onCourseCallback)

        const xml = `
          <Canoe123 System="Main">
            <UnknownElement>some data</UnknownElement>
          </Canoe123>
        `

        MockWebSocket.instances[0].simulateMessage(xml)

        expect(resultsCallback).not.toHaveBeenCalled()
        expect(onCourseCallback).not.toHaveBeenCalled()
      })
    })
  })

  describe('callback subscription', () => {
    it('should allow unsubscribing from callbacks', async () => {
      const provider = new C123Provider('ws://localhost:8082')
      const callback = vi.fn()
      const unsubscribe = provider.onResults(callback)

      unsubscribe()

      const connectPromise = provider.connect()
      MockWebSocket.instances[0].simulateOpen()
      await connectPromise

      MockWebSocket.instances[0].simulateMessage(`
        <Canoe123 System="Main">
          <Results MainTitle="Test" SubTitle="">
            <Row Number="1">
              <Participant Bib="1" Name="Test" />
            </Row>
          </Results>
        </Canoe123>
      `)

      expect(callback).not.toHaveBeenCalled()
    })

    it('should support multiple callbacks', async () => {
      const provider = new C123Provider('ws://localhost:8082')
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      provider.onEventInfo(callback1)
      provider.onEventInfo(callback2)

      const connectPromise = provider.connect()
      MockWebSocket.instances[0].simulateOpen()
      await connectPromise

      MockWebSocket.instances[0].simulateMessage(`
        <Canoe123 System="Main">
          <TimeOfDay>10:00:00</TimeOfDay>
        </Canoe123>
      `)

      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
    })
  })
})
