import { useMemo } from 'react'
import {
  loadAssets,
  getAssetsFromUrlParams,
  DEFAULT_ASSETS,
  type AssetConfig,
} from '@/utils/assetStorage'

/**
 * Resolved asset URLs with guaranteed values
 */
export interface ResolvedAssets {
  /** Main logo URL (top-left corner) */
  logoUrl: string
  /** Partner/sponsor logo URL (top-right corner) */
  partnerLogoUrl: string
  /** Footer sponsor banner URL */
  footerImageUrl: string
}

/**
 * Hook for resolving asset URLs with fallback chain
 *
 * Fallback priority (highest to lowest):
 * 1. localStorage (persisted from ConfigPush via WebSocket)
 * 2. URL params (only relative/absolute URLs, no data URIs)
 * 3. Default assets (/assets/logo.svg, etc.)
 *
 * Note: ConfigPush stores assets to localStorage when received,
 * so localStorage has the most up-to-date values.
 *
 * @example
 * ```tsx
 * function ScoreboardContent() {
 *   const assets = useAssets()
 *
 *   return (
 *     <>
 *       <TopBar logoUrl={assets.logoUrl} partnerLogoUrl={assets.partnerLogoUrl} />
 *       <Footer imageUrl={assets.footerImageUrl} />
 *     </>
 *   )
 * }
 * ```
 */
export function useAssets(): ResolvedAssets {
  return useMemo(() => {
    // Load from localStorage (highest priority - persisted from ConfigPush)
    const storedAssets: AssetConfig = loadAssets() ?? {}

    // Load from URL params (medium priority - no data URIs allowed)
    const urlAssets: AssetConfig = getAssetsFromUrlParams()

    // Merge with fallback chain: localStorage -> URL params -> defaults
    return {
      logoUrl: storedAssets.logoUrl ?? urlAssets.logoUrl ?? DEFAULT_ASSETS.logoUrl,
      partnerLogoUrl: storedAssets.partnerLogoUrl ?? urlAssets.partnerLogoUrl ?? DEFAULT_ASSETS.partnerLogoUrl,
      footerImageUrl: storedAssets.footerImageUrl ?? urlAssets.footerImageUrl ?? DEFAULT_ASSETS.footerImageUrl,
    }
  }, [])
}

export default useAssets
