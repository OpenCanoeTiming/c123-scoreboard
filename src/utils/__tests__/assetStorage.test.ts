/**
 * Tests for assetStorage utility
 */

import {
  isValidAssetUrl,
  isDataUri,
  saveAssets,
  loadAssets,
  clearAssets,
  getAssetsFromUrlParams,
  DEFAULT_ASSETS,
} from '../assetStorage'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('assetStorage', () => {
  beforeEach(() => {
    localStorageMock.clear()
    // Reset URL
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
    })
  })

  describe('DEFAULT_ASSETS', () => {
    it('should have all required asset URLs', () => {
      expect(DEFAULT_ASSETS.logoUrl).toBe('/assets/logo.svg')
      expect(DEFAULT_ASSETS.partnerLogoUrl).toBe('/assets/partners.png')
      expect(DEFAULT_ASSETS.footerImageUrl).toBe('/assets/footer.png')
    })
  })

  describe('isValidAssetUrl', () => {
    it('should accept relative URLs starting with /', () => {
      expect(isValidAssetUrl('/assets/logo.png')).toBe(true)
      expect(isValidAssetUrl('/images/test.svg')).toBe(true)
    })

    it('should accept relative URLs without leading /', () => {
      expect(isValidAssetUrl('assets/logo.png')).toBe(true)
      expect(isValidAssetUrl('logo.png')).toBe(true)
    })

    it('should accept http URLs', () => {
      expect(isValidAssetUrl('http://example.com/logo.png')).toBe(true)
      expect(isValidAssetUrl('http://192.168.1.1/assets/logo.png')).toBe(true)
    })

    it('should accept https URLs', () => {
      expect(isValidAssetUrl('https://example.com/logo.png')).toBe(true)
      expect(isValidAssetUrl('https://cdn.example.com/images/logo.svg')).toBe(true)
    })

    it('should accept data URIs for images', () => {
      expect(isValidAssetUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
      expect(isValidAssetUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(true)
      expect(isValidAssetUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(true)
    })

    it('should reject empty strings', () => {
      expect(isValidAssetUrl('')).toBe(false)
      expect(isValidAssetUrl('   ')).toBe(false)
    })

    it('should reject null and undefined', () => {
      expect(isValidAssetUrl(null as unknown as string)).toBe(false)
      expect(isValidAssetUrl(undefined as unknown as string)).toBe(false)
    })

    it('should reject non-image data URIs', () => {
      expect(isValidAssetUrl('data:text/plain;base64,SGVsbG8=')).toBe(false)
      expect(isValidAssetUrl('data:application/json;base64,e30=')).toBe(false)
    })

    it('should reject invalid URL formats', () => {
      expect(isValidAssetUrl('javascript:alert(1)')).toBe(false)
      expect(isValidAssetUrl('ftp://example.com/logo.png')).toBe(false)
    })
  })

  describe('isDataUri', () => {
    it('should return true for data URIs', () => {
      expect(isDataUri('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
      expect(isDataUri('data:image/svg+xml;base64,PHN2Zz4=')).toBe(true)
    })

    it('should return false for regular URLs', () => {
      expect(isDataUri('/assets/logo.png')).toBe(false)
      expect(isDataUri('https://example.com/logo.png')).toBe(false)
    })

    it('should return false for invalid input', () => {
      expect(isDataUri('')).toBe(false)
      expect(isDataUri(null as unknown as string)).toBe(false)
    })
  })

  describe('saveAssets / loadAssets', () => {
    it('should save and load assets correctly', () => {
      const assets = {
        logoUrl: '/custom/logo.png',
        partnerLogoUrl: 'https://example.com/partner.png',
        footerImageUrl: '/custom/footer.png',
      }

      saveAssets(assets)
      const loaded = loadAssets()

      expect(loaded).toEqual(assets)
    })

    it('should only save valid asset URLs', () => {
      const assets = {
        logoUrl: '/valid/logo.png',
        partnerLogoUrl: 'javascript:alert(1)', // Invalid
        footerImageUrl: '', // Invalid
      }

      saveAssets(assets)
      const loaded = loadAssets()

      expect(loaded).toEqual({ logoUrl: '/valid/logo.png' })
    })

    it('should return null when no assets stored', () => {
      const loaded = loadAssets()
      expect(loaded).toBeNull()
    })

    it('should handle data URIs', () => {
      const assets = {
        logoUrl: 'data:image/png;base64,iVBORw0KGgo=',
      }

      saveAssets(assets)
      const loaded = loadAssets()

      expect(loaded?.logoUrl).toBe('data:image/png;base64,iVBORw0KGgo=')
    })
  })

  describe('clearAssets', () => {
    it('should clear stored assets', () => {
      saveAssets({ logoUrl: '/logo.png' })
      expect(loadAssets()).not.toBeNull()

      clearAssets()
      expect(loadAssets()).toBeNull()
    })
  })

  describe('getAssetsFromUrlParams', () => {
    it('should parse logoUrl from URL params', () => {
      Object.defineProperty(window, 'location', {
        value: { search: '?logoUrl=/custom/logo.png' },
        writable: true,
      })

      const assets = getAssetsFromUrlParams()
      expect(assets.logoUrl).toBe('/custom/logo.png')
    })

    it('should parse all asset URLs from URL params', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?logoUrl=/logo.png&partnerLogoUrl=/partner.png&footerImageUrl=/footer.png',
        },
        writable: true,
      })

      const assets = getAssetsFromUrlParams()
      expect(assets.logoUrl).toBe('/logo.png')
      expect(assets.partnerLogoUrl).toBe('/partner.png')
      expect(assets.footerImageUrl).toBe('/footer.png')
    })

    it('should reject data URIs from URL params', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      Object.defineProperty(window, 'location', {
        value: { search: '?logoUrl=data:image/png;base64,iVBORw0KGgo=' },
        writable: true,
      })

      const assets = getAssetsFromUrlParams()
      expect(assets.logoUrl).toBeUndefined()
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Data URI not allowed in URL params')
      )

      consoleWarnSpy.mockRestore()
    })

    it('should accept absolute URLs in URL params', () => {
      Object.defineProperty(window, 'location', {
        value: { search: '?logoUrl=https://example.com/logo.png' },
        writable: true,
      })

      const assets = getAssetsFromUrlParams()
      expect(assets.logoUrl).toBe('https://example.com/logo.png')
    })

    it('should return empty object for no params', () => {
      Object.defineProperty(window, 'location', {
        value: { search: '' },
        writable: true,
      })

      const assets = getAssetsFromUrlParams()
      expect(assets).toEqual({})
    })
  })
})
