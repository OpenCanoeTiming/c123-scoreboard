/**
 * Tests for useAssets hook
 */

import { renderHook } from '@testing-library/react'
import { useAssets } from '../useAssets'
import { saveAssets, clearAssets, DEFAULT_ASSETS } from '@/utils/assetStorage'

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

describe('useAssets', () => {
  beforeEach(() => {
    localStorageMock.clear()
    // Reset URL
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
    })
  })

  it('should return default assets when nothing is configured', () => {
    const { result } = renderHook(() => useAssets())

    expect(result.current.logoUrl).toBe(DEFAULT_ASSETS.logoUrl)
    expect(result.current.partnerLogoUrl).toBe(DEFAULT_ASSETS.partnerLogoUrl)
    expect(result.current.footerImageUrl).toBe(DEFAULT_ASSETS.footerImageUrl)
  })

  it('should return assets from localStorage (highest priority)', () => {
    saveAssets({
      logoUrl: '/storage/logo.png',
      partnerLogoUrl: '/storage/partner.png',
      footerImageUrl: '/storage/footer.png',
    })

    const { result } = renderHook(() => useAssets())

    expect(result.current.logoUrl).toBe('/storage/logo.png')
    expect(result.current.partnerLogoUrl).toBe('/storage/partner.png')
    expect(result.current.footerImageUrl).toBe('/storage/footer.png')
  })

  it('should return assets from URL params when localStorage is empty', () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?logoUrl=/url/logo.png&partnerLogoUrl=/url/partner.png',
      },
      writable: true,
    })

    const { result } = renderHook(() => useAssets())

    expect(result.current.logoUrl).toBe('/url/logo.png')
    expect(result.current.partnerLogoUrl).toBe('/url/partner.png')
    expect(result.current.footerImageUrl).toBe(DEFAULT_ASSETS.footerImageUrl) // Falls back to default
  })

  it('should prefer localStorage over URL params', () => {
    // Set different values in localStorage and URL params
    saveAssets({ logoUrl: '/storage/logo.png' })
    Object.defineProperty(window, 'location', {
      value: { search: '?logoUrl=/url/logo.png' },
      writable: true,
    })

    const { result } = renderHook(() => useAssets())

    // localStorage wins
    expect(result.current.logoUrl).toBe('/storage/logo.png')
  })

  it('should fall back to defaults for missing values', () => {
    // Only set logoUrl in localStorage
    saveAssets({ logoUrl: '/custom/logo.png' })

    const { result } = renderHook(() => useAssets())

    expect(result.current.logoUrl).toBe('/custom/logo.png')
    expect(result.current.partnerLogoUrl).toBe(DEFAULT_ASSETS.partnerLogoUrl)
    expect(result.current.footerImageUrl).toBe(DEFAULT_ASSETS.footerImageUrl)
  })

  it('should return all guaranteed values (never undefined)', () => {
    const { result } = renderHook(() => useAssets())

    // All values should be defined strings
    expect(typeof result.current.logoUrl).toBe('string')
    expect(typeof result.current.partnerLogoUrl).toBe('string')
    expect(typeof result.current.footerImageUrl).toBe('string')
    expect(result.current.logoUrl.length).toBeGreaterThan(0)
    expect(result.current.partnerLogoUrl.length).toBeGreaterThan(0)
    expect(result.current.footerImageUrl.length).toBeGreaterThan(0)
  })

  it('should support data URIs from localStorage', () => {
    saveAssets({ logoUrl: 'data:image/png;base64,iVBORw0KGgo=' })

    const { result } = renderHook(() => useAssets())

    expect(result.current.logoUrl).toBe('data:image/png;base64,iVBORw0KGgo=')
  })

  it('should use defaults after clearing assets', () => {
    saveAssets({ logoUrl: '/custom/logo.png' })
    clearAssets()

    const { result } = renderHook(() => useAssets())

    expect(result.current.logoUrl).toBe(DEFAULT_ASSETS.logoUrl)
  })
})
