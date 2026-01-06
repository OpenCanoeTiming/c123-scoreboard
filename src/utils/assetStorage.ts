/**
 * Asset Storage - localStorage persistence for custom assets
 *
 * Stores custom logo and image URLs received via ConfigPush from C123 Server.
 * Supports relative URLs, absolute URLs, and data URIs.
 */

const STORAGE_KEY = 'csb-assets'

/**
 * Asset configuration
 */
export interface AssetConfig {
  /** Main logo URL (top-left corner) */
  logoUrl?: string
  /** Partner/sponsor logo URL (top-right corner) */
  partnerLogoUrl?: string
  /** Footer sponsor banner URL */
  footerImageUrl?: string
}

/**
 * Default asset URLs (used as fallback)
 */
export const DEFAULT_ASSETS: Required<AssetConfig> = {
  logoUrl: '/assets/logo.svg',
  partnerLogoUrl: '/assets/partners.png',
  footerImageUrl: '/assets/footer.png',
}

/**
 * Blocked URL schemes that should be rejected
 */
const BLOCKED_SCHEMES = ['javascript:', 'vbscript:', 'ftp:', 'file:', 'mailto:', 'tel:']

/**
 * Validate asset URL format
 *
 * Valid formats:
 * - Relative URL: /assets/logo.png, assets/logo.png
 * - Absolute URL: http://example.com/logo.png, https://example.com/logo.png
 * - Data URI: data:image/png;base64,...
 *
 * Blocked formats:
 * - javascript:, vbscript:, ftp:, file:, mailto:, tel:
 *
 * @param url - URL to validate
 * @returns true if URL is valid format
 */
export function isValidAssetUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  // Trim whitespace
  const trimmed = url.trim()
  if (trimmed.length === 0) {
    return false
  }

  // Check for blocked schemes first
  const lowerUrl = trimmed.toLowerCase()
  for (const scheme of BLOCKED_SCHEMES) {
    if (lowerUrl.startsWith(scheme)) {
      return false
    }
  }

  // Absolute URL (http:// or https://)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return true
  }

  // Data URI (data:image/...)
  if (trimmed.startsWith('data:image/')) {
    return true
  }

  // Relative URL (starts with / or alphanumeric without scheme)
  // Already checked blocked schemes above
  if (trimmed.startsWith('/') || /^[a-zA-Z0-9]/.test(trimmed)) {
    // Make sure it's not some other URL scheme we missed
    // Valid relative URLs don't contain `:` before the first `/`
    const colonIndex = trimmed.indexOf(':')
    const slashIndex = trimmed.indexOf('/')
    if (colonIndex === -1 || (slashIndex !== -1 && slashIndex < colonIndex)) {
      return true
    }
  }

  return false
}

/**
 * Check if URL is a data URI (too large for URL params)
 *
 * @param url - URL to check
 * @returns true if URL is a data URI
 */
export function isDataUri(url: string): boolean {
  return typeof url === 'string' && url.trim().startsWith('data:')
}

/**
 * Save asset configuration to localStorage
 *
 * @param assets - Asset configuration to save
 */
export function saveAssets(assets: AssetConfig): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  try {
    // Validate each asset URL before saving
    const validated: AssetConfig = {}

    if (assets.logoUrl && isValidAssetUrl(assets.logoUrl)) {
      validated.logoUrl = assets.logoUrl.trim()
    }
    if (assets.partnerLogoUrl && isValidAssetUrl(assets.partnerLogoUrl)) {
      validated.partnerLogoUrl = assets.partnerLogoUrl.trim()
    }
    if (assets.footerImageUrl && isValidAssetUrl(assets.footerImageUrl)) {
      validated.footerImageUrl = assets.footerImageUrl.trim()
    }

    // Only save if we have at least one valid asset
    if (Object.keys(validated).length > 0) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(validated))
    }
  } catch (err) {
    console.warn('assetStorage: Failed to save assets to localStorage:', err)
  }
}

/**
 * Load asset configuration from localStorage
 *
 * @returns Asset configuration or null if not found/invalid
 */
export function loadAssets(): AssetConfig | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return null
    }

    const parsed = JSON.parse(stored) as AssetConfig

    // Validate each URL after loading
    const validated: AssetConfig = {}

    if (parsed.logoUrl && isValidAssetUrl(parsed.logoUrl)) {
      validated.logoUrl = parsed.logoUrl
    }
    if (parsed.partnerLogoUrl && isValidAssetUrl(parsed.partnerLogoUrl)) {
      validated.partnerLogoUrl = parsed.partnerLogoUrl
    }
    if (parsed.footerImageUrl && isValidAssetUrl(parsed.footerImageUrl)) {
      validated.footerImageUrl = parsed.footerImageUrl
    }

    return Object.keys(validated).length > 0 ? validated : null
  } catch (err) {
    console.warn('assetStorage: Failed to load assets from localStorage:', err)
    return null
  }
}

/**
 * Clear asset configuration from localStorage
 *
 * Used to reset to default assets
 */
export function clearAssets(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn('assetStorage: Failed to clear assets from localStorage:', err)
  }
}

/**
 * Parse asset URLs from URL parameters
 *
 * Only accepts relative and absolute URLs (not data URIs - too large for URL params)
 *
 * @returns Asset configuration from URL params (data URIs filtered out)
 */
export function getAssetsFromUrlParams(): AssetConfig {
  if (typeof window === 'undefined') {
    return {}
  }

  const params = new URLSearchParams(window.location.search)
  const assets: AssetConfig = {}

  const logoUrl = params.get('logoUrl')
  if (logoUrl && isValidAssetUrl(logoUrl) && !isDataUri(logoUrl)) {
    assets.logoUrl = logoUrl
  } else if (logoUrl && isDataUri(logoUrl)) {
    console.warn('assetStorage: Data URI not allowed in URL params for logoUrl (use ConfigPush instead)')
  }

  const partnerLogoUrl = params.get('partnerLogoUrl')
  if (partnerLogoUrl && isValidAssetUrl(partnerLogoUrl) && !isDataUri(partnerLogoUrl)) {
    assets.partnerLogoUrl = partnerLogoUrl
  } else if (partnerLogoUrl && isDataUri(partnerLogoUrl)) {
    console.warn('assetStorage: Data URI not allowed in URL params for partnerLogoUrl (use ConfigPush instead)')
  }

  const footerImageUrl = params.get('footerImageUrl')
  if (footerImageUrl && isValidAssetUrl(footerImageUrl) && !isDataUri(footerImageUrl)) {
    assets.footerImageUrl = footerImageUrl
  } else if (footerImageUrl && isDataUri(footerImageUrl)) {
    console.warn('assetStorage: Data URI not allowed in URL params for footerImageUrl (use ConfigPush instead)')
  }

  return assets
}
