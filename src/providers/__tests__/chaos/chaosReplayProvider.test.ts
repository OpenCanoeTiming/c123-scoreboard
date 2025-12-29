/**
 * Chaos Engineering Tests for ReplayProvider
 *
 * These tests verify the robustness of ReplayProvider under adverse conditions:
 * - Random disconnects during playback
 * - Messages in wrong order
 * - Duplicate messages
 * - Very large payloads
 * - Empty payloads
 * - Malformed messages
 * - Rapid state changes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ReplayProvider } from '../../ReplayProvider'

// Helper to generate random JSONL messages
function generateMessages(count: number, options: { includeInvalid?: boolean; largePayload?: boolean } = {}): string {
  const lines: string[] = []
  lines.push('{"_meta":{"version":2,"recorded":"2025-12-28T09:34:10.612Z"}}')

  for (let i = 0; i < count; i++) {
    const ts = i * 10

    if (options.includeInvalid && i % 10 === 7) {
      // Every 10th message (offset by 7) is invalid
      lines.push('not valid json {broken')
      continue
    }

    if (options.largePayload && i % 5 === 0) {
      // Every 5th message has a large payload
      const largeText = 'X'.repeat(10000) // 10KB text
      lines.push(JSON.stringify({
        ts,
        src: 'ws',
        type: 'infotext',
        data: { msg: 'infotext', data: { text: largeText } },
      }))
      continue
    }

    // Normal comp message
    lines.push(JSON.stringify({
      ts,
      src: 'ws',
      type: 'comp',
      data: {
        msg: 'comp',
        data: {
          Bib: String(i + 1),
          Name: `Athlete ${i + 1}`,
          Nat: 'CZE',
          Pen: '0',
          Gates: ',,,,,',
          Total: `${(90 + i * 0.1).toFixed(2)}`,
          TTBDiff: i === 0 ? '' : `+${(i * 0.5).toFixed(2)}`,
          TTBName: 'Leader',
          Rank: String(i + 1),
        },
      },
    }))
  }

  return lines.join('\n')
}

// Generate out-of-order messages
function generateOutOfOrderMessages(): string {
  const lines: string[] = []
  lines.push('{"_meta":{"version":2,"recorded":"2025-12-28T09:34:10.612Z"}}')

  // Messages with non-sequential timestamps
  const timestamps = [100, 50, 200, 25, 300, 150, 75]

  timestamps.forEach((ts, i) => {
    lines.push(JSON.stringify({
      ts,
      src: 'ws',
      type: 'comp',
      data: {
        msg: 'comp',
        data: {
          Bib: String(i + 1),
          Name: `Athlete ${i + 1}`,
          Nat: 'CZE',
          Pen: '0',
          Gates: ',,,,,',
          Total: `${90 + i}.00`,
          TTBDiff: '',
          TTBName: '',
          Rank: String(i + 1),
        },
      },
    }))
  })

  return lines.join('\n')
}

// Generate duplicate messages
function generateDuplicateMessages(): string {
  const lines: string[] = []
  lines.push('{"_meta":{"version":2,"recorded":"2025-12-28T09:34:10.612Z"}}')

  const message = {
    ts: 100,
    src: 'ws',
    type: 'comp',
    data: {
      msg: 'comp',
      data: {
        Bib: '1',
        Name: 'Test Athlete',
        Nat: 'CZE',
        Pen: '0',
        Gates: ',,,,,',
        Total: '90.00',
        TTBDiff: '',
        TTBName: '',
        Rank: '1',
      },
    },
  }

  // Same message 10 times with same timestamp
  for (let i = 0; i < 10; i++) {
    lines.push(JSON.stringify(message))
  }

  return lines.join('\n')
}

// Generate empty/null payload messages
function generateEmptyPayloadMessages(): string {
  const lines: string[] = []
  lines.push('{"_meta":{"version":2,"recorded":"2025-12-28T09:34:10.612Z"}}')

  // Various empty/null/undefined payloads
  lines.push(JSON.stringify({ ts: 10, src: 'ws', type: 'comp', data: null }))
  lines.push(JSON.stringify({ ts: 20, src: 'ws', type: 'comp', data: {} }))
  lines.push(JSON.stringify({ ts: 30, src: 'ws', type: 'comp', data: { msg: 'comp', data: null } }))
  lines.push(JSON.stringify({ ts: 40, src: 'ws', type: 'comp', data: { msg: 'comp', data: {} } }))
  lines.push(JSON.stringify({ ts: 50, src: 'ws', type: 'top', data: { msg: 'top', data: { Results: [] } } }))
  lines.push(JSON.stringify({ ts: 60, src: 'ws', type: 'oncourse', data: { msg: 'oncourse', data: [] } }))

  return lines.join('\n')
}

describe('Chaos Engineering - ReplayProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Random disconnects during playback', () => {
    it('should handle disconnect during message processing without crash', async () => {
      const provider = new ReplayProvider(generateMessages(100))
      const onCourseCallback = vi.fn()
      provider.onOnCourse(onCourseCallback)

      await provider.connect()

      // Let some messages process
      vi.advanceTimersByTime(200)

      // Disconnect mid-stream
      provider.disconnect()

      expect(provider.status).toBe('disconnected')
      expect(() => vi.advanceTimersByTime(1000)).not.toThrow()
    })

    it('should handle rapid connect/disconnect cycles', async () => {
      const provider = new ReplayProvider(generateMessages(50))

      for (let i = 0; i < 20; i++) {
        await provider.connect()
        vi.advanceTimersByTime(Math.random() * 100)
        provider.disconnect()
      }

      expect(provider.status).toBe('disconnected')
    })

    it('should handle disconnect at exact message boundary', async () => {
      const provider = new ReplayProvider(generateMessages(10))
      await provider.connect()

      // Advance to exact message time and disconnect
      vi.advanceTimersByTime(50)
      provider.disconnect()

      expect(provider.status).toBe('disconnected')
      expect(provider.connected).toBe(false)
    })
  })

  describe('Messages in wrong order', () => {
    it('should process out-of-order timestamps without crash', async () => {
      const provider = new ReplayProvider(generateOutOfOrderMessages())
      const onCourseCallback = vi.fn()
      provider.onOnCourse(onCourseCallback)

      await provider.connect()

      // Process all messages
      vi.advanceTimersByTime(500)

      expect(provider.status).toBe('connected')
      // Provider should still work (may emit in whatever order)
    })

    it('should handle negative timestamp differences', async () => {
      const jsonl = `{"_meta":{"version":2}}
{"ts":100,"src":"ws","type":"comp","data":{"msg":"comp","data":{"Bib":"1"}}}
{"ts":50,"src":"ws","type":"comp","data":{"msg":"comp","data":{"Bib":"2"}}}`

      const provider = new ReplayProvider(jsonl)
      await provider.connect()

      // Should not throw
      expect(() => vi.advanceTimersByTime(200)).not.toThrow()
    })
  })

  describe('Duplicate messages', () => {
    it('should handle identical messages gracefully', async () => {
      const provider = new ReplayProvider(generateDuplicateMessages())
      const onCourseCallback = vi.fn()
      provider.onOnCourse(onCourseCallback)

      await provider.connect()
      vi.advanceTimersByTime(200)

      // All 10 duplicates should be processed (provider doesn't dedupe)
      expect(provider.status).toBe('connected')
    })

    it('should not crash on repeated rapid message delivery', async () => {
      // All messages at ts=0
      const lines = ['{"_meta":{"version":2}}']
      for (let i = 0; i < 100; i++) {
        lines.push(JSON.stringify({
          ts: 0,
          src: 'ws',
          type: 'comp',
          data: { msg: 'comp', data: { Bib: String(i) } },
        }))
      }

      const provider = new ReplayProvider(lines.join('\n'))
      const onCourseCallback = vi.fn()
      provider.onOnCourse(onCourseCallback)

      await provider.connect()

      // All messages should fire immediately
      expect(() => vi.advanceTimersByTime(10)).not.toThrow()
    })
  })

  describe('Very large payloads', () => {
    it('should handle 10KB text payload', async () => {
      const provider = new ReplayProvider(generateMessages(10, { largePayload: true }))
      const eventInfoCallback = vi.fn()
      provider.onEventInfo(eventInfoCallback)

      await provider.connect()
      vi.advanceTimersByTime(200)

      expect(provider.status).toBe('connected')
      expect(eventInfoCallback).toHaveBeenCalled()
    })

    it('should handle 100KB results array', async () => {
      const results = []
      for (let i = 0; i < 500; i++) {
        results.push({
          Bib: String(i + 1),
          Name: `Athlete With Very Long Name Number ${i + 1} From Country`,
          Nat: 'CZE',
          Total: `${(90 + i * 0.01).toFixed(2)}`,
          Pen: String(i % 50),
          Behind: i === 0 ? '' : `+${(i * 0.1).toFixed(2)}`,
          Rank: String(i + 1),
        })
      }

      // Use 'list' key as expected by ReplayProvider.parseResults
      const jsonl = `{"_meta":{"version":2}}
{"ts":10,"src":"ws","type":"top","data":{"msg":"top","data":{"list":${JSON.stringify(results)}}}}`

      const provider = new ReplayProvider(jsonl)
      const resultsCallback = vi.fn()
      provider.onResults(resultsCallback)

      await provider.connect()
      vi.advanceTimersByTime(100)

      expect(resultsCallback).toHaveBeenCalled()
      const callData = resultsCallback.mock.calls[0][0]
      expect(callData.results.length).toBe(500)
    })

    it('should handle 1MB payload without timeout', async () => {
      // Generate ~1MB of data
      const bigText = 'A'.repeat(1024 * 1024)
      const jsonl = `{"_meta":{"version":2}}
{"ts":10,"src":"ws","type":"infotext","data":{"msg":"infotext","data":{"text":"${bigText}"}}}`

      const provider = new ReplayProvider(jsonl)
      const eventInfoCallback = vi.fn()
      provider.onEventInfo(eventInfoCallback)

      await provider.connect()
      vi.advanceTimersByTime(100)

      expect(eventInfoCallback).toHaveBeenCalled()
    })
  })

  describe('Empty payloads', () => {
    it('should handle null data gracefully', async () => {
      const provider = new ReplayProvider(generateEmptyPayloadMessages())
      const onCourseCallback = vi.fn()
      const resultsCallback = vi.fn()
      provider.onOnCourse(onCourseCallback)
      provider.onResults(resultsCallback)

      await provider.connect()
      vi.advanceTimersByTime(200)

      // Should not crash
      expect(provider.status).toBe('connected')
    })

    it('should handle empty arrays', async () => {
      const jsonl = `{"_meta":{"version":2}}
{"ts":10,"src":"ws","type":"top","data":{"msg":"top","data":{"Results":[]}}}
{"ts":20,"src":"ws","type":"oncourse","data":{"msg":"oncourse","data":[]}}`

      const provider = new ReplayProvider(jsonl)
      const resultsCallback = vi.fn()
      const onCourseCallback = vi.fn()
      provider.onResults(resultsCallback)
      provider.onOnCourse(onCourseCallback)

      await provider.connect()
      vi.advanceTimersByTime(100)

      expect(resultsCallback).toHaveBeenCalledWith(expect.objectContaining({
        results: [],
      }))
    })

    it('should handle missing required fields', async () => {
      const jsonl = `{"_meta":{"version":2}}
{"ts":10,"src":"ws","type":"comp","data":{"msg":"comp","data":{}}}
{"ts":20,"src":"ws","type":"top","data":{"msg":"top","data":{}}}`

      const provider = new ReplayProvider(jsonl)
      const errorCallback = vi.fn()
      provider.onError(errorCallback)

      await provider.connect()
      vi.advanceTimersByTime(100)

      // Should not crash, may or may not call error callback
      expect(provider.status).toBe('connected')
    })
  })

  describe('Malformed messages', () => {
    it('should skip invalid JSON lines without crashing', async () => {
      const provider = new ReplayProvider(generateMessages(50, { includeInvalid: true }))
      const errorCallback = vi.fn()
      provider.onError(errorCallback)

      await provider.connect()
      vi.advanceTimersByTime(1000)

      expect(provider.status).toBe('connected')
      // Should have logged errors for invalid lines
      expect(errorCallback).toHaveBeenCalled()
    })

    it('should handle truncated JSON', async () => {
      const jsonl = `{"_meta":{"version":2}}
{"ts":10,"src":"ws","type":"comp","data":{"msg":"comp","data":{"Bib":"1"
{"ts":20,"src":"ws","type":"comp","data":{"msg":"comp","data":{"Bib":"2"}}}`

      const provider = new ReplayProvider(jsonl)
      const errorCallback = vi.fn()
      provider.onError(errorCallback)

      await provider.connect()
      vi.advanceTimersByTime(100)

      expect(provider.status).toBe('connected')
    })

    it('should handle Unicode corruption', async () => {
      const jsonl = `{"_meta":{"version":2}}
{"ts":10,"src":"ws","type":"infotext","data":{"msg":"infotext","data":{"text":"Příliš žluťoučký kůň\uD800"}}}`

      const provider = new ReplayProvider(jsonl)

      await provider.connect()
      vi.advanceTimersByTime(100)

      expect(provider.status).toBe('connected')
    })

    it('should handle wrong type field', async () => {
      const jsonl = `{"_meta":{"version":2}}
{"ts":10,"src":"ws","type":"unknown_message_type","data":{"msg":"unknown","data":{}}}
{"ts":20,"src":"ws","type":12345,"data":{"msg":"numeric_type","data":{}}}
{"ts":30,"src":"ws","type":null,"data":{"msg":"null_type","data":{}}}`

      const provider = new ReplayProvider(jsonl)
      await provider.connect()
      vi.advanceTimersByTime(100)

      expect(provider.status).toBe('connected')
    })
  })

  describe('Rapid state changes', () => {
    it('should handle rapid play/pause cycles', async () => {
      const provider = new ReplayProvider(generateMessages(100))
      await provider.connect()

      for (let i = 0; i < 50; i++) {
        provider.play()
        vi.advanceTimersByTime(5)
        provider.pause()
      }

      expect(provider.state).toBe('paused')
    })

    it('should handle rapid speed changes', async () => {
      const provider = new ReplayProvider(generateMessages(100))
      await provider.connect()
      provider.play()

      const speeds = [0.1, 10, 0.5, 100, 1, 0.01, 50]
      for (const speed of speeds) {
        provider.setSpeed(speed)
        vi.advanceTimersByTime(10)
      }

      expect(provider.status).toBe('connected')
    })

    it('should handle rapid seek operations', async () => {
      const provider = new ReplayProvider(generateMessages(100))
      await provider.connect()

      const positions = [500, 100, 900, 0, 700, 200, 800]
      for (const pos of positions) {
        provider.seek(pos)
        vi.advanceTimersByTime(10)
      }

      expect(provider.status).toBe('connected')
    })

    it('should handle interleaved operations', async () => {
      const provider = new ReplayProvider(generateMessages(100))
      await provider.connect()

      // Interleave various operations
      provider.play()
      vi.advanceTimersByTime(50)
      provider.setSpeed(5)
      provider.pause()
      provider.seek(200)
      provider.setSpeed(0.5)
      provider.play()
      vi.advanceTimersByTime(100)
      provider.pause()
      provider.seek(0)
      provider.setSpeed(1)
      provider.play()

      expect(provider.status).toBe('connected')
    })
  })

  describe('Edge case timestamps', () => {
    it('should handle zero timestamps', async () => {
      const jsonl = `{"_meta":{"version":2}}
{"ts":0,"src":"ws","type":"comp","data":{"msg":"comp","data":{"Bib":"1"}}}
{"ts":0,"src":"ws","type":"comp","data":{"msg":"comp","data":{"Bib":"2"}}}
{"ts":0,"src":"ws","type":"comp","data":{"msg":"comp","data":{"Bib":"3"}}}`

      const provider = new ReplayProvider(jsonl)
      const onCourseCallback = vi.fn()
      provider.onOnCourse(onCourseCallback)

      await provider.connect()
      vi.advanceTimersByTime(10)

      expect(provider.status).toBe('connected')
    })

    it('should handle very large timestamps', async () => {
      const jsonl = `{"_meta":{"version":2}}
{"ts":0,"src":"ws","type":"comp","data":{"msg":"comp","data":{"Bib":"1"}}}
{"ts":999999999,"src":"ws","type":"comp","data":{"msg":"comp","data":{"Bib":"2"}}}`

      const provider = new ReplayProvider(jsonl)
      await provider.connect()

      // First message should fire immediately
      vi.advanceTimersByTime(10)
      expect(provider.status).toBe('connected')

      // We won't wait for the second message (would take too long at 1x speed)
      // But seeking should work
      provider.seek(999999999)
      vi.advanceTimersByTime(10)

      expect(provider.status).toBe('connected')
    })

    it('should handle negative timestamps', async () => {
      const jsonl = `{"_meta":{"version":2}}
{"ts":-100,"src":"ws","type":"comp","data":{"msg":"comp","data":{"Bib":"1"}}}
{"ts":100,"src":"ws","type":"comp","data":{"msg":"comp","data":{"Bib":"2"}}}`

      const provider = new ReplayProvider(jsonl)
      await provider.connect()
      vi.advanceTimersByTime(200)

      expect(provider.status).toBe('connected')
    })
  })

  describe('Concurrent callback execution', () => {
    it('should handle callback that throws error', async () => {
      const jsonl = `{"_meta":{"version":2}}
{"ts":10,"src":"ws","type":"comp","data":{"msg":"comp","data":{"Bib":"1"}}}
{"ts":20,"src":"ws","type":"comp","data":{"msg":"comp","data":{"Bib":"2"}}}`

      const provider = new ReplayProvider(jsonl)

      // This callback throws
      const throwingCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error')
      })
      const normalCallback = vi.fn()

      provider.onOnCourse(throwingCallback)
      provider.onOnCourse(normalCallback)

      await provider.connect()

      // Should not crash the provider, both callbacks should be attempted
      expect(() => vi.advanceTimersByTime(100)).not.toThrow()
    })

    it('should handle callback that takes long time', async () => {
      const provider = new ReplayProvider(generateMessages(10))

      const slowCallback = vi.fn().mockImplementation(() => {
        // Simulate slow operation by doing nothing (in fake timers this is instant)
        return new Promise(resolve => setTimeout(resolve, 1000))
      })

      provider.onOnCourse(slowCallback)
      await provider.connect()
      vi.advanceTimersByTime(200)

      expect(provider.status).toBe('connected')
    })

    it('should handle callback that modifies provider state', async () => {
      const provider = new ReplayProvider(generateMessages(10))

      let callCount = 0
      const stateModifyingCallback = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 3) {
          provider.pause()
        }
        if (callCount === 5) {
          provider.play()
        }
      })

      provider.onOnCourse(stateModifyingCallback)
      await provider.connect()
      vi.advanceTimersByTime(1000)

      expect(provider.status).toBe('connected')
    })
  })

  describe('Memory stress', () => {
    it('should handle 1000 messages without degradation', async () => {
      const provider = new ReplayProvider(generateMessages(1000))
      const onCourseCallback = vi.fn()
      provider.onOnCourse(onCourseCallback)

      await provider.connect()
      provider.setSpeed(1000) // Speed up

      vi.advanceTimersByTime(20000)

      expect(provider.status).toBe('connected')
    })

    it('should handle many subscribers', async () => {
      const provider = new ReplayProvider(generateMessages(10))
      const callbacks: vi.Mock[] = []

      for (let i = 0; i < 100; i++) {
        const cb = vi.fn()
        callbacks.push(cb)
        provider.onOnCourse(cb)
      }

      await provider.connect()
      vi.advanceTimersByTime(200)

      // All 100 callbacks should have been called
      for (const cb of callbacks) {
        expect(cb).toHaveBeenCalled()
      }
    })

    it('should handle rapid subscribe/unsubscribe', async () => {
      const provider = new ReplayProvider(generateMessages(50))
      await provider.connect()

      for (let i = 0; i < 100; i++) {
        const cb = vi.fn()
        const unsubscribe = provider.onOnCourse(cb)
        vi.advanceTimersByTime(5)
        unsubscribe()
      }

      expect(provider.status).toBe('connected')
    })
  })
})
