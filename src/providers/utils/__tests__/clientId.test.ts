import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getClientIdFromUrl,
  getStoredClientId,
  saveClientId,
  clearClientId,
  CLIENT_ID_STORAGE_KEY,
} from '../discovery-client'

// =============================================================================
// Mock Setup
// =============================================================================

// Save original location
const originalLocation = window.location

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get _store() {
      return store
    },
  }
})()

// =============================================================================
// Tests
// =============================================================================

describe('clientId functions', () => {
  beforeEach(() => {
    // Reset localStorage mock
    mockLocalStorage.clear()
    vi.stubGlobal('localStorage', mockLocalStorage)

    // Reset URL
    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        search: '',
      },
      writable: true,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    })
  })

  // ===========================================================================
  // getStoredClientId
  // ===========================================================================

  describe('getStoredClientId', () => {
    it('returns null when no clientId is stored', () => {
      expect(getStoredClientId()).toBeNull()
    })

    it('returns stored clientId', () => {
      mockLocalStorage.setItem(CLIENT_ID_STORAGE_KEY, 'my-client-id')
      expect(getStoredClientId()).toBe('my-client-id')
    })

    it('handles localStorage errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementationOnce(() => {
        throw new Error('localStorage unavailable')
      })
      expect(getStoredClientId()).toBeNull()
    })
  })

  // ===========================================================================
  // saveClientId
  // ===========================================================================

  describe('saveClientId', () => {
    it('saves clientId to localStorage', () => {
      saveClientId('new-client-id')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        CLIENT_ID_STORAGE_KEY,
        'new-client-id'
      )
    })

    it('handles localStorage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('localStorage unavailable')
      })
      // Should not throw
      expect(() => saveClientId('test')).not.toThrow()
    })
  })

  // ===========================================================================
  // clearClientId
  // ===========================================================================

  describe('clearClientId', () => {
    it('removes clientId from localStorage', () => {
      mockLocalStorage.setItem(CLIENT_ID_STORAGE_KEY, 'to-be-cleared')
      clearClientId()
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(CLIENT_ID_STORAGE_KEY)
    })

    it('handles localStorage errors gracefully', () => {
      mockLocalStorage.removeItem.mockImplementationOnce(() => {
        throw new Error('localStorage unavailable')
      })
      // Should not throw
      expect(() => clearClientId()).not.toThrow()
    })
  })

  // ===========================================================================
  // getClientIdFromUrl - with fallback to localStorage
  // ===========================================================================

  describe('getClientIdFromUrl', () => {
    it('returns null when no clientId in URL or localStorage', () => {
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, search: '' },
        writable: true,
      })
      expect(getClientIdFromUrl()).toBeNull()
    })

    it('returns clientId from URL parameter', () => {
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, search: '?clientId=url-client-id' },
        writable: true,
      })
      expect(getClientIdFromUrl()).toBe('url-client-id')
    })

    it('returns clientId from localStorage when not in URL', () => {
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, search: '' },
        writable: true,
      })
      mockLocalStorage.setItem(CLIENT_ID_STORAGE_KEY, 'stored-client-id')
      expect(getClientIdFromUrl()).toBe('stored-client-id')
    })

    it('URL parameter takes priority over localStorage', () => {
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, search: '?clientId=url-priority' },
        writable: true,
      })
      mockLocalStorage.setItem(CLIENT_ID_STORAGE_KEY, 'stored-fallback')
      expect(getClientIdFromUrl()).toBe('url-priority')
    })

    it('returns clientId with other URL parameters present', () => {
      Object.defineProperty(window, 'location', {
        value: {
          ...originalLocation,
          search: '?server=192.168.1.50&clientId=my-id&type=ledwall',
        },
        writable: true,
      })
      expect(getClientIdFromUrl()).toBe('my-id')
    })

    it('handles URL-encoded clientId', () => {
      Object.defineProperty(window, 'location', {
        value: {
          ...originalLocation,
          search: '?clientId=my%20client%20id',
        },
        writable: true,
      })
      expect(getClientIdFromUrl()).toBe('my client id')
    })

    it('handles empty clientId in URL (falls back to localStorage)', () => {
      Object.defineProperty(window, 'location', {
        value: {
          ...originalLocation,
          search: '?clientId=',
        },
        writable: true,
      })
      mockLocalStorage.setItem(CLIENT_ID_STORAGE_KEY, 'stored-fallback')
      // Empty string from URL is falsy, should fall back to localStorage
      expect(getClientIdFromUrl()).toBe('stored-fallback')
    })
  })

  // ===========================================================================
  // Integration: Full clientId persistence flow
  // ===========================================================================

  describe('clientId persistence flow', () => {
    it('new clientId can be saved and retrieved', () => {
      // Initially no clientId
      expect(getStoredClientId()).toBeNull()

      // Server assigns clientId
      saveClientId('server-assigned-id')

      // Now it's available
      expect(getStoredClientId()).toBe('server-assigned-id')

      // And getClientIdFromUrl returns it
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, search: '' },
        writable: true,
      })
      expect(getClientIdFromUrl()).toBe('server-assigned-id')
    })

    it('clearClientId resets to IP-based identification', () => {
      saveClientId('to-be-cleared')
      expect(getStoredClientId()).toBe('to-be-cleared')

      clearClientId()

      expect(getStoredClientId()).toBeNull()
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, search: '' },
        writable: true,
      })
      expect(getClientIdFromUrl()).toBeNull()
    })

    it('URL clientId always overrides stored value', () => {
      // Store a clientId
      saveClientId('stored-id')

      // Access with URL override
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, search: '?clientId=override-id' },
        writable: true,
      })

      // URL wins
      expect(getClientIdFromUrl()).toBe('override-id')

      // But stored value is still there
      expect(getStoredClientId()).toBe('stored-id')
    })
  })
})
