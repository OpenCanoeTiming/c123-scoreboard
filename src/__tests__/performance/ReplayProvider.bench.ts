/**
 * Performance benchmark tests for ReplayProvider
 *
 * Run with: npx vitest bench --reporter=verbose
 *
 * These tests measure message parsing and dispatch throughput.
 */

import { describe, bench, beforeEach } from 'vitest'
import { ReplayProvider } from '@/providers/ReplayProvider'

/**
 * Generate JSONL content with specified number of messages
 */
function generateJSONL(messageCount: number): string {
  const lines: string[] = []

  // Meta line
  lines.push(JSON.stringify({ _meta: { version: 1, startTime: Date.now() } }))

  // Generate messages at 100ms intervals
  for (let i = 0; i < messageCount; i++) {
    const ts = i * 100 // 100ms apart

    // Alternate between message types
    if (i % 5 === 0) {
      // Top message with results
      lines.push(JSON.stringify({
        ts,
        src: 'ws',
        type: 'top',
        data: {
          msg: 'top',
          data: {
            RaceName: 'Test Race',
            RaceStatus: 'Running',
            HighlightBib: i % 10 === 0 ? String(100 + i) : 0,
            list: generateResultsList(Math.min(50, i + 1))
          }
        }
      }))
    } else if (i % 5 === 1) {
      // Comp message
      lines.push(JSON.stringify({
        ts,
        src: 'ws',
        type: 'comp',
        data: {
          msg: 'comp',
          data: {
            Bib: String(100 + (i % 20)),
            Name: `COMPETITOR Test${i}`,
            Club: `Club ${i % 5}`,
            Nat: 'CZE',
            Time: `${i}:${(i % 60).toString().padStart(2, '0')}.00`,
            Gates: '0,0,0,0,2,0,0,0',
            Pen: i % 3 === 0 ? 2 : 0,
            TTBDiff: '+0.50',
            TTBName: 'Leader'
          }
        }
      }))
    } else if (i % 5 === 2) {
      // OnCourse message
      lines.push(JSON.stringify({
        ts,
        src: 'ws',
        type: 'oncourse',
        data: {
          msg: 'oncourse',
          data: [
            { Bib: String(100 + i), Name: `ON COURSE ${i}`, Club: 'Club', Nat: 'CZE', Time: '0:00.00' }
          ]
        }
      }))
    } else if (i % 5 === 3) {
      // Control message
      lines.push(JSON.stringify({
        ts,
        src: 'ws',
        type: 'control',
        data: {
          msg: 'control',
          data: {
            displayCurrent: '1',
            displayTop: '1',
            displayTitle: '1',
            displayTopBar: '1',
            displayFooter: '1',
            displayDayTime: '1',
            displayOnCourse: '0'
          }
        }
      }))
    } else {
      // DayTime message
      lines.push(JSON.stringify({
        ts,
        src: 'ws',
        type: 'daytime',
        data: {
          msg: 'daytime',
          data: {
            time: `${Math.floor(i / 60).toString().padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}`
          }
        }
      }))
    }
  }

  return lines.join('\n')
}

function generateResultsList(count: number): Array<Record<string, unknown>> {
  const results = []
  for (let i = 0; i < count; i++) {
    results.push({
      Rank: i + 1,
      Bib: String(100 + i),
      Name: `TESTOVIC Test${i}`,
      FamilyName: 'TESTOVIC',
      GivenName: `Test${i}`,
      Club: `Club ${i % 10}`,
      Nat: 'CZE',
      Total: `${90 + i}:${(i % 60).toString().padStart(2, '0')}.${(i % 100).toString().padStart(2, '0')}`,
      Pen: i % 5 === 0 ? 2 : 0,
      Behind: i === 0 ? '' : `+${i}.${(i % 100).toString().padStart(2, '0')}`
    })
  }
  return results
}

describe('ReplayProvider Performance Benchmarks', () => {
  describe('JSONL Parsing Performance', () => {
    bench('parse 100 messages', async () => {
      const jsonl = generateJSONL(100)
      const provider = new ReplayProvider(jsonl, { autoPlay: false, speed: 1000 })
      await provider.connect()
      provider.disconnect()
    })

    bench('parse 500 messages', async () => {
      const jsonl = generateJSONL(500)
      const provider = new ReplayProvider(jsonl, { autoPlay: false, speed: 1000 })
      await provider.connect()
      provider.disconnect()
    })

    bench('parse 1000 messages', async () => {
      const jsonl = generateJSONL(1000)
      const provider = new ReplayProvider(jsonl, { autoPlay: false, speed: 1000 })
      await provider.connect()
      provider.disconnect()
    })

    bench('parse 5000 messages', async () => {
      const jsonl = generateJSONL(5000)
      const provider = new ReplayProvider(jsonl, { autoPlay: false, speed: 1000 })
      await provider.connect()
      provider.disconnect()
    })
  })

  describe('Message Dispatch Throughput', () => {
    let provider: ReplayProvider
    let messagesReceived: number

    beforeEach(() => {
      messagesReceived = 0
    })

    bench('dispatch 100 messages at max speed', async () => {
      const jsonl = generateJSONL(100)
      provider = new ReplayProvider(jsonl, { autoPlay: false, speed: 10000 })

      provider.onResults(() => messagesReceived++)
      provider.onOnCourse(() => messagesReceived++)
      provider.onVisibility(() => messagesReceived++)
      provider.onEventInfo(() => messagesReceived++)

      await provider.connect()
      provider.play()

      // Wait for all messages to be dispatched
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (provider.state === 'finished') {
            clearInterval(checkInterval)
            resolve()
          }
        }, 1)
      })

      provider.disconnect()
    })

    bench('dispatch 500 messages at max speed', async () => {
      const jsonl = generateJSONL(500)
      provider = new ReplayProvider(jsonl, { autoPlay: false, speed: 10000 })

      provider.onResults(() => messagesReceived++)
      provider.onOnCourse(() => messagesReceived++)
      provider.onVisibility(() => messagesReceived++)
      provider.onEventInfo(() => messagesReceived++)

      await provider.connect()
      provider.play()

      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (provider.state === 'finished') {
            clearInterval(checkInterval)
            resolve()
          }
        }, 1)
      })

      provider.disconnect()
    })
  })

  describe('Callback Subscription Performance', () => {
    bench('subscribe 100 callbacks', () => {
      const jsonl = generateJSONL(10)
      const provider = new ReplayProvider(jsonl, { autoPlay: false })

      const unsubscribes: Array<() => void> = []

      for (let i = 0; i < 100; i++) {
        unsubscribes.push(provider.onResults(() => {}))
        unsubscribes.push(provider.onOnCourse(() => {}))
        unsubscribes.push(provider.onVisibility(() => {}))
        unsubscribes.push(provider.onEventInfo(() => {}))
      }

      // Cleanup
      unsubscribes.forEach((unsub) => unsub())
    })

    bench('subscribe and unsubscribe 100 times', () => {
      const jsonl = generateJSONL(10)
      const provider = new ReplayProvider(jsonl, { autoPlay: false })

      for (let i = 0; i < 100; i++) {
        const unsub = provider.onResults(() => {})
        unsub()
      }
    })
  })

  describe('Seek Performance', () => {
    bench('seek 100 times in 1000 message recording', async () => {
      const jsonl = generateJSONL(1000)
      const provider = new ReplayProvider(jsonl, { autoPlay: false })

      await provider.connect()

      for (let i = 0; i < 100; i++) {
        const position = Math.floor(Math.random() * provider.duration)
        provider.seek(position)
      }

      provider.disconnect()
    })
  })

  describe('Speed Change Performance', () => {
    bench('change speed 100 times during playback', async () => {
      const jsonl = generateJSONL(100)
      const provider = new ReplayProvider(jsonl, { autoPlay: false, speed: 1000 })

      await provider.connect()
      provider.play()

      for (let i = 0; i < 100; i++) {
        provider.setSpeed(1 + (i % 10))
      }

      provider.disconnect()
    })
  })

  describe('Connect/Disconnect Cycles', () => {
    bench('connect and disconnect 50 times', async () => {
      const jsonl = generateJSONL(50)

      for (let i = 0; i < 50; i++) {
        const provider = new ReplayProvider(jsonl, { autoPlay: false })
        await provider.connect()
        provider.disconnect()
      }
    })
  })

  describe('Large Results Array Parsing', () => {
    bench('parse top message with 100 results', () => {
      const message = {
        ts: 0,
        src: 'ws',
        type: 'top',
        data: {
          msg: 'top',
          data: {
            RaceName: 'Test',
            RaceStatus: 'Running',
            HighlightBib: 0,
            list: generateResultsList(100)
          }
        }
      }

      const jsonl = JSON.stringify({ _meta: {} }) + '\n' + JSON.stringify(message)
      const provider = new ReplayProvider(jsonl, { autoPlay: false })
      // Just parsing, no async
    })

    bench('parse top message with 500 results', () => {
      const message = {
        ts: 0,
        src: 'ws',
        type: 'top',
        data: {
          msg: 'top',
          data: {
            RaceName: 'Test',
            RaceStatus: 'Running',
            HighlightBib: 0,
            list: generateResultsList(500)
          }
        }
      }

      const jsonl = JSON.stringify({ _meta: {} }) + '\n' + JSON.stringify(message)
      const provider = new ReplayProvider(jsonl, { autoPlay: false })
      // Just parsing, no async
    })
  })
})
