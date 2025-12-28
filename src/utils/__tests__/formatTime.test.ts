import { describe, it, expect } from 'vitest'
import { formatTime, formatBehind, formatTTBDiff } from '../formatTime'

describe('formatTime', () => {
  describe('handles empty/null values', () => {
    it('returns empty string for null', () => {
      expect(formatTime(null)).toBe('')
    })

    it('returns empty string for undefined', () => {
      expect(formatTime(undefined)).toBe('')
    })

    it('returns empty string for empty string', () => {
      expect(formatTime('')).toBe('')
    })

    it('returns empty string for whitespace', () => {
      expect(formatTime('   ')).toBe('')
    })
  })

  describe('formats seconds under 1 minute', () => {
    it('formats "78.99" as "78.99"', () => {
      // Still under 1 minute (78.99 seconds)
      // Wait, 78.99 is 1 minute 18.99 seconds
      expect(formatTime('78.99')).toBe('1:18.99')
    })

    it('formats "23.45" as "23.45"', () => {
      expect(formatTime('23.45')).toBe('23.45')
    })

    it('formats "5.34" as "5.34"', () => {
      expect(formatTime('5.34')).toBe('5.34')
    })

    it('formats "0.50" as "0.50"', () => {
      expect(formatTime('0.50')).toBe('0.50')
    })
  })

  describe('formats seconds over 1 minute', () => {
    it('formats "147.91" as "2:27.91"', () => {
      expect(formatTime('147.91')).toBe('2:27.91')
    })

    it('formats "60.00" as "1:00.00"', () => {
      expect(formatTime('60.00')).toBe('1:00.00')
    })

    it('formats "63.45" as "1:03.45"', () => {
      expect(formatTime('63.45')).toBe('1:03.45')
    })

    it('formats "353.91" as "5:53.91"', () => {
      expect(formatTime('353.91')).toBe('5:53.91')
    })
  })

  describe('handles numeric input', () => {
    it('formats number 78.99 as "1:18.99"', () => {
      expect(formatTime(78.99)).toBe('1:18.99')
    })

    it('formats number 23.45 as "23.45"', () => {
      expect(formatTime(23.45)).toBe('23.45')
    })
  })

  describe('preserves already formatted values', () => {
    it('returns "1:23.45" unchanged', () => {
      expect(formatTime('1:23.45')).toBe('1:23.45')
    })

    it('returns "2:27.91" unchanged', () => {
      expect(formatTime('2:27.91')).toBe('2:27.91')
    })
  })

  describe('handles edge cases', () => {
    it('returns invalid string unchanged', () => {
      expect(formatTime('DNS')).toBe('DNS')
    })

    it('returns "DNF" unchanged', () => {
      expect(formatTime('DNF')).toBe('DNF')
    })
  })
})

describe('formatBehind', () => {
  describe('handles empty values', () => {
    it('returns empty for null', () => {
      expect(formatBehind(null)).toBe('')
    })

    it('returns empty for undefined', () => {
      expect(formatBehind(undefined)).toBe('')
    })

    it('returns empty for empty string', () => {
      expect(formatBehind('')).toBe('')
    })

    it('returns empty for &nbsp; (first place)', () => {
      expect(formatBehind('&nbsp;')).toBe('')
    })
  })

  describe('formats positive differences', () => {
    it('formats "+5.34" as "+5.34"', () => {
      expect(formatBehind('+5.34')).toBe('+5.34')
    })

    it('formats "+272.19" as "+4:32.19"', () => {
      expect(formatBehind('+272.19')).toBe('+4:32.19')
    })

    it('formats "+63.45" as "+1:03.45"', () => {
      expect(formatBehind('+63.45')).toBe('+1:03.45')
    })
  })

  describe('preserves already formatted values', () => {
    it('returns "+1:23.45" unchanged', () => {
      expect(formatBehind('+1:23.45')).toBe('+1:23.45')
    })
  })
})

describe('formatTTBDiff', () => {
  describe('handles empty values', () => {
    it('returns empty for null', () => {
      expect(formatTTBDiff(null)).toBe('')
    })

    it('returns empty for empty string', () => {
      expect(formatTTBDiff('')).toBe('')
    })
  })

  describe('formats positive differences (slower)', () => {
    it('formats "+1.23" as "+1.23"', () => {
      expect(formatTTBDiff('+1.23')).toBe('+1.23')
    })

    it('formats "+65.00" as "+1:05.00"', () => {
      expect(formatTTBDiff('+65.00')).toBe('+1:05.00')
    })
  })

  describe('formats negative differences (faster)', () => {
    it('formats "-0.45" as "-0.45"', () => {
      expect(formatTTBDiff('-0.45')).toBe('-0.45')
    })

    it('formats "-3.21" as "-3.21"', () => {
      expect(formatTTBDiff('-3.21')).toBe('-3.21')
    })

    it('formats "-65.00" as "-1:05.00"', () => {
      expect(formatTTBDiff('-65.00')).toBe('-1:05.00')
    })
  })

  describe('handles values without sign', () => {
    it('formats "1.23" as "+1.23"', () => {
      expect(formatTTBDiff('1.23')).toBe('+1.23')
    })
  })
})
