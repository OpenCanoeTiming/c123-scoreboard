import { useState, useEffect, useMemo } from 'react'

/**
 * Layout mode - vertical (portrait TV) or ledwall (wide display)
 */
export type LayoutMode = 'vertical' | 'ledwall'

/**
 * Layout configuration returned by useLayout hook
 */
export interface LayoutConfig {
  /** Current layout mode (vertical or ledwall) */
  layoutMode: LayoutMode
  /** Viewport width in pixels */
  viewportWidth: number
  /** Viewport height in pixels */
  viewportHeight: number
  /** Number of visible result rows */
  visibleRows: number
  /** Height of each result row in pixels */
  rowHeight: number
  /** Whether to show footer (hidden on ledwall) */
  showFooter: boolean
  /** Header height in pixels */
  headerHeight: number
  /** Footer height in pixels (0 when hidden) */
  footerHeight: number
  /** Base font size category for scaling */
  fontSizeCategory: 'small' | 'medium' | 'large'
  /** Whether auto-scroll is disabled (via URL param for screenshots) */
  disableScroll: boolean
}

/**
 * Layout constants based on extracted styles from prototype
 */
const LAYOUT_CONFIG = {
  vertical: {
    headerHeight: 100, // Matched from original v1 --top-bar-height (Title overlays TopBar)
    footerHeight: 60,
    minRowHeight: 44,
    maxRowHeight: 56,
    targetRowHeight: 48,
    currentCompetitorHeight: 200, // Approximate height for current competitor section
    minVisibleRows: 8,
    maxVisibleRows: 25,
  },
  ledwall: {
    headerHeight: 60,
    footerHeight: 0, // No footer on ledwall
    minRowHeight: 50,
    maxRowHeight: 64,
    targetRowHeight: 56,
    currentCompetitorHeight: 100, // Smaller on ledwall
    minVisibleRows: 3,
    maxVisibleRows: 8,
  },
} as const

/**
 * URL parameters for layout configuration
 */
interface LayoutURLParams {
  /** Layout mode override from URL */
  type: LayoutMode | null
  /** Whether auto-scroll is disabled */
  disableScroll: boolean
}

/**
 * Get layout parameters from URL
 */
function getLayoutParamsFromURL(): LayoutURLParams {
  if (typeof window === 'undefined') {
    return { type: null, disableScroll: false }
  }

  const params = new URLSearchParams(window.location.search)
  const type = params.get('type')
  const disableScroll = params.get('disableScroll') === 'true'

  return {
    type: type === 'vertical' || type === 'ledwall' ? type : null,
    disableScroll,
  }
}

/**
 * Detect layout mode from viewport aspect ratio
 * - Vertical: height > width * 1.5 (portrait displays)
 * - Ledwall: width >= height * 1.5 (wide displays)
 */
function detectLayoutMode(width: number, height: number): LayoutMode {
  const aspectRatio = width / height

  // Ledwall is typically 2:1 aspect ratio (e.g., 768x384)
  // Anything wider than 1.5:1 is considered ledwall
  if (aspectRatio >= 1.5) {
    return 'ledwall'
  }

  // Everything else is vertical (including near-square)
  return 'vertical'
}

/**
 * Layout mode config type
 */
interface LayoutModeConfig {
  headerHeight: number
  footerHeight: number
  minRowHeight: number
  maxRowHeight: number
  targetRowHeight: number
  currentCompetitorHeight: number
  minVisibleRows: number
  maxVisibleRows: number
}

/**
 * Calculate visible rows based on available height
 * Uses fixed row height from config (48px vertical, 56px ledwall) per analysis/06-styly.md
 */
function calculateVisibleRows(
  availableHeight: number,
  config: LayoutModeConfig
): { visibleRows: number; rowHeight: number } {
  // Use fixed row height from config (matches original v1 computed styles)
  const rowHeight = config.targetRowHeight

  // Calculate visible rows based on fixed row height
  let visibleRows = Math.floor(availableHeight / rowHeight)

  // Clamp visible rows
  visibleRows = Math.max(config.minVisibleRows, Math.min(config.maxVisibleRows, visibleRows))

  return { visibleRows, rowHeight }
}

/**
 * Determine font size category based on viewport
 */
function getFontSizeCategory(
  layoutMode: LayoutMode,
  viewportHeight: number
): 'small' | 'medium' | 'large' {
  if (layoutMode === 'ledwall') {
    // Ledwall uses larger fonts due to viewing distance
    return viewportHeight < 400 ? 'medium' : 'large'
  }

  // Vertical layout
  if (viewportHeight < 1200) {
    return 'small'
  } else if (viewportHeight < 1600) {
    return 'medium'
  }
  return 'large'
}

/**
 * Update CSS custom properties on :root
 * Sets font sizes based on layout mode (vertical vs ledwall) per analysis/06-styly.md
 */
function updateCSSVariables(config: LayoutConfig): void {
  if (typeof document === 'undefined') return

  const root = document.documentElement

  root.style.setProperty('--row-height', `${config.rowHeight}px`)
  root.style.setProperty('--visible-rows', String(config.visibleRows))
  root.style.setProperty('--header-height', `${config.headerHeight}px`)
  root.style.setProperty('--footer-height', `${config.footerHeight}px`)
  root.style.setProperty('--layout-mode', config.layoutMode)

  // Set result row font sizes based on layout mode (from analysis/06-styly.md)
  if (config.layoutMode === 'ledwall') {
    // Ledwall font sizes
    root.style.setProperty('--result-rank-size', '36px')
    root.style.setProperty('--result-bib-size', '22px')
    root.style.setProperty('--result-name-size', '36px')
    root.style.setProperty('--result-penalty-size', '22px')
    root.style.setProperty('--result-time-size', '36px')
    root.style.setProperty('--result-behind-size', '22px')
  } else {
    // Vertical font sizes
    root.style.setProperty('--result-rank-size', '32px')
    root.style.setProperty('--result-bib-size', '24px')
    root.style.setProperty('--result-name-size', '32px')
    root.style.setProperty('--result-penalty-size', '24px')
    root.style.setProperty('--result-time-size', '32px')
    root.style.setProperty('--result-behind-size', '24px')
  }
}

/**
 * Hook for responsive layout management
 *
 * Detects viewport size, determines layout mode (vertical/ledwall),
 * and calculates optimal row counts and sizes.
 *
 * Features:
 * - URL parameter override (?type=vertical|ledwall)
 * - Auto-detection from aspect ratio
 * - Dynamic row height/count calculation
 * - CSS variable updates for components
 * - Debounced resize handling
 *
 * @example
 * ```tsx
 * const { layoutMode, visibleRows, rowHeight, showFooter } = useLayout()
 * ```
 */
export function useLayout(): LayoutConfig {
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1080,
    height: typeof window !== 'undefined' ? window.innerHeight : 1920,
  }))

  // Handle resize with debounce
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const handleResize = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      timeoutId = setTimeout(() => {
        setViewport({
          width: window.innerWidth,
          height: window.innerHeight,
        })
      }, 100) // 100ms debounce
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [])

  // Get URL parameters (memoized)
  const urlParams = useMemo(() => getLayoutParamsFromURL(), [])

  // Determine layout mode
  const layoutMode = useMemo(() => {
    // Check URL parameter first
    if (urlParams.type) return urlParams.type

    // Auto-detect from viewport
    return detectLayoutMode(viewport.width, viewport.height)
  }, [viewport.width, viewport.height, urlParams.type])

  // Calculate layout configuration
  const config = useMemo((): LayoutConfig => {
    const modeConfig = LAYOUT_CONFIG[layoutMode]

    // Calculate available height for results list
    const availableHeight =
      viewport.height -
      modeConfig.headerHeight -
      modeConfig.footerHeight -
      modeConfig.currentCompetitorHeight

    const { visibleRows, rowHeight } = calculateVisibleRows(
      Math.max(availableHeight, 200),
      modeConfig
    )

    const fontSizeCategory = getFontSizeCategory(layoutMode, viewport.height)

    return {
      layoutMode,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      visibleRows,
      rowHeight,
      showFooter: layoutMode !== 'ledwall',
      headerHeight: modeConfig.headerHeight,
      footerHeight: layoutMode === 'ledwall' ? 0 : modeConfig.footerHeight,
      fontSizeCategory,
      disableScroll: urlParams.disableScroll,
    }
  }, [layoutMode, viewport.width, viewport.height, urlParams.disableScroll])

  // Update CSS variables when config changes
  useEffect(() => {
    updateCSSVariables(config)
  }, [config])

  return config
}

export default useLayout
