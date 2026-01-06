/**
 * Tests for useDisplayConfig hook
 */
import { renderHook } from '@testing-library/react'
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { useDisplayConfig, matchesRaceFilter } from '../useDisplayConfig'

describe('useDisplayConfig', () => {
  // Store original location
  const originalLocation = window.location

  beforeEach(() => {
    // Mock window.location with configurable search params
    delete (window as { location?: Location }).location
    window.location = {
      ...originalLocation,
      search: '',
    } as Location
  })

  afterEach(() => {
    // Restore original location
    window.location = originalLocation
    vi.restoreAllMocks()
  })

  describe('default values', () => {
    test('returns default values when no URL params', () => {
      window.location.search = ''
      const { result } = renderHook(() => useDisplayConfig())

      expect(result.current.showOnCourse).toBe(true)
      expect(result.current.showResults).toBe(true)
      expect(result.current.raceFilter).toEqual([])
    })
  })

  describe('showOnCourse parameter', () => {
    test('returns true by default', () => {
      window.location.search = ''
      const { result } = renderHook(() => useDisplayConfig())
      expect(result.current.showOnCourse).toBe(true)
    })

    test('returns true when showOnCourse=true', () => {
      window.location.search = '?showOnCourse=true'
      const { result } = renderHook(() => useDisplayConfig())
      expect(result.current.showOnCourse).toBe(true)
    })

    test('returns false when showOnCourse=false', () => {
      window.location.search = '?showOnCourse=false'
      const { result } = renderHook(() => useDisplayConfig())
      expect(result.current.showOnCourse).toBe(false)
    })

    test('returns true for any other value', () => {
      window.location.search = '?showOnCourse=invalid'
      const { result } = renderHook(() => useDisplayConfig())
      expect(result.current.showOnCourse).toBe(true)
    })
  })

  describe('showResults parameter', () => {
    test('returns true by default', () => {
      window.location.search = ''
      const { result } = renderHook(() => useDisplayConfig())
      expect(result.current.showResults).toBe(true)
    })

    test('returns true when showResults=true', () => {
      window.location.search = '?showResults=true'
      const { result } = renderHook(() => useDisplayConfig())
      expect(result.current.showResults).toBe(true)
    })

    test('returns false when showResults=false', () => {
      window.location.search = '?showResults=false'
      const { result } = renderHook(() => useDisplayConfig())
      expect(result.current.showResults).toBe(false)
    })

    test('returns true for any other value', () => {
      window.location.search = '?showResults=0'
      const { result } = renderHook(() => useDisplayConfig())
      expect(result.current.showResults).toBe(true)
    })
  })

  describe('raceFilter parameter', () => {
    test('returns empty array by default', () => {
      window.location.search = ''
      const { result } = renderHook(() => useDisplayConfig())
      expect(result.current.raceFilter).toEqual([])
    })

    test('parses single race ID', () => {
      window.location.search = '?raceFilter=K1M_ST'
      const { result } = renderHook(() => useDisplayConfig())
      expect(result.current.raceFilter).toEqual(['K1M_ST'])
    })

    test('parses multiple race IDs', () => {
      window.location.search = '?raceFilter=K1M_ST,K1W_ST,C1M_ST'
      const { result } = renderHook(() => useDisplayConfig())
      expect(result.current.raceFilter).toEqual(['K1M_ST', 'K1W_ST', 'C1M_ST'])
    })

    test('trims whitespace from race IDs', () => {
      window.location.search = '?raceFilter=K1M_ST%20,%20K1W_ST'
      const { result } = renderHook(() => useDisplayConfig())
      expect(result.current.raceFilter).toEqual(['K1M_ST', 'K1W_ST'])
    })

    test('filters empty entries', () => {
      window.location.search = '?raceFilter=K1M_ST,,K1W_ST,'
      const { result } = renderHook(() => useDisplayConfig())
      expect(result.current.raceFilter).toEqual(['K1M_ST', 'K1W_ST'])
    })

    test('returns empty array for empty value', () => {
      window.location.search = '?raceFilter='
      const { result } = renderHook(() => useDisplayConfig())
      expect(result.current.raceFilter).toEqual([])
    })
  })

  describe('combined parameters', () => {
    test('parses all parameters together', () => {
      window.location.search = '?showOnCourse=false&showResults=true&raceFilter=K1M_ST,K1W_ST'
      const { result } = renderHook(() => useDisplayConfig())

      expect(result.current.showOnCourse).toBe(false)
      expect(result.current.showResults).toBe(true)
      expect(result.current.raceFilter).toEqual(['K1M_ST', 'K1W_ST'])
    })

    test('works with other URL params', () => {
      window.location.search = '?server=localhost:27123&showOnCourse=false&type=ledwall'
      const { result } = renderHook(() => useDisplayConfig())

      expect(result.current.showOnCourse).toBe(false)
      expect(result.current.showResults).toBe(true)
      expect(result.current.raceFilter).toEqual([])
    })
  })
})

describe('matchesRaceFilter', () => {
  describe('empty filter', () => {
    test('returns true for any raceId when filter is empty', () => {
      expect(matchesRaceFilter('K1M_ST_BR2_6', [])).toBe(true)
      expect(matchesRaceFilter('', [])).toBe(true)
      expect(matchesRaceFilter('anything', [])).toBe(true)
    })
  })

  describe('single filter', () => {
    test('matches exact race class prefix', () => {
      expect(matchesRaceFilter('K1M_ST_BR2_6', ['K1M_ST'])).toBe(true)
      expect(matchesRaceFilter('K1M_ST_BR1_5', ['K1M_ST'])).toBe(true)
    })

    test('does not match different class', () => {
      expect(matchesRaceFilter('K1W_ST_BR2_6', ['K1M_ST'])).toBe(false)
      expect(matchesRaceFilter('C1M_ST_BR1_5', ['K1M_ST'])).toBe(false)
    })

    test('matches full raceId if filter is exact match', () => {
      expect(matchesRaceFilter('K1M_ST_BR2_6', ['K1M_ST_BR2_6'])).toBe(true)
    })

    test('does not match partial prefix', () => {
      expect(matchesRaceFilter('K1M_ST', ['K1M_ST_BR2'])).toBe(false)
    })
  })

  describe('multiple filters', () => {
    test('matches any of the filters', () => {
      const filter = ['K1M_ST', 'K1W_ST', 'C1M_ST']

      expect(matchesRaceFilter('K1M_ST_BR2_6', filter)).toBe(true)
      expect(matchesRaceFilter('K1W_ST_BR1_5', filter)).toBe(true)
      expect(matchesRaceFilter('C1M_ST_BR2_7', filter)).toBe(true)
    })

    test('does not match if no filter matches', () => {
      const filter = ['K1M_ST', 'K1W_ST']

      expect(matchesRaceFilter('C1M_ST_BR2_6', filter)).toBe(false)
      expect(matchesRaceFilter('C2M_ST_BR1_5', filter)).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('handles empty raceId', () => {
      expect(matchesRaceFilter('', ['K1M_ST'])).toBe(false)
    })

    test('handles empty strings in filter', () => {
      // This shouldn't happen in practice due to filtering in useDisplayConfig
      expect(matchesRaceFilter('K1M_ST_BR2_6', ['', 'K1M_ST'])).toBe(true)
      expect(matchesRaceFilter('K1M_ST_BR2_6', [''])).toBe(true) // '' prefix matches any string
    })
  })
})
