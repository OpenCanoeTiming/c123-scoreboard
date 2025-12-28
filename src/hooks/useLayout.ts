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
}

/**
 * Layout constants based on extracted styles from prototype
 */
const LAYOUT_CONFIG = {
  vertical: {
    headerHeight: 100,
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
 * Get layout mode from URL parameter or detect from viewport
 */
function getLayoutModeFromURL(): LayoutMode | null {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  const type = params.get('type')

  if (type === 'vertical' || type === 'ledwall') {
    return type
  }
  return null
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
 */
function calculateVisibleRows(
  availableHeight: number,
  config: LayoutModeConfig
): { visibleRows: number; rowHeight: number } {
  // Start with target row height
  let rowHeight = config.targetRowHeight
  let visibleRows = Math.floor(availableHeight / rowHeight)

  // Clamp visible rows
  visibleRows = Math.max(config.minVisibleRows, Math.min(config.maxVisibleRows, visibleRows))

  // Recalculate row height to fill space evenly
  rowHeight = Math.floor(availableHeight / visibleRows)

  // Clamp row height
  rowHeight = Math.max(config.minRowHeight, Math.min(config.maxRowHeight, rowHeight))

  // Final adjustment of visible rows based on clamped row height
  visibleRows = Math.floor(availableHeight / rowHeight)
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
 */
function updateCSSVariables(config: LayoutConfig): void {
  if (typeof document === 'undefined') return

  const root = document.documentElement

  root.style.setProperty('--row-height', `${config.rowHeight}px`)
  root.style.setProperty('--visible-rows', String(config.visibleRows))
  root.style.setProperty('--header-height', `${config.headerHeight}px`)
  root.style.setProperty('--footer-height', `${config.footerHeight}px`)
  root.style.setProperty('--layout-mode', config.layoutMode)
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

  // Determine layout mode
  const layoutMode = useMemo(() => {
    // Check URL parameter first
    const urlMode = getLayoutModeFromURL()
    if (urlMode) return urlMode

    // Auto-detect from viewport
    return detectLayoutMode(viewport.width, viewport.height)
  }, [viewport.width, viewport.height])

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
    }
  }, [layoutMode, viewport.width, viewport.height])

  // Update CSS variables when config changes
  useEffect(() => {
    updateCSSVariables(config)
  }, [config])

  return config
}

export default useLayout
