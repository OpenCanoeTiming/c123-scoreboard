import { describe, it, expect } from 'vitest'
import {
  isObject,
  isArray,
  isString,
  isNumeric,
  safeString,
  safeNumber,
  validateTopMessage,
  validateCompMessage,
  validateOnCourseMessage,
  validateControlMessage,
  validateTextMessage,
  validateResultRow,
  validateCompetitorData,
} from '../validation'

describe('validation utilities', () => {
  describe('isObject', () => {
    it('returns true for plain objects', () => {
      expect(isObject({})).toBe(true)
      expect(isObject({ key: 'value' })).toBe(true)
    })

    it('returns false for arrays', () => {
      expect(isObject([])).toBe(false)
      expect(isObject([1, 2, 3])).toBe(false)
    })

    it('returns false for null', () => {
      expect(isObject(null)).toBe(false)
    })

    it('returns false for primitives', () => {
      expect(isObject('string')).toBe(false)
      expect(isObject(123)).toBe(false)
      expect(isObject(true)).toBe(false)
      expect(isObject(undefined)).toBe(false)
    })
  })

  describe('isArray', () => {
    it('returns true for arrays', () => {
      expect(isArray([])).toBe(true)
      expect(isArray([1, 2, 3])).toBe(true)
    })

    it('returns false for objects', () => {
      expect(isArray({})).toBe(false)
    })

    it('returns false for primitives', () => {
      expect(isArray('string')).toBe(false)
      expect(isArray(123)).toBe(false)
    })
  })

  describe('isString', () => {
    it('returns true for strings', () => {
      expect(isString('')).toBe(true)
      expect(isString('hello')).toBe(true)
    })

    it('returns false for non-strings', () => {
      expect(isString(123)).toBe(false)
      expect(isString(null)).toBe(false)
      expect(isString({})).toBe(false)
    })
  })

  describe('isNumeric', () => {
    it('returns true for numbers', () => {
      expect(isNumeric(0)).toBe(true)
      expect(isNumeric(123)).toBe(true)
      expect(isNumeric(-45.6)).toBe(true)
    })

    it('returns true for numeric strings', () => {
      expect(isNumeric('123')).toBe(true)
      expect(isNumeric('-45.6')).toBe(true)
      expect(isNumeric('0')).toBe(true)
    })

    it('returns false for non-numeric values', () => {
      expect(isNumeric('')).toBe(false)
      expect(isNumeric('abc')).toBe(false)
      expect(isNumeric(NaN)).toBe(false)
      expect(isNumeric(null)).toBe(false)
    })
  })

  describe('safeString', () => {
    it('returns string for string input', () => {
      expect(safeString('hello')).toBe('hello')
      expect(safeString('')).toBe('')
    })

    it('converts numbers to strings', () => {
      expect(safeString(123)).toBe('123')
      expect(safeString(0)).toBe('0')
    })

    it('converts booleans to strings', () => {
      expect(safeString(true)).toBe('true')
      expect(safeString(false)).toBe('false')
    })

    it('returns default for null/undefined', () => {
      expect(safeString(null)).toBe('')
      expect(safeString(undefined)).toBe('')
      expect(safeString(null, 'default')).toBe('default')
    })

    it('returns default for objects/arrays', () => {
      expect(safeString({})).toBe('')
      expect(safeString([])).toBe('')
    })
  })

  describe('safeNumber', () => {
    it('returns number for number input', () => {
      expect(safeNumber(123)).toBe(123)
      expect(safeNumber(0)).toBe(0)
      expect(safeNumber(-45.6)).toBe(-45.6)
    })

    it('converts numeric strings to numbers', () => {
      expect(safeNumber('123')).toBe(123)
      expect(safeNumber('-45.6')).toBe(-45.6)
    })

    it('returns default for invalid input', () => {
      expect(safeNumber('')).toBe(0)
      expect(safeNumber('abc')).toBe(0)
      expect(safeNumber(null)).toBe(0)
      expect(safeNumber(undefined)).toBe(0)
      expect(safeNumber(NaN)).toBe(0)
    })

    it('uses custom default value', () => {
      expect(safeNumber('abc', -1)).toBe(-1)
      expect(safeNumber(null, 99)).toBe(99)
    })
  })
})

describe('message validators', () => {
  describe('validateTopMessage', () => {
    it('validates valid top message', () => {
      const message = {
        msg: 'top',
        data: {
          RaceName: 'Test Race',
          list: [],
        },
      }
      expect(validateTopMessage(message)).toEqual({ valid: true })
    })

    it('rejects non-object message', () => {
      expect(validateTopMessage('string')).toEqual({
        valid: false,
        error: 'Message must be an object',
      })
    })

    it('rejects message with non-object data', () => {
      const message = {
        msg: 'top',
        data: 'not an object',
      }
      expect(validateTopMessage(message)).toEqual({
        valid: false,
        error: 'Message data must be an object',
      })
    })

    it('rejects message with non-array list', () => {
      const message = {
        msg: 'top',
        data: {
          list: 'not an array',
        },
      }
      expect(validateTopMessage(message)).toEqual({
        valid: false,
        error: 'list must be an array',
      })
    })

    it('accepts message without list', () => {
      const message = {
        msg: 'top',
        data: {
          RaceName: 'Test',
        },
      }
      expect(validateTopMessage(message)).toEqual({ valid: true })
    })
  })

  describe('validateCompMessage', () => {
    it('validates valid comp message', () => {
      const message = {
        msg: 'comp',
        data: { Bib: '123' },
      }
      expect(validateCompMessage(message)).toEqual({ valid: true })
    })

    it('rejects non-object message', () => {
      expect(validateCompMessage(null)).toEqual({
        valid: false,
        error: 'Message must be an object',
      })
    })

    it('rejects message with non-object data', () => {
      const message = {
        msg: 'comp',
        data: [],
      }
      expect(validateCompMessage(message)).toEqual({
        valid: false,
        error: 'Message data must be an object',
      })
    })
  })

  describe('validateOnCourseMessage', () => {
    it('validates valid oncourse message', () => {
      const message = {
        msg: 'oncourse',
        data: [{ Bib: '123' }],
      }
      expect(validateOnCourseMessage(message)).toEqual({ valid: true })
    })

    it('rejects message with non-array data', () => {
      const message = {
        msg: 'oncourse',
        data: { Bib: '123' },
      }
      expect(validateOnCourseMessage(message)).toEqual({
        valid: false,
        error: 'Message data must be an array',
      })
    })
  })

  describe('validateControlMessage', () => {
    it('validates valid control message', () => {
      const message = {
        msg: 'control',
        data: {
          displayTop: '1',
          displayCurrent: '0',
        },
      }
      expect(validateControlMessage(message)).toEqual({ valid: true })
    })

    it('rejects non-object data', () => {
      const message = {
        msg: 'control',
        data: 'invalid',
      }
      expect(validateControlMessage(message)).toEqual({
        valid: false,
        error: 'Message data must be an object',
      })
    })
  })

  describe('validateTextMessage', () => {
    it('validates valid title message', () => {
      const message = {
        msg: 'title',
        data: { text: 'Test Title' },
      }
      expect(validateTextMessage(message, 'title')).toEqual({ valid: true })
    })

    it('validates valid infotext message', () => {
      const message = {
        msg: 'infotext',
        data: { text: 'Info text' },
      }
      expect(validateTextMessage(message, 'infotext')).toEqual({ valid: true })
    })

    it('validates valid daytime message', () => {
      const message = {
        msg: 'daytime',
        data: { time: '12:34:56' },
      }
      expect(validateTextMessage(message, 'daytime')).toEqual({ valid: true })
    })

    it('rejects wrong message type', () => {
      const message = {
        msg: 'title',
        data: { text: 'Test' },
      }
      expect(validateTextMessage(message, 'infotext')).toEqual({
        valid: false,
        error: 'Invalid message type: title',
      })
    })
  })

  describe('validateResultRow', () => {
    it('validates valid result row', () => {
      const row = {
        Bib: '123',
        Name: 'Test',
        Rank: 1,
      }
      expect(validateResultRow(row)).toEqual({ valid: true })
    })

    it('rejects row without Bib', () => {
      const row = {
        Name: 'Test',
        Rank: 1,
      }
      expect(validateResultRow(row)).toEqual({
        valid: false,
        error: 'Result row must have a Bib',
      })
    })

    it('rejects row with empty Bib', () => {
      const row = {
        Bib: '',
        Name: 'Test',
      }
      expect(validateResultRow(row)).toEqual({
        valid: false,
        error: 'Result row must have a Bib',
      })
    })

    it('rejects non-object row', () => {
      expect(validateResultRow('string')).toEqual({
        valid: false,
        error: 'Result row must be an object',
      })
    })
  })

  describe('validateCompetitorData', () => {
    it('validates valid competitor data', () => {
      const data = {
        Bib: '123',
        Name: 'Test',
      }
      expect(validateCompetitorData(data)).toEqual({ valid: true })
    })

    it('validates empty competitor data (valid for no one on course)', () => {
      expect(validateCompetitorData({})).toEqual({ valid: true })
    })

    it('rejects non-object data', () => {
      expect(validateCompetitorData('string')).toEqual({
        valid: false,
        error: 'Competitor data must be an object',
      })
    })
  })
})
