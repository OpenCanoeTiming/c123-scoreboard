import { describe, it, expect } from 'vitest'
import { formatName, formatClub, formatNat } from '../formatName'

describe('formatName', () => {
  describe('handles empty/null values', () => {
    it('returns empty string for null', () => {
      expect(formatName(null)).toBe('')
    })

    it('returns empty string for undefined', () => {
      expect(formatName(undefined)).toBe('')
    })

    it('returns empty string for empty string', () => {
      expect(formatName('')).toBe('')
    })

    it('returns empty string for whitespace', () => {
      expect(formatName('   ')).toBe('')
    })
  })

  describe('uses combined name field', () => {
    it('returns "KREJČÍ Jakub" unchanged', () => {
      expect(formatName('KREJČÍ Jakub')).toBe('KREJČÍ Jakub')
    })

    it('returns "NOVÁK Matyáš" unchanged', () => {
      expect(formatName('NOVÁK Matyáš')).toBe('NOVÁK Matyáš')
    })

    it('trims whitespace', () => {
      expect(formatName('  KREJČÍ Jakub  ')).toBe('KREJČÍ Jakub')
    })
  })

  describe('uses separate family/given names', () => {
    it('combines "KREJČÍ" and "Jakub"', () => {
      expect(formatName(null, 'KREJČÍ', 'Jakub')).toBe('KREJČÍ Jakub')
    })

    it('uses family name only if no given name', () => {
      expect(formatName(null, 'KREJČÍ', null)).toBe('KREJČÍ')
    })

    it('prefers separate names over combined', () => {
      expect(formatName('WRONG Name', 'KREJČÍ', 'Jakub')).toBe('KREJČÍ Jakub')
    })
  })

  describe('truncates long names', () => {
    it('truncates at word boundary if possible', () => {
      const longName = 'VELMI DLOUHÉ PŘÍJMENÍ Jméno'
      const result = formatName(longName)
      expect(result.length).toBeLessThanOrEqual(25)
    })

    it('adds ellipsis if no good word boundary', () => {
      const longName = 'VELKYDLOUHYPRIJMENIBEZMEZER'
      const result = formatName(longName)
      expect(result.endsWith('…')).toBe(true)
      expect(result.length).toBeLessThanOrEqual(25)
    })

    it('does not truncate names under 25 chars', () => {
      const name = 'KREJČÍ Jakub'
      expect(formatName(name)).toBe(name)
    })
  })
})

describe('formatClub', () => {
  describe('handles empty/null values', () => {
    it('returns empty string for null', () => {
      expect(formatClub(null)).toBe('')
    })

    it('returns empty string for undefined', () => {
      expect(formatClub(undefined)).toBe('')
    })

    it('returns empty string for empty string', () => {
      expect(formatClub('')).toBe('')
    })
  })

  describe('formats club names', () => {
    it('returns short club names unchanged', () => {
      expect(formatClub('TJ DUKLA Praha')).toBe('TJ DUKLA Praha')
    })

    it('trims whitespace', () => {
      expect(formatClub('  TJ DUKLA Praha  ')).toBe('TJ DUKLA Praha')
    })

    it('truncates long club names', () => {
      const longClub = 'SKUP Olomouc, z.s. - oddíl kanoistiky'
      const result = formatClub(longClub)
      expect(result.length).toBeLessThanOrEqual(30)
    })
  })
})

describe('formatNat', () => {
  describe('handles empty/null values', () => {
    it('returns empty string for null', () => {
      expect(formatNat(null)).toBe('')
    })

    it('returns empty string for undefined', () => {
      expect(formatNat(undefined)).toBe('')
    })

    it('returns empty string for empty string', () => {
      expect(formatNat('')).toBe('')
    })
  })

  describe('formats nationality codes', () => {
    it('returns "CZE" unchanged', () => {
      expect(formatNat('CZE')).toBe('CZE')
    })

    it('uppercases lowercase input', () => {
      expect(formatNat('cze')).toBe('CZE')
    })

    it('trims whitespace', () => {
      expect(formatNat('  AUT  ')).toBe('AUT')
    })
  })
})
