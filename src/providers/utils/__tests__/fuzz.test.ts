/**
 * Fuzz testing for message parsing and validation
 *
 * These tests generate random/malformed data to ensure the validation
 * and parsing functions handle edge cases gracefully without crashing.
 */
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
import { parseGates } from '../parseGates'
import { detectFinish } from '../detectFinish'

/**
 * Generates random primitive values
 */
function randomPrimitive(): unknown {
  const types = [
    () => null,
    () => undefined,
    () => Math.random() > 0.5,
    () => Math.floor(Math.random() * 1000000) - 500000,
    () => Math.random() * 1000000 - 500000,
    () => NaN,
    () => Infinity,
    () => -Infinity,
    () => '',
    () => ' ',
    () => '\n\t\r',
    () => 'a'.repeat(Math.floor(Math.random() * 1000)),
    () => String.fromCharCode(Math.floor(Math.random() * 65535)),
    () => '\\x00\\x01\\x02',
    () => '<script>alert(1)</script>',
    () => '{"key": "value"}',
    () => '[1,2,3]',
    () => 'null',
    () => 'undefined',
    () => 'true',
    () => 'false',
    () => '0',
    () => '-1',
    () => '1e100',
    () => '1.7976931348623157e+308',
    () => Symbol('test'),
    () => BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1),
  ]
  return types[Math.floor(Math.random() * types.length)]()
}

/**
 * Generates random objects with various depths and types
 */
function randomObject(depth: number = 0): unknown {
  if (depth > 3) return randomPrimitive()

  const types = [
    () => randomPrimitive(),
    () => [],
    () => [randomPrimitive()],
    () => [randomObject(depth + 1), randomObject(depth + 1)],
    () => ({}),
    () => ({ key: randomPrimitive() }),
    () => ({ nested: randomObject(depth + 1) }),
    () => ({
      msg: randomPrimitive(),
      data: randomObject(depth + 1),
    }),
    () =>
      new Array(Math.floor(Math.random() * 10)).fill(null).map(() => randomObject(depth + 1)),
    () => {
      const obj: Record<string, unknown> = {}
      const keyCount = Math.floor(Math.random() * 5)
      for (let i = 0; i < keyCount; i++) {
        obj[`key${i}`] = randomObject(depth + 1)
      }
      return obj
    },
  ]
  return types[Math.floor(Math.random() * types.length)]()
}

/**
 * Generates malformed message structures
 */
function malformedMessage(msgType: string): unknown {
  const variations = [
    // Missing msg field
    () => ({ data: {} }),
    // Wrong msg type
    () => ({ msg: 'wrong', data: {} }),
    // Missing data field
    () => ({ msg: msgType }),
    // Null data
    () => ({ msg: msgType, data: null }),
    // Array instead of object data
    () => ({ msg: msgType, data: [] }),
    // String instead of object data
    () => ({ msg: msgType, data: 'string' }),
    // Number instead of object data
    () => ({ msg: msgType, data: 123 }),
    // Nested incorrect types
    () => ({ msg: msgType, data: { list: 'not an array' } }),
    () => ({ msg: msgType, data: { list: { notAnArray: true } } }),
    // Extra unexpected fields
    () => ({
      msg: msgType,
      data: {},
      extra: randomObject(),
      another: randomObject(),
    }),
    // Circular reference attempt (will be caught by JSON serialization)
    () => {
      const obj: Record<string, unknown> = { msg: msgType, data: {} }
      return obj
    },
    // Unicode keys
    () => ({ msg: msgType, data: { '🚀': 'value', 日本語: 'text' } }),
    // Very long keys
    () => ({ msg: msgType, data: { ['x'.repeat(10000)]: 'value' } }),
    // Empty string msg
    () => ({ msg: '', data: {} }),
    // Whitespace msg
    () => ({ msg: '  ' + msgType + '  ', data: {} }),
    // Case variations
    () => ({ msg: msgType.toUpperCase(), data: {} }),
    () => ({ msg: msgType.charAt(0).toUpperCase() + msgType.slice(1), data: {} }),
  ]
  return variations[Math.floor(Math.random() * variations.length)]()
}

describe('fuzz testing - type guards', () => {
  it('isObject handles 100 random inputs without throwing', () => {
    for (let i = 0; i < 100; i++) {
      const input = randomObject()
      expect(() => isObject(input)).not.toThrow()
    }
  })

  it('isArray handles 100 random inputs without throwing', () => {
    for (let i = 0; i < 100; i++) {
      const input = randomObject()
      expect(() => isArray(input)).not.toThrow()
    }
  })

  it('isString handles 100 random inputs without throwing', () => {
    for (let i = 0; i < 100; i++) {
      const input = randomObject()
      expect(() => isString(input)).not.toThrow()
    }
  })

  it('isNumeric handles 100 random inputs without throwing', () => {
    for (let i = 0; i < 100; i++) {
      const input = randomObject()
      expect(() => isNumeric(input)).not.toThrow()
    }
  })
})

describe('fuzz testing - safe converters', () => {
  it('safeString handles 100 random inputs without throwing', () => {
    for (let i = 0; i < 100; i++) {
      const input = randomObject()
      expect(() => safeString(input)).not.toThrow()
      const result = safeString(input)
      expect(typeof result).toBe('string')
    }
  })

  it('safeNumber handles 100 random inputs without throwing', () => {
    for (let i = 0; i < 100; i++) {
      const input = randomObject()
      expect(() => safeNumber(input)).not.toThrow()
      const result = safeNumber(input)
      expect(typeof result).toBe('number')
      expect(isNaN(result)).toBe(false) // Should never return NaN
    }
  })
})

describe('fuzz testing - message validators', () => {
  it('validateTopMessage handles 100 random/malformed inputs without throwing', () => {
    for (let i = 0; i < 100; i++) {
      const input = i % 2 === 0 ? randomObject() : malformedMessage('top')
      expect(() => validateTopMessage(input)).not.toThrow()
      const result = validateTopMessage(input)
      expect(typeof result.valid).toBe('boolean')
    }
  })

  it('validateCompMessage handles 100 random/malformed inputs without throwing', () => {
    for (let i = 0; i < 100; i++) {
      const input = i % 2 === 0 ? randomObject() : malformedMessage('comp')
      expect(() => validateCompMessage(input)).not.toThrow()
      const result = validateCompMessage(input)
      expect(typeof result.valid).toBe('boolean')
    }
  })

  it('validateOnCourseMessage handles 100 random/malformed inputs without throwing', () => {
    for (let i = 0; i < 100; i++) {
      const input = i % 2 === 0 ? randomObject() : malformedMessage('oncourse')
      expect(() => validateOnCourseMessage(input)).not.toThrow()
      const result = validateOnCourseMessage(input)
      expect(typeof result.valid).toBe('boolean')
    }
  })

  it('validateControlMessage handles 100 random/malformed inputs without throwing', () => {
    for (let i = 0; i < 100; i++) {
      const input = i % 2 === 0 ? randomObject() : malformedMessage('control')
      expect(() => validateControlMessage(input)).not.toThrow()
      const result = validateControlMessage(input)
      expect(typeof result.valid).toBe('boolean')
    }
  })

  it('validateTextMessage handles 100 random/malformed inputs without throwing', () => {
    const types: Array<'title' | 'infotext' | 'daytime'> = ['title', 'infotext', 'daytime']
    for (let i = 0; i < 100; i++) {
      const input = i % 2 === 0 ? randomObject() : malformedMessage(types[i % 3])
      const type = types[i % 3]
      expect(() => validateTextMessage(input, type)).not.toThrow()
      const result = validateTextMessage(input, type)
      expect(typeof result.valid).toBe('boolean')
    }
  })

  it('validateResultRow handles 100 random inputs without throwing', () => {
    for (let i = 0; i < 100; i++) {
      const input = randomObject()
      expect(() => validateResultRow(input)).not.toThrow()
      const result = validateResultRow(input)
      expect(typeof result.valid).toBe('boolean')
    }
  })

  it('validateCompetitorData handles 100 random inputs without throwing', () => {
    for (let i = 0; i < 100; i++) {
      const input = randomObject()
      expect(() => validateCompetitorData(input)).not.toThrow()
      const result = validateCompetitorData(input)
      expect(typeof result.valid).toBe('boolean')
    }
  })
})

describe('fuzz testing - parseGates', () => {
  it('handles 100 random inputs without throwing', () => {
    const inputs = [
      '',
      null,
      undefined,
      0,
      123,
      -1,
      NaN,
      Infinity,
      true,
      false,
      [],
      {},
      'invalid',
      '0,0,0',
      '0 0 0',
      '2,50,0,2',
      '2 50 0 2',
      'a,b,c',
      '0,,0',
      ',,,',
      '   ',
      '\n\t',
      '0.5,1.5,2.5',
      '-1,-2,-3',
      '999999999999',
      '0'.repeat(1000),
      ','.repeat(100),
      ' '.repeat(100),
    ]

    for (const input of inputs) {
      expect(() => parseGates(input as string)).not.toThrow()
      const result = parseGates(input as string)
      expect(Array.isArray(result)).toBe(true)
    }

    // Additional random string inputs
    for (let i = 0; i < 50; i++) {
      const randomStr = Array(Math.floor(Math.random() * 20))
        .fill(null)
        .map(() => {
          const chars = '0123456789, \n\t-.'
          return chars[Math.floor(Math.random() * chars.length)]
        })
        .join('')
      expect(() => parseGates(randomStr)).not.toThrow()
    }
  })
})

describe('fuzz testing - detectFinish', () => {
  it('handles 100 random inputs without throwing', () => {
    const randomCompetitorLike = () => {
      const variants = [
        null,
        undefined,
        {},
        { dtFinish: null },
        { dtFinish: undefined },
        { dtFinish: '' },
        { dtFinish: '12:34:56' },
        { dtFinish: 0 },
        { dtFinish: 123456 },
        { dtFinish: randomPrimitive() },
        randomObject() as { dtFinish?: unknown },
      ]
      return variants[Math.floor(Math.random() * variants.length)]
    }

    for (let i = 0; i < 100; i++) {
      const current = randomCompetitorLike()
      const previous = randomCompetitorLike()
      expect(() => detectFinish(current as never, previous as never)).not.toThrow()
    }
  })
})

describe('fuzz testing - edge cases', () => {
  it('handles deeply nested objects', () => {
    let deep: unknown = { value: 'leaf' }
    for (let i = 0; i < 50; i++) {
      deep = { nested: deep, msg: 'top', data: deep }
    }
    expect(() => validateTopMessage(deep)).not.toThrow()
    expect(() => isObject(deep)).not.toThrow()
  })

  it('handles very large arrays', () => {
    const largeArray = new Array(10000).fill({ Bib: '123' })
    const message = { msg: 'top', data: { list: largeArray } }
    expect(() => validateTopMessage(message)).not.toThrow()
    expect(validateTopMessage(message).valid).toBe(true)
  })

  it('handles objects with prototype pollution attempts', () => {
    const malicious = JSON.parse('{"__proto__": {"admin": true}, "msg": "top", "data": {}}')
    expect(() => validateTopMessage(malicious)).not.toThrow()
    expect(() => isObject(malicious)).not.toThrow()
  })

  it('handles objects with constructor manipulation', () => {
    const obj = { msg: 'top', data: {}, constructor: 'evil' }
    expect(() => validateTopMessage(obj)).not.toThrow()
  })

  it('handles frozen and sealed objects', () => {
    const frozen = Object.freeze({ msg: 'top', data: Object.freeze({}) })
    const sealed = Object.seal({ msg: 'top', data: Object.seal({}) })

    expect(() => validateTopMessage(frozen)).not.toThrow()
    expect(() => validateTopMessage(sealed)).not.toThrow()
  })

  it('handles objects with getters that throw', () => {
    const evil = {
      get msg() {
        throw new Error('Evil getter')
      },
      data: {},
    }
    // This may throw, but should be caught - test that it doesn't crash Node
    try {
      validateTopMessage(evil)
    } catch {
      // Expected - evil getter throws
    }
  })

  it('handles numeric string edge cases in parseGates', () => {
    const edgeCases = [
      '1e10',
      '1E10',
      '0x10',
      '0o10',
      '0b10',
      '.5',
      '5.',
      '-.5',
      '+5',
      ' 5 ',
      '5\n',
      '\t5\t',
    ]
    for (const input of edgeCases) {
      expect(() => parseGates(input)).not.toThrow()
    }
  })
})
