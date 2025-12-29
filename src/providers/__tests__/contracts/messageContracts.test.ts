/**
 * Contract tests for WebSocket message parsing
 *
 * These tests validate that real messages from recordings conform to
 * expected schemas and that our validators correctly accept valid data.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  validateTopMessage,
  validateCompMessage,
  validateOnCourseMessage,
  validateControlMessage,
  validateTextMessage,
  validateResultRow,
  validateCompetitorData,
  isObject,
  isArray,
  isString,
} from '../../utils/validation'

// Path to test recording
const RECORDING_PATH = path.resolve(__dirname, '../../../../public/recordings/rec-2025-12-28T09-34-10.jsonl')

interface RecordedMessage {
  ts: number
  src: string
  type: string
  data: unknown
}

/**
 * Load and parse messages from JSONL recording
 */
function loadRecording(): RecordedMessage[] {
  const content = fs.readFileSync(RECORDING_PATH, 'utf-8')
  const lines = content.split('\n').filter(line => line.trim())
  const messages: RecordedMessage[] = []

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line)
      // Skip meta line
      if (parsed._meta) continue
      if (parsed.ts !== undefined && parsed.src && parsed.type) {
        messages.push(parsed as RecordedMessage)
      }
    } catch {
      // Skip unparseable lines
    }
  }

  return messages
}

/**
 * Filter messages by source and type
 */
function filterMessages(messages: RecordedMessage[], source: string, type: string): RecordedMessage[] {
  return messages.filter(m => m.src === source && m.type === type)
}

describe('Message Contract Tests', () => {
  const messages = loadRecording()

  describe('Recording file validation', () => {
    it('should load recording file successfully', () => {
      expect(messages.length).toBeGreaterThan(0)
    })

    it('should contain WebSocket messages', () => {
      const wsMessages = messages.filter(m => m.src === 'ws')
      expect(wsMessages.length).toBeGreaterThan(0)
    })

    it('should have messages with required fields', () => {
      for (const msg of messages.slice(0, 100)) {
        expect(msg).toHaveProperty('ts')
        expect(msg).toHaveProperty('src')
        expect(msg).toHaveProperty('type')
      }
    })
  })

  describe('CLI "comp" message contract', () => {
    const compMessages = filterMessages(messages, 'ws', 'comp')

    it('should have comp messages in recording', () => {
      expect(compMessages.length).toBeGreaterThan(0)
    })

    it('should validate all comp messages', () => {
      for (const msg of compMessages) {
        const result = validateCompMessage(msg.data)
        expect(result.valid).toBe(true)
      }
    })

    it('should have correct structure for comp message data', () => {
      for (const msg of compMessages) {
        const data = msg.data as { msg: string; data: Record<string, unknown> }
        expect(data).toHaveProperty('msg', 'comp')
        expect(data).toHaveProperty('data')
        expect(isObject(data.data)).toBe(true)
      }
    })

    it('should have valid competitor data when competitor present', () => {
      const withCompetitor = compMessages.filter(msg => {
        const data = msg.data as { data: { Bib?: string } }
        return data.data?.Bib && data.data.Bib.trim() !== ''
      })

      for (const msg of withCompetitor) {
        const data = msg.data as { data: Record<string, unknown> }
        const result = validateCompetitorData(data.data)
        expect(result.valid).toBe(true)

        // Competitor should have Name when Bib is present
        expect(data.data).toHaveProperty('Name')
      }
    })

    it('should handle empty competitor data', () => {
      const empty = compMessages.filter(msg => {
        const data = msg.data as { data: { Bib?: string } }
        return !data.data?.Bib || data.data.Bib.trim() === ''
      })

      for (const msg of empty) {
        const data = msg.data as { data: Record<string, unknown> }
        const result = validateCompetitorData(data.data)
        expect(result.valid).toBe(true)
      }
    })

    it('should have expected fields in competitor data', () => {
      const expectedFields = ['Bib', 'Name', 'Nat', 'Pen', 'Gates', 'Total', 'TTBDiff', 'TTBName', 'Rank']

      for (const msg of compMessages.slice(0, 10)) {
        const data = msg.data as { data: Record<string, unknown> }
        for (const field of expectedFields) {
          expect(data.data).toHaveProperty(field)
        }
      }
    })
  })

  describe('CLI "oncourse" message contract', () => {
    const oncourseMessages = filterMessages(messages, 'ws', 'oncourse')

    it('should have oncourse messages in recording', () => {
      expect(oncourseMessages.length).toBeGreaterThan(0)
    })

    it('should validate all oncourse messages', () => {
      for (const msg of oncourseMessages) {
        const result = validateOnCourseMessage(msg.data)
        expect(result.valid).toBe(true)
      }
    })

    it('should have correct structure for oncourse message data', () => {
      for (const msg of oncourseMessages) {
        const data = msg.data as { msg: string; data: unknown[] }
        expect(data).toHaveProperty('msg', 'oncourse')
        expect(data).toHaveProperty('data')
        expect(isArray(data.data)).toBe(true)
      }
    })

    it('should have valid competitor data for each competitor on course', () => {
      for (const msg of oncourseMessages) {
        const data = msg.data as { data: Record<string, unknown>[] }
        for (const competitor of data.data) {
          const result = validateCompetitorData(competitor)
          expect(result.valid).toBe(true)
        }
      }
    })

    it('should have expected fields in oncourse competitor', () => {
      const expectedFields = ['Bib', 'Name', 'Club', 'Gates', 'Pen', 'Race', 'RaceId']

      const withCompetitors = oncourseMessages.filter(msg => {
        const data = msg.data as { data: unknown[] }
        return data.data.length > 0
      })

      for (const msg of withCompetitors.slice(0, 5)) {
        const data = msg.data as { data: Record<string, unknown>[] }
        for (const competitor of data.data) {
          for (const field of expectedFields) {
            expect(competitor).toHaveProperty(field)
          }
        }
      }
    })
  })

  describe('CLI "control" message contract', () => {
    const controlMessages = filterMessages(messages, 'ws', 'control')

    it('should have control messages in recording', () => {
      expect(controlMessages.length).toBeGreaterThan(0)
    })

    it('should validate all control messages', () => {
      for (const msg of controlMessages) {
        const result = validateControlMessage(msg.data)
        expect(result.valid).toBe(true)
      }
    })

    it('should have correct structure for control message data', () => {
      for (const msg of controlMessages) {
        const data = msg.data as { msg: string; data: Record<string, unknown> }
        expect(data).toHaveProperty('msg', 'control')
        expect(data).toHaveProperty('data')
        expect(isObject(data.data)).toBe(true)
      }
    })

    it('should have visibility flags as strings', () => {
      const visibilityFlags = [
        'displayCurrent',
        'displayTop',
        'displayTitle',
        'displayTopBar',
        'displayFooter',
        'displayDayTime',
        'displayOnCourse',
      ]

      for (const msg of controlMessages) {
        const data = msg.data as { data: Record<string, unknown> }
        for (const flag of visibilityFlags) {
          if (data.data[flag] !== undefined) {
            // Values can be "0", "1", or boolean
            const value = data.data[flag]
            expect(['0', '1', true, false, 0, 1]).toContain(value)
          }
        }
      }
    })
  })

  describe('CLI "title" message contract', () => {
    const titleMessages = filterMessages(messages, 'ws', 'title')

    it('should have title messages in recording', () => {
      expect(titleMessages.length).toBeGreaterThan(0)
    })

    it('should validate all title messages', () => {
      for (const msg of titleMessages) {
        const result = validateTextMessage(msg.data, 'title')
        expect(result.valid).toBe(true)
      }
    })

    it('should have text field in title data', () => {
      for (const msg of titleMessages) {
        const data = msg.data as { data: { text?: string } }
        expect(data.data).toHaveProperty('text')
        expect(isString(data.data.text)).toBe(true)
      }
    })
  })

  describe('CLI "infotext" message contract', () => {
    const infotextMessages = filterMessages(messages, 'ws', 'infotext')

    it('should have infotext messages in recording', () => {
      expect(infotextMessages.length).toBeGreaterThan(0)
    })

    it('should validate all infotext messages', () => {
      for (const msg of infotextMessages) {
        const result = validateTextMessage(msg.data, 'infotext')
        expect(result.valid).toBe(true)
      }
    })

    it('should have text field in infotext data', () => {
      for (const msg of infotextMessages) {
        const data = msg.data as { data: { text?: string } }
        expect(data.data).toHaveProperty('text')
        expect(isString(data.data.text)).toBe(true)
      }
    })
  })

  describe('Gates string format contract', () => {
    const compMessages = filterMessages(messages, 'ws', 'comp')
    const oncourseMessages = filterMessages(messages, 'ws', 'oncourse')

    it('should have valid gates format in comp messages', () => {
      for (const msg of compMessages) {
        const data = msg.data as { data: { Gates?: string } }
        if (data.data.Gates) {
          // Gates should be comma-separated or space-separated values
          expect(typeof data.data.Gates).toBe('string')

          // Should contain only valid characters (digits, commas, spaces)
          expect(data.data.Gates).toMatch(/^[\d,\s]*$/)
        }
      }
    })

    it('should have valid gates format in oncourse messages', () => {
      for (const msg of oncourseMessages) {
        const data = msg.data as { data: { Gates?: string }[] }
        for (const competitor of data.data) {
          if (competitor.Gates) {
            expect(typeof competitor.Gates).toBe('string')
            expect(competitor.Gates).toMatch(/^[\d,\s]*$/)
          }
        }
      }
    })
  })

  describe('Time format contract', () => {
    const compMessages = filterMessages(messages, 'ws', 'comp')

    it('should have valid time format', () => {
      for (const msg of compMessages) {
        const data = msg.data as { data: { Total?: string; Time?: string } }

        if (data.data.Total && data.data.Total.trim() !== '') {
          // Time format should be numeric or "M:SS.ss" format (may have leading/trailing spaces)
          expect(data.data.Total.trim()).toMatch(/^[\d:.]*$/)
        }
      }
    })

    it('should have valid TTBDiff format', () => {
      for (const msg of compMessages) {
        const data = msg.data as { data: { TTBDiff?: string } }

        if (data.data.TTBDiff && data.data.TTBDiff !== '') {
          // TTBDiff should be +/- prefixed time
          expect(data.data.TTBDiff).toMatch(/^[+-]?[\d:.]*$/)
        }
      }
    })
  })

  describe('Penalty format contract', () => {
    const compMessages = filterMessages(messages, 'ws', 'comp')

    it('should have valid penalty values', () => {
      for (const msg of compMessages) {
        const data = msg.data as { data: { Pen?: string | number } }

        if (data.data.Pen !== undefined && data.data.Pen !== '') {
          const pen = typeof data.data.Pen === 'string' ? parseInt(data.data.Pen, 10) : data.data.Pen

          // Penalty should be a non-negative integer, divisible by 2 (0, 2, 4, 50, etc)
          if (!isNaN(pen)) {
            expect(pen).toBeGreaterThanOrEqual(0)
          }
        }
      }
    })
  })

  describe('Bib format contract', () => {
    const compMessages = filterMessages(messages, 'ws', 'comp')
    const oncourseMessages = filterMessages(messages, 'ws', 'oncourse')

    it('should have string Bib values in comp messages', () => {
      for (const msg of compMessages) {
        const data = msg.data as { data: { Bib?: unknown } }
        if (data.data.Bib !== undefined) {
          expect(typeof data.data.Bib).toBe('string')
        }
      }
    })

    it('should have string Bib values in oncourse messages', () => {
      for (const msg of oncourseMessages) {
        const data = msg.data as { data: { Bib?: unknown }[] }
        for (const competitor of data.data) {
          if (competitor.Bib !== undefined) {
            expect(typeof competitor.Bib).toBe('string')
          }
        }
      }
    })
  })

  describe('Message ordering contract', () => {
    it('should have timestamps in non-decreasing order', () => {
      let lastTs = 0
      for (const msg of messages) {
        expect(msg.ts).toBeGreaterThanOrEqual(lastTs)
        lastTs = msg.ts
      }
    })

    it('should have reasonable timestamp gaps', () => {
      for (let i = 1; i < Math.min(messages.length, 1000); i++) {
        const gap = messages[i].ts - messages[i - 1].ts
        // Gap should not exceed 5 seconds (5000ms)
        expect(gap).toBeLessThanOrEqual(5000)
      }
    })
  })

  describe('Source type contract', () => {
    it('should have valid source types', () => {
      const validSources = ['ws', 'tcp', 'udp27333', 'udp10600']

      for (const msg of messages) {
        expect(validSources).toContain(msg.src)
      }
    })

    it('should have WebSocket messages for CLI protocol', () => {
      const wsMessages = messages.filter(m => m.src === 'ws')
      const wsTypes = [...new Set(wsMessages.map(m => m.type))]

      // CLI WebSocket should include these message types
      const expectedTypes = ['comp', 'oncourse', 'control', 'title', 'infotext']
      for (const type of expectedTypes) {
        expect(wsTypes).toContain(type)
      }
    })
  })
})
