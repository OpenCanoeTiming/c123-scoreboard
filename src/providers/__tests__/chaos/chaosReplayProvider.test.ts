/**
 * Chaos Engineering Tests for ReplayProvider
 *
 * These tests verify the provider's robustness under adverse conditions:
 * - Random disconnects during playback
 * - Out-of-order timestamps
 * - Duplicate messages
 * - Very large payloads
 * - Empty/null payloads
 * - Malformed messages
 * - Rapid state changes
 * - Edge case timestamps
 * - Concurrent callback execution
 * - Memory stress scenarios
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ReplayProvider } from '../../ReplayProvider'

describe('Chaos Engineering - ReplayProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Helper to create JSONL content
  const createJSONL = (messages: Array<{ ts: number; src: string; type: string; data: unknown }>): string => {
    return messages.map(msg => JSON.stringify(msg)).join('\n')
  }

  // Helper to create valid comp message wrapper
  const createCompMessage = (bib: string, time: string = '0:00.00') => ({
    msg: 'comp',
    data: {
      Bib: bib,
      Name: `Athlete ${bib}`,
      Club: 'TEST',
      Time: time,
      Gates: '0,0,0,0,0',
    }
  })

  // Helper to create valid top message wrapper
  const createTopMessage = (highlightBib: string | null = null, results: unknown[] = []) => ({
    msg: 'top',
    data: {
      RaceName: 'Test Race',
      RaceStatus: 'Running',
      HighlightBib: highlightBib,
      list: results,
    }
  })

  describe('Random disconnects during playback', () => {
    it('should handle disconnect during message processing', async () => {
      const content = createJSONL([
        { ts: 0, src: 'ws', type: 'comp', data: createCompMessage('1') },
        { ts: 100, src: 'ws', type: 'comp', data: createCompMessage('2') },
        { ts: 200, src: 'ws', type: 'comp', data: createCompMessage('3') },
      ])

      const provider = new ReplayProvider(content)
      const onCourseCallback = vi.fn()
      provider.onOnCourse(onCourseCallback)

      await provider.connect()
      vi.advanceTimersByTime(50)

      // Disconnect during playback
      provider.disconnect()

      // Advance more time - no more messages should be processed
      vi.advanceTimersByTime(500)

      expect(onCourseCallback).toHaveBeenCalledTimes(1)
      expect(provider.status).toBe('disconnected')
    })

    it('should handle multiple rapid connect/disconnect cycles', async () => {
      const content = createJSONL([
        { ts: 0, src: 'ws', type: 'comp', data: createCompMessage('1') },
        { ts: 1000, src: 'ws', type: 'comp', data: createCompMessage('2') },
      ])

      const provider = new ReplayProvider(content, { autoPlay: false })
      const connectionCallback = vi.fn()
      provider.onConnectionChange(connectionCallback)

      // Rapid connect/disconnect cycles
      for (let i = 0; i < 10; i++) {
        await provider.connect()
        provider.disconnect()
      }

      // Should have 20 connection changes (10 connect + 10 disconnect pairs)
      // Each connect: connecting -> connected
      // Each disconnect: disconnected
      expect(connectionCallback.mock.calls.length).toBeGreaterThanOrEqual(20)
      expect(provider.status).toBe('disconnected')
    })

    it('should cleanup timers on disconnect', async () => {
      const content = createJSONL([
        { ts: 0, src: 'ws', type: 'comp', data: createCompMessage('1') },
        { ts: 10000, src: 'ws', type: 'comp', data: createCompMessage('2') },
      ])

      const provider = new ReplayProvider(content)
      await provider.connect()

      // First message processed
      vi.advanceTimersByTime(1)

      // Disconnect - should clear pending timer
      provider.disconnect()

      // Advance past when second message would have been processed
      vi.advanceTimersByTime(20000)

      // Provider should still be disconnected, no errors
      expect(provider.status).toBe('disconnected')
    })
  })

  describe('Out-of-order timestamps', () => {
    it('should handle messages with out-of-order timestamps', async () => {
      const content = createJSONL([
        { ts: 500, src: 'ws', type: 'comp', data: createCompMessage('1') },
        { ts: 100, src: 'ws', type: 'comp', data: createCompMessage('2') },
        { ts: 300, src: 'ws', type: 'comp', data: createCompMessage('3') },
      ])

      const provider = new ReplayProvider(content)
      const bibs: string[] = []
      provider.onOnCourse((data) => {
        if (data.current) bibs.push(data.current.bib)
      })

      await provider.connect()
      vi.advanceTimersByTime(1000)

      // Should be sorted by timestamp: 100 -> 300 -> 500
      expect(bibs).toEqual(['2', '3', '1'])
    })

    it('should handle negative timestamps', async () => {
      const content = createJSONL([
        { ts: -100, src: 'ws', type: 'comp', data: createCompMessage('1') },
        { ts: 0, src: 'ws', type: 'comp', data: createCompMessage('2') },
        { ts: 100, src: 'ws', type: 'comp', data: createCompMessage('3') },
      ])

      const provider = new ReplayProvider(content)
      const bibs: string[] = []
      provider.onOnCourse((data) => {
        if (data.current) bibs.push(data.current.bib)
      })

      await provider.connect()
      vi.advanceTimersByTime(500)

      // Should process all messages (sorted by ts)
      expect(bibs).toEqual(['1', '2', '3'])
    })

    it('should handle very large timestamps', async () => {
      const content = createJSONL([
        { ts: 0, src: 'ws', type: 'comp', data: createCompMessage('1') },
        { ts: Number.MAX_SAFE_INTEGER, src: 'ws', type: 'comp', data: createCompMessage('2') },
      ])

      const provider = new ReplayProvider(content, { speed: 1000000000 })
      const bibs: string[] = []
      provider.onOnCourse((data) => {
        if (data.current) bibs.push(data.current.bib)
      })

      await provider.connect()
      vi.advanceTimersByTime(100)

      // First message should be processed
      expect(bibs).toContain('1')
    })
  })

  describe('Duplicate messages', () => {
    it('should handle 10 identical messages', async () => {
      const duplicateMessage = { ts: 0, src: 'ws', type: 'comp', data: createCompMessage('1') }
      const content = createJSONL(Array(10).fill(duplicateMessage))

      const provider = new ReplayProvider(content)
      const callback = vi.fn()
      provider.onOnCourse(callback)

      await provider.connect()
      vi.advanceTimersByTime(100)

      // All 10 messages should be processed
      expect(callback).toHaveBeenCalledTimes(10)
    })

    it('should handle duplicate messages with same timestamp', async () => {
      const content = createJSONL([
        { ts: 100, src: 'ws', type: 'comp', data: createCompMessage('1') },
        { ts: 100, src: 'ws', type: 'comp', data: createCompMessage('2') },
        { ts: 100, src: 'ws', type: 'comp', data: createCompMessage('3') },
      ])

      const provider = new ReplayProvider(content)
      const bibs: string[] = []
      provider.onOnCourse((data) => {
        if (data.current) bibs.push(data.current.bib)
      })

      await provider.connect()
      vi.advanceTimersByTime(200)

      // All messages should be processed
      expect(bibs.length).toBe(3)
    })
  })

  describe('Very large payloads', () => {
    it('should handle 10KB text in message', async () => {
      const largeText = 'A'.repeat(10 * 1024)
      const content = createJSONL([
        { ts: 0, src: 'ws', type: 'title', data: { msg: 'title', data: { text: largeText } } },
      ])

      const provider = new ReplayProvider(content)
      const callback = vi.fn()
      provider.onEventInfo(callback)

      await provider.connect()
      vi.advanceTimersByTime(100)

      expect(callback).toHaveBeenCalled()
      expect(callback.mock.calls[0][0].title).toBe(largeText)
    })

    it('should handle 500 results in top message', async () => {
      const results = Array.from({ length: 500 }, (_, i) => ({
        Rank: i + 1,
        Bib: String(i + 1),
        Name: `Athlete ${i + 1}`,
        Club: 'TEST',
        Total: '1:00.00',
        Pen: 0,
        Behind: '+0.00',
      }))

      const content = createJSONL([
        { ts: 0, src: 'ws', type: 'top', data: createTopMessage(null, results) },
      ])

      const provider = new ReplayProvider(content)
      const callback = vi.fn()
      provider.onResults(callback)

      await provider.connect()
      vi.advanceTimersByTime(100)

      expect(callback).toHaveBeenCalled()
      expect(callback.mock.calls[0][0].results.length).toBe(500)
    })

    it('should handle deeply nested payload', async () => {
      const deeplyNested: Record<string, unknown> = {}
      let current = deeplyNested
      for (let i = 0; i < 100; i++) {
        current.nested = {}
        current = current.nested as Record<string, unknown>
      }
      current.value = 'deep'

      const content = createJSONL([
        { ts: 0, src: 'ws', type: 'comp', data: { msg: 'comp', data: { Bib: '1', nested: deeplyNested } } },
      ])

      const provider = new ReplayProvider(content)
      const callback = vi.fn()
      provider.onOnCourse(callback)

      // Should not crash
      await provider.connect()
      vi.advanceTimersByTime(100)

      expect(callback).toHaveBeenCalled()
    })
  })

  describe('Empty and null payloads', () => {
    it('should handle empty data object', async () => {
      const content = createJSONL([
        { ts: 0, src: 'ws', type: 'comp', data: { msg: 'comp', data: {} } },
      ])

      const provider = new ReplayProvider(content)
      const callback = vi.fn()
      provider.onOnCourse(callback)

      await provider.connect()
      vi.advanceTimersByTime(100)

      // Should process but current should be null (no Bib)
      expect(callback).toHaveBeenCalled()
      expect(callback.mock.calls[0][0].current).toBeNull()
    })

    it('should handle null data', async () => {
      const content = createJSONL([
        { ts: 0, src: 'ws', type: 'comp', data: null },
      ])

      const provider = new ReplayProvider(content)
      const callback = vi.fn()
      provider.onOnCourse(callback)

      // Should not crash
      await provider.connect()
      vi.advanceTimersByTime(100)

      // No callback since data is null
      expect(callback).not.toHaveBeenCalled()
    })

    it('should handle undefined data fields', async () => {
      const content = createJSONL([
        { ts: 0, src: 'ws', type: 'comp', data: { msg: 'comp', data: { Bib: '1', Name: undefined, Club: undefined } } },
      ])

      const provider = new ReplayProvider(content)
      const callback = vi.fn()
      provider.onOnCourse(callback)

      await provider.connect()
      vi.advanceTimersByTime(100)

      expect(callback).toHaveBeenCalled()
      expect(callback.mock.calls[0][0].current?.name).toBe('')
    })

    it('should handle missing msg wrapper', async () => {
      const content = createJSONL([
        { ts: 0, src: 'ws', type: 'comp', data: { Bib: '1', Name: 'Direct' } },
      ])

      const provider = new ReplayProvider(content)
      const callback = vi.fn()
      provider.onOnCourse(callback)

      await provider.connect()
      vi.advanceTimersByTime(100)

      // Should handle gracefully (no crash, no callback since structure is wrong)
      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('Malformed messages', () => {
    it('should handle truncated JSON', async () => {
      const content = '{"ts":0,"src":"ws","type":"comp","data":{"msg":"comp","data":{"Bib":"1'
        + '\n' + JSON.stringify({ ts: 100, src: 'ws', type: 'comp', data: createCompMessage('2') })

      const provider = new ReplayProvider(content)
      const callback = vi.fn()
      provider.onOnCourse(callback)
      const errorCallback = vi.fn()
      provider.onError(errorCallback)

      await provider.connect()
      vi.advanceTimersByTime(200)

      // Second message should be processed, first should emit error
      expect(callback).toHaveBeenCalledTimes(1)
      expect(errorCallback).toHaveBeenCalled()
      expect(errorCallback.mock.calls[0][0].code).toBe('PARSE_ERROR')
    })

    it('should handle non-JSON line', async () => {
      const content = 'not a json line\n'
        + JSON.stringify({ ts: 0, src: 'ws', type: 'comp', data: createCompMessage('1') })

      const provider = new ReplayProvider(content)
      const callback = vi.fn()
      provider.onOnCourse(callback)
      const errorCallback = vi.fn()
      provider.onError(errorCallback)

      await provider.connect()
      vi.advanceTimersByTime(100)

      // Valid message should be processed
      expect(callback).toHaveBeenCalledTimes(1)
      expect(errorCallback).toHaveBeenCalled()
    })

    it('should handle message with wrong type values', async () => {
      const content = createJSONL([
        { ts: 'not a number' as unknown as number, src: 'ws', type: 'comp', data: createCompMessage('1') },
      ])

      const provider = new ReplayProvider(content)
      const callback = vi.fn()
      provider.onOnCourse(callback)

      // Should not crash
      await provider.connect()
      vi.advanceTimersByTime(100)
    })

    it('should handle array instead of object', async () => {
      const content = createJSONL([
        { ts: 0, src: 'ws', type: 'comp', data: [1, 2, 3] },
      ])

      const provider = new ReplayProvider(content)
      const callback = vi.fn()
      provider.onOnCourse(callback)

      // Should not crash
      await provider.connect()
      vi.advanceTimersByTime(100)

      // No valid callback since data structure is wrong
      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('Rapid state changes', () => {
    it('should handle rapid play/pause cycles', async () => {
      const content = createJSONL([
        { ts: 0, src: 'ws', type: 'comp', data: createCompMessage('1') },
        { ts: 1000, src: 'ws', type: 'comp', data: createCompMessage('2') },
        { ts: 2000, src: 'ws', type: 'comp', data: createCompMessage('3') },
      ])

      const provider = new ReplayProvider(content, { autoPlay: false })
      await provider.connect()

      // Rapid play/pause cycles
      for (let i = 0; i < 50; i++) {
        provider.play()
        provider.pause()
      }

      // Should be in paused state
      expect(provider.state).toBe('paused')
    })

    it('should handle rapid speed changes', async () => {
      const content = createJSONL([
        { ts: 0, src: 'ws', type: 'comp', data: createCompMessage('1') },
        { ts: 1000, src: 'ws', type: 'comp', data: createCompMessage('2') },
      ])

      const provider = new ReplayProvider(content)
      await provider.connect()

      // Rapid speed changes
      for (let i = 1; i <= 20; i++) {
        provider.setSpeed(i * 0.5)
      }

      // Should still be functional
      vi.advanceTimersByTime(1000)
      expect(provider.state).not.toBe('idle')
    })

    it('should handle rapid seek operations', async () => {
      const content = createJSONL(
        Array.from({ length: 100 }, (_, i) => ({
          ts: i * 100,
          src: 'ws',
          type: 'comp',
          data: createCompMessage(String(i)),
        }))
      )

      const provider = new ReplayProvider(content, { autoPlay: false })
      await provider.connect()

      // Rapid seeks
      for (let i = 0; i < 50; i++) {
        provider.seek(Math.random() * 10000)
      }

      // Should not crash and be in valid state
      expect(['idle', 'finished']).toContain(provider.state)
    })
  })

  describe('Edge case timestamps', () => {
    it('should handle zero timestamp', async () => {
      const content = createJSONL([
        { ts: 0, src: 'ws', type: 'comp', data: createCompMessage('1') },
      ])

      const provider = new ReplayProvider(content)
      const callback = vi.fn()
      provider.onOnCourse(callback)

      await provider.connect()
      vi.advanceTimersByTime(1)

      expect(callback).toHaveBeenCalled()
    })

    it('should handle all messages at ts=0', async () => {
      const content = createJSONL([
        { ts: 0, src: 'ws', type: 'comp', data: createCompMessage('1') },
        { ts: 0, src: 'ws', type: 'comp', data: createCompMessage('2') },
        { ts: 0, src: 'ws', type: 'comp', data: createCompMessage('3') },
      ])

      const provider = new ReplayProvider(content)
      const callback = vi.fn()
      provider.onOnCourse(callback)

      await provider.connect()
      vi.advanceTimersByTime(100)

      expect(callback).toHaveBeenCalledTimes(3)
    })

    it('should handle fractional timestamps', async () => {
      const content = createJSONL([
        { ts: 0.1, src: 'ws', type: 'comp', data: createCompMessage('1') },
        { ts: 0.5, src: 'ws', type: 'comp', data: createCompMessage('2') },
        { ts: 0.9, src: 'ws', type: 'comp', data: createCompMessage('3') },
      ])

      const provider = new ReplayProvider(content)
      const callback = vi.fn()
      provider.onOnCourse(callback)

      await provider.connect()
      vi.advanceTimersByTime(100)

      expect(callback).toHaveBeenCalledTimes(3)
    })
  })

  describe('Concurrent callback execution', () => {
    it('should not break if callback throws', async () => {
      const content = createJSONL([
        { ts: 0, src: 'ws', type: 'comp', data: createCompMessage('1') },
        { ts: 100, src: 'ws', type: 'comp', data: createCompMessage('2') },
      ])

      const provider = new ReplayProvider(content)

      // First callback throws
      provider.onOnCourse(() => {
        throw new Error('Callback error')
      })

      // Second callback should still work
      const callback2 = vi.fn()
      provider.onOnCourse(callback2)

      await provider.connect()
      vi.advanceTimersByTime(200)

      // Second callback should have been called despite first throwing
      expect(callback2).toHaveBeenCalledTimes(2)
    })

    it('should handle slow callback', async () => {
      const content = createJSONL([
        { ts: 0, src: 'ws', type: 'comp', data: createCompMessage('1') },
        { ts: 50, src: 'ws', type: 'comp', data: createCompMessage('2') },
      ])

      const provider = new ReplayProvider(content)
      const callOrder: string[] = []

      provider.onOnCourse((data) => {
        callOrder.push(data.current?.bib || 'null')
      })

      await provider.connect()
      vi.advanceTimersByTime(100)

      // Both messages should be processed in order
      expect(callOrder).toEqual(['1', '2'])
    })

    it('should handle 100 subscribers', async () => {
      const content = createJSONL([
        { ts: 0, src: 'ws', type: 'comp', data: createCompMessage('1') },
      ])

      const provider = new ReplayProvider(content)
      const callbacks = Array.from({ length: 100 }, () => vi.fn())

      callbacks.forEach(cb => provider.onOnCourse(cb))

      await provider.connect()
      vi.advanceTimersByTime(100)

      // All 100 subscribers should receive the message
      callbacks.forEach(cb => {
        expect(cb).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('Memory stress scenarios', () => {
    it('should handle 1000 messages', async () => {
      const messages = Array.from({ length: 1000 }, (_, i) => ({
        ts: i * 10,
        src: 'ws',
        type: 'comp',
        data: createCompMessage(String(i)),
      }))

      const content = createJSONL(messages)
      const provider = new ReplayProvider(content, { speed: 10000 })
      const callback = vi.fn()
      provider.onOnCourse(callback)

      await provider.connect()
      vi.advanceTimersByTime(20000)

      expect(callback.mock.calls.length).toBe(1000)
    })

    it('should cleanup after disconnect with many messages pending', async () => {
      const messages = Array.from({ length: 1000 }, (_, i) => ({
        ts: i * 100,
        src: 'ws',
        type: 'comp',
        data: createCompMessage(String(i)),
      }))

      const content = createJSONL(messages)
      const provider = new ReplayProvider(content)
      const callback = vi.fn()
      provider.onOnCourse(callback)

      await provider.connect()
      vi.advanceTimersByTime(100)

      // Disconnect with ~999 messages still pending
      provider.disconnect()

      // Advance time - no more callbacks should fire
      const callCountAtDisconnect = callback.mock.calls.length
      vi.advanceTimersByTime(200000)

      expect(callback.mock.calls.length).toBe(callCountAtDisconnect)
    })

    it('should handle subscribe/unsubscribe during playback', async () => {
      const content = createJSONL(
        Array.from({ length: 100 }, (_, i) => ({
          ts: i * 10,
          src: 'ws',
          type: 'comp',
          data: createCompMessage(String(i)),
        }))
      )

      const provider = new ReplayProvider(content, { speed: 100 })
      await provider.connect()

      // Subscribe and unsubscribe rapidly during playback
      for (let i = 0; i < 50; i++) {
        const unsub = provider.onOnCourse(() => {})
        unsub()
      }

      vi.advanceTimersByTime(2000)

      // Should complete without errors
      expect(provider.state).toBe('finished')
    })
  })
})
