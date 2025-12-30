import { describe, it, expect } from 'vitest'
import { parseGates, calculateTotalPenalty, getPenaltyGates } from '../parseGates'

describe('parseGates', () => {
  it('should parse comma-separated gates', () => {
    expect(parseGates('0,0,2,0,50,0')).toEqual([0, 0, 2, 0, 50, 0])
  })

  it('should parse space-separated gates', () => {
    expect(parseGates('0 0 2 0 50 0')).toEqual([0, 0, 2, 0, 50, 0])
  })

  it('should parse mixed separators', () => {
    expect(parseGates('0,0 2,0 50,0')).toEqual([0, 0, 2, 0, 50, 0])
  })

  it('should return empty array for empty string', () => {
    expect(parseGates('')).toEqual([])
  })

  it('should return empty array for null', () => {
    expect(parseGates(null)).toEqual([])
  })

  it('should return empty array for undefined', () => {
    expect(parseGates(undefined)).toEqual([])
  })

  it('should return empty array for whitespace only', () => {
    expect(parseGates('   ')).toEqual([])
  })

  it('should handle single value', () => {
    expect(parseGates('0')).toEqual([0])
    expect(parseGates('2')).toEqual([2])
    expect(parseGates('50')).toEqual([50])
  })

  it('should return null for invalid values', () => {
    expect(parseGates('0,abc,2')).toEqual([0, null, 2])
  })

  it('should return null for non-standard penalty values', () => {
    expect(parseGates('0,5,2')).toEqual([0, null, 2])
    expect(parseGates('0,100,2')).toEqual([0, null, 2])
  })

  it('should handle consecutive separators', () => {
    expect(parseGates('0,,2')).toEqual([0, 2])
    expect(parseGates('0  2')).toEqual([0, 2])
  })

  it('should handle leading/trailing separators', () => {
    expect(parseGates(',0,2,')).toEqual([0, 2])
    expect(parseGates(' 0 2 ')).toEqual([0, 2])
  })
})

describe('calculateTotalPenalty', () => {
  it('should sum all penalties', () => {
    expect(calculateTotalPenalty([0, 0, 2, 0, 50, 0])).toBe(52)
  })

  it('should return 0 for empty array', () => {
    expect(calculateTotalPenalty([])).toBe(0)
  })

  it('should return 0 for all zeros', () => {
    expect(calculateTotalPenalty([0, 0, 0, 0])).toBe(0)
  })

  it('should handle null values as 0', () => {
    expect(calculateTotalPenalty([0, null, 2, null, 50])).toBe(52)
  })

  it('should handle multiple touches', () => {
    expect(calculateTotalPenalty([2, 2, 2, 2])).toBe(8)
  })

  it('should handle multiple misses', () => {
    expect(calculateTotalPenalty([50, 50])).toBe(100)
  })
})

describe('getPenaltyGates', () => {
  it('should return gates with 2s and 50s penalties', () => {
    expect(getPenaltyGates('0,0,2,0,50,0')).toEqual([
      { gateNumber: 3, penalty: 2 },
      { gateNumber: 5, penalty: 50 },
    ])
  })

  it('should return empty array for no penalties', () => {
    expect(getPenaltyGates('0,0,0,0')).toEqual([])
  })

  it('should return empty array for empty input', () => {
    expect(getPenaltyGates('')).toEqual([])
    expect(getPenaltyGates(null)).toEqual([])
    expect(getPenaltyGates(undefined)).toEqual([])
  })

  it('should handle multiple penalties of same type', () => {
    expect(getPenaltyGates('2,0,2,0,2')).toEqual([
      { gateNumber: 1, penalty: 2 },
      { gateNumber: 3, penalty: 2 },
      { gateNumber: 5, penalty: 2 },
    ])
  })

  it('should handle all 50s', () => {
    expect(getPenaltyGates('50,50')).toEqual([
      { gateNumber: 1, penalty: 50 },
      { gateNumber: 2, penalty: 50 },
    ])
  })

  it('should handle single gate with penalty', () => {
    expect(getPenaltyGates('2')).toEqual([{ gateNumber: 1, penalty: 2 }])
    expect(getPenaltyGates('50')).toEqual([{ gateNumber: 1, penalty: 50 }])
  })

  it('should handle single gate without penalty', () => {
    expect(getPenaltyGates('0')).toEqual([])
  })
})
