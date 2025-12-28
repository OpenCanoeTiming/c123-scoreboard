import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ReplayProvider } from '../ReplayProvider'
import type { OnCourseData } from '../types'
import type { VisibilityState } from '@/types'

// Sample JSONL content for testing
const sampleJSONL = `{"_meta":{"version":2,"recorded":"2025-12-28T09:34:10.612Z"}}
{"ts":4,"src":"ws","type":"infotext","data":{"msg":"infotext","data":{"text":"Test Info Text"}}}
{"ts":4,"src":"ws","type":"title","data":{"msg":"title","data":{"text":"Test Race Title"}}}
{"ts":5,"src":"ws","type":"control","data":{"msg":"control","data":{"displayCurrent":"1","displayTop":"1","displayTop10":"0","displayInfoText":"0","displaySchedule":"0","displayDayTime":"0","displayTitle":"1","displayTopBar":"1","displayFooter":"1","displayOnCourse":"0","displayOnStart":"0"}}}
{"ts":100,"src":"ws","type":"comp","data":{"msg":"comp","data":{"Bib":"9","Name":"Test Athlete","Nat":"CZE","Pen":"0","Gates":",,,,,","Total":"0.00","TTBDiff":"+1.23","TTBName":"Leader","Rank":"2"}}}
{"ts":200,"src":"ws","type":"oncourse","data":{"msg":"oncourse","data":[{"Bib":"9","Name":"Test Athlete","Club":"Test Club","Nat":"CZE","Pen":"0","Gates":",,,,,","Total":"0.00","TTBDiff":"+1.23","TTBName":"Leader","Rank":"2","RaceId":"K1M_ST_BR1"}]}}
{"ts":300,"src":"tcp","type":"OnCourse","data":"<xml>ignored</xml>"}
{"ts":400,"src":"ws","type":"comp","data":{"msg":"comp","data":{"Bib":"","Name":"","Nat":"","Pen":"","Gates":"","Total":"","TTBDiff":"","TTBName":"","Rank":""}}}
`

describe('ReplayProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('constructor and initialization', () => {
    it('should create provider with default options', () => {
      const provider = new ReplayProvider(sampleJSONL)
      expect(provider.status).toBe('disconnected')
      expect(provider.connected).toBe(false)
    })

    it('should accept custom options', () => {
      const provider = new ReplayProvider(sampleJSONL, {
        speed: 2.0,
        autoPlay: false,
        loop: true,
      })
      expect(provider.status).toBe('disconnected')
    })
  })

  describe('connect', () => {
    it('should load messages and change status to connected', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      const statusCallback = vi.fn()
      provider.onConnectionChange(statusCallback)

      await provider.connect()

      expect(provider.status).toBe('connected')
      expect(provider.connected).toBe(true)
      expect(statusCallback).toHaveBeenCalledWith('connecting')
      expect(statusCallback).toHaveBeenCalledWith('connected')
    })

    it('should filter messages by source (ws only by default)', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      await provider.connect()

      // The TCP message at ts=300 should be filtered out
      // We have 6 ws messages in the sample
      expect(provider.messageCount).toBe(6)
    })

    it('should skip metadata line', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      await provider.connect()

      // Metadata should not be counted as a message
      expect(provider.messageCount).toBe(6)
    })

    it('should not reconnect if already connected', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      await provider.connect()

      const statusCallback = vi.fn()
      provider.onConnectionChange(statusCallback)

      await provider.connect()

      expect(statusCallback).not.toHaveBeenCalled()
    })
  })

  describe('disconnect', () => {
    it('should stop playback and change status to disconnected', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      await provider.connect()
      provider.play()

      provider.disconnect()

      expect(provider.status).toBe('disconnected')
      expect(provider.connected).toBe(false)
      expect(provider.state).toBe('idle')
    })
  })

  describe('playback controls', () => {
    it('should start playback with play()', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      await provider.connect()

      provider.play()

      expect(provider.state).toBe('playing')
    })

    it('should pause playback with pause()', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      await provider.connect()
      provider.play()

      provider.pause()

      expect(provider.state).toBe('paused')
    })

    it('should resume playback after pause', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      await provider.connect()
      provider.play()
      provider.pause()

      provider.resume()

      expect(provider.state).toBe('playing')
    })

    it('should stop and reset playback', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      await provider.connect()
      provider.play()
      vi.advanceTimersByTime(100)

      provider.stop()

      expect(provider.state).toBe('idle')
      expect(provider.position).toBe(0)
    })

    it('should seek to position', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      await provider.connect()

      provider.seek(150)

      // Should be at the message with ts >= 150 (ts=200)
      expect(provider.position).toBe(200)
    })

    it('should change speed', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      await provider.connect()
      provider.play()

      provider.setSpeed(2.0)

      expect(provider.state).toBe('playing')
    })

    it('should throw error for invalid speed', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      await provider.connect()

      expect(() => provider.setSpeed(0)).toThrow('Speed multiplier must be positive')
      expect(() => provider.setSpeed(-1)).toThrow('Speed multiplier must be positive')
    })
  })

  describe('message dispatch', () => {
    it('should dispatch title message to eventInfo callback', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      const callback = vi.fn()
      provider.onEventInfo(callback)

      await provider.connect()
      provider.play()

      // Advance past first messages (ts=4 has title and infotext)
      vi.advanceTimersByTime(10)

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Race Title',
        })
      )
    })

    it('should dispatch infotext message to eventInfo callback', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      const callback = vi.fn()
      provider.onEventInfo(callback)

      await provider.connect()
      provider.play()
      vi.advanceTimersByTime(10)

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          infoText: 'Test Info Text',
        })
      )
    })

    it('should dispatch control message to visibility callback', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      const callback = vi.fn()
      provider.onVisibility(callback)

      await provider.connect()
      provider.play()
      vi.advanceTimersByTime(10)

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          displayCurrent: true,
          displayTop: true,
          displayTitle: true,
          displayTopBar: true,
          displayFooter: true,
          displayDayTime: false,
          displayOnCourse: false,
        } as VisibilityState)
      )
    })

    it('should dispatch comp message to onCourse callback', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      const callback = vi.fn()
      provider.onOnCourse(callback)

      await provider.connect()
      provider.play()
      vi.advanceTimersByTime(150) // Advance past ts=100

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          current: expect.objectContaining({
            bib: '9',
            name: 'Test Athlete',
            ttbDiff: '+1.23',
          }),
        } as Partial<OnCourseData>)
      )
    })

    it('should dispatch oncourse message to onCourse callback', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      const callback = vi.fn()
      provider.onOnCourse(callback)

      await provider.connect()
      provider.play()
      vi.advanceTimersByTime(250) // Advance past ts=200

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          onCourse: expect.arrayContaining([
            expect.objectContaining({
              bib: '9',
              club: 'Test Club',
              raceId: 'K1M_ST_BR1',
            }),
          ]),
        } as Partial<OnCourseData>)
      )
    })

    it('should handle empty comp message (competitor left)', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      const callback = vi.fn()
      provider.onOnCourse(callback)

      await provider.connect()
      provider.play()
      vi.advanceTimersByTime(450) // Advance past ts=400

      // Last call should have null current
      const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0] as OnCourseData
      expect(lastCall.current).toBeNull()
    })
  })

  describe('timing', () => {
    it('should dispatch messages at correct intervals (realtime)', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false, speed: 1.0 })
      const callback = vi.fn()
      provider.onOnCourse(callback)

      await provider.connect()
      provider.play()

      // At t=0, no comp messages yet (first comp is at ts=100)
      expect(callback).not.toHaveBeenCalled()

      // Advance to ts=100
      vi.advanceTimersByTime(100)
      expect(callback).toHaveBeenCalledTimes(1)

      // Advance to ts=200
      vi.advanceTimersByTime(100)
      expect(callback).toHaveBeenCalledTimes(2)
    })

    it('should dispatch messages faster with speed multiplier', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false, speed: 2.0 })
      const callback = vi.fn()
      provider.onOnCourse(callback)

      await provider.connect()
      provider.play()

      // With 2x speed, ts=100 message should arrive at t=50
      vi.advanceTimersByTime(50)
      expect(callback).toHaveBeenCalledTimes(1)

      // ts=200 message should arrive at t=100
      vi.advanceTimersByTime(50)
      expect(callback).toHaveBeenCalledTimes(2)
    })
  })

  describe('callback subscription', () => {
    it('should allow unsubscribing from callbacks', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      const callback = vi.fn()
      const unsubscribe = provider.onEventInfo(callback)

      unsubscribe()

      await provider.connect()
      provider.play()
      vi.advanceTimersByTime(10)

      expect(callback).not.toHaveBeenCalled()
    })

    it('should support multiple callbacks', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      provider.onEventInfo(callback1)
      provider.onEventInfo(callback2)

      await provider.connect()
      provider.play()
      vi.advanceTimersByTime(10)

      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
    })
  })

  describe('loop mode', () => {
    it('should loop playback when enabled', async () => {
      // Simple JSONL with just one message
      const simpleJSONL = `{"_meta":{"version":2}}
{"ts":10,"src":"ws","type":"title","data":{"msg":"title","data":{"text":"Loop Test"}}}
`
      const provider = new ReplayProvider(simpleJSONL, { autoPlay: false, loop: true })
      const callback = vi.fn()
      provider.onEventInfo(callback)

      await provider.connect()
      provider.play()

      // First play - advance exactly to trigger first message
      vi.advanceTimersByTime(10)
      const callsAfterFirst = callback.mock.calls.length
      expect(callsAfterFirst).toBeGreaterThanOrEqual(1)

      // After loop restart - message should play again
      // Stop and check we got more calls (loop worked)
      vi.advanceTimersByTime(20)
      expect(callback.mock.calls.length).toBeGreaterThan(callsAfterFirst)
    })
  })

  describe('duration and position', () => {
    it('should return correct duration', async () => {
      const provider = new ReplayProvider(sampleJSONL, { autoPlay: false })
      await provider.connect()

      expect(provider.duration).toBe(400) // Last message ts
    })

    it('should return 0 duration for empty recording', async () => {
      const emptyJSONL = `{"_meta":{"version":2}}`
      const provider = new ReplayProvider(emptyJSONL, { autoPlay: false, sources: ['ws'] })
      await provider.connect()

      expect(provider.duration).toBe(0)
    })
  })

  describe('error callback', () => {
    it('should emit error for invalid JSONL line', async () => {
      const invalidJSONL = `{"_meta":{"version":2}}
{"ts":10,"src":"ws","type":"title","data":{"msg":"title","data":{"text":"Valid"}}}
not valid json
{"ts":20,"src":"ws","type":"title","data":{"msg":"title","data":{"text":"Valid2"}}}
`
      const provider = new ReplayProvider(invalidJSONL, { autoPlay: false })
      const errorCallback = vi.fn()
      provider.onError(errorCallback)

      await provider.connect()

      expect(errorCallback).toHaveBeenCalledTimes(1)
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PARSE_ERROR',
          message: 'Invalid JSONL line in recording',
          timestamp: expect.any(Number),
        })
      )
      // Valid messages should still be loaded
      expect(provider.messageCount).toBe(2)
    })

    it('should allow unsubscribing from error callback', async () => {
      const invalidJSONL = `{"_meta":{"version":2}}
not valid json
`
      const provider = new ReplayProvider(invalidJSONL, { autoPlay: false })
      const errorCallback = vi.fn()
      const unsubscribe = provider.onError(errorCallback)
      unsubscribe()

      await provider.connect()

      expect(errorCallback).not.toHaveBeenCalled()
    })
  })
})
