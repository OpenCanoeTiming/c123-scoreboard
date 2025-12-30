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
  describe('type guards', () => {
    it('isObject distinguishes objects from non-objects', () => {
      // True for plain objects
      expect(isObject({})).toBe(true)
      expect(isObject({ key: 'value' })).toBe(true)
      // False for arrays, null, and primitives
      expect(isObject([])).toBe(false)
      expect(isObject(null)).toBe(false)
      expect(isObject('string')).toBe(false)
      expect(isObject(123)).toBe(false)
      expect(isObject(undefined)).toBe(false)
    })

    it('isArray distinguishes arrays from non-arrays', () => {
      expect(isArray([])).toBe(true)
      expect(isArray([1, 2, 3])).toBe(true)
      expect(isArray({})).toBe(false)
      expect(isArray('string')).toBe(false)
    })

    it('isString distinguishes strings from non-strings', () => {
      expect(isString('')).toBe(true)
      expect(isString('hello')).toBe(true)
      expect(isString(123)).toBe(false)
      expect(isString(null)).toBe(false)
    })

    it('isNumeric identifies valid numbers and numeric strings', () => {
      // Valid numeric values
      expect(isNumeric(0)).toBe(true)
      expect(isNumeric(123)).toBe(true)
      expect(isNumeric(-45.6)).toBe(true)
      expect(isNumeric('123')).toBe(true)
      expect(isNumeric('-45.6')).toBe(true)
      // Invalid numeric values
      expect(isNumeric('')).toBe(false)
      expect(isNumeric('abc')).toBe(false)
      expect(isNumeric(NaN)).toBe(false)
      expect(isNumeric(null)).toBe(false)
    })
  })

  describe('safe converters', () => {
    it('safeString converts values to strings with fallback', () => {
      // Direct string pass-through
      expect(safeString('hello')).toBe('hello')
      // Converts numbers and booleans
      expect(safeString(123)).toBe('123')
      expect(safeString(true)).toBe('true')
      // Returns default for null/undefined/objects
      expect(safeString(null)).toBe('')
      expect(safeString(undefined)).toBe('')
      expect(safeString(null, 'default')).toBe('default')
      expect(safeString({})).toBe('')
    })

    it('safeNumber converts values to numbers with fallback', () => {
      // Direct number pass-through
      expect(safeNumber(123)).toBe(123)
      expect(safeNumber(0)).toBe(0)
      // Converts numeric strings
      expect(safeNumber('123')).toBe(123)
      expect(safeNumber('-45.6')).toBe(-45.6)
      // Returns default for invalid input
      expect(safeNumber('')).toBe(0)
      expect(safeNumber('abc')).toBe(0)
      expect(safeNumber(null)).toBe(0)
      expect(safeNumber('abc', -1)).toBe(-1)
    })
  })
})

describe('message validators', () => {
  describe('validateTopMessage', () => {
    it('validates valid top message with list', () => {
      const message = {
        msg: 'top',
        data: { RaceName: 'Test Race', list: [] },
      }
      expect(validateTopMessage(message)).toEqual({ valid: true })
    })

    it('validates top message without list', () => {
      const message = {
        msg: 'top',
        data: { RaceName: 'Test' },
      }
      expect(validateTopMessage(message)).toEqual({ valid: true })
    })

    it('rejects invalid top messages', () => {
      expect(validateTopMessage('string')).toEqual({
        valid: false,
        error: 'Message must be an object',
      })
      expect(validateTopMessage({ msg: 'top', data: 'not object' })).toEqual({
        valid: false,
        error: 'Message data must be an object',
      })
      expect(validateTopMessage({ msg: 'top', data: { list: 'not array' } })).toEqual({
        valid: false,
        error: 'list must be an array',
      })
    })
  })

  describe('validateCompMessage', () => {
    it('validates and rejects comp messages correctly', () => {
      expect(validateCompMessage({ msg: 'comp', data: { Bib: '123' } })).toEqual({ valid: true })
      expect(validateCompMessage(null)).toEqual({
        valid: false,
        error: 'Message must be an object',
      })
      expect(validateCompMessage({ msg: 'comp', data: [] })).toEqual({
        valid: false,
        error: 'Message data must be an object',
      })
    })
  })

  describe('validateOnCourseMessage', () => {
    it('validates and rejects oncourse messages correctly', () => {
      expect(validateOnCourseMessage({ msg: 'oncourse', data: [{ Bib: '123' }] })).toEqual({
        valid: true,
      })
      expect(validateOnCourseMessage({ msg: 'oncourse', data: { Bib: '123' } })).toEqual({
        valid: false,
        error: 'Message data must be an array',
      })
    })
  })

  describe('validateControlMessage', () => {
    it('validates and rejects control messages correctly', () => {
      expect(
        validateControlMessage({
          msg: 'control',
          data: { displayTop: '1', displayCurrent: '0' },
        })
      ).toEqual({ valid: true })
      expect(validateControlMessage({ msg: 'control', data: 'invalid' })).toEqual({
        valid: false,
        error: 'Message data must be an object',
      })
    })
  })

  describe('validateTextMessage', () => {
    it('validates text-based messages', () => {
      expect(validateTextMessage({ msg: 'title', data: { text: 'Test' } }, 'title')).toEqual({
        valid: true,
      })
      expect(validateTextMessage({ msg: 'infotext', data: { text: 'Info' } }, 'infotext')).toEqual({
        valid: true,
      })
      expect(validateTextMessage({ msg: 'daytime', data: { time: '12:34:56' } }, 'daytime')).toEqual(
        { valid: true }
      )
    })

    it('rejects wrong message type', () => {
      expect(validateTextMessage({ msg: 'title', data: { text: 'Test' } }, 'infotext')).toEqual({
        valid: false,
        error: 'Invalid message type: title',
      })
    })
  })

  describe('validateResultRow', () => {
    it('validates and rejects result rows correctly', () => {
      expect(validateResultRow({ Bib: '123', Name: 'Test', Rank: 1 })).toEqual({ valid: true })
      expect(validateResultRow({ Name: 'Test', Rank: 1 })).toEqual({
        valid: false,
        error: 'Result row must have a Bib',
      })
      expect(validateResultRow({ Bib: '', Name: 'Test' })).toEqual({
        valid: false,
        error: 'Result row must have a Bib',
      })
      expect(validateResultRow('string')).toEqual({
        valid: false,
        error: 'Result row must be an object',
      })
    })
  })

  describe('validateCompetitorData', () => {
    it('validates and rejects competitor data correctly', () => {
      expect(validateCompetitorData({ Bib: '123', Name: 'Test' })).toEqual({ valid: true })
      expect(validateCompetitorData({})).toEqual({ valid: true }) // Empty is valid (no one on course)
      expect(validateCompetitorData('string')).toEqual({
        valid: false,
        error: 'Competitor data must be an object',
      })
    })
  })
})
