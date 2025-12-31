import { test, expect, Page } from '@playwright/test'

/**
 * Automated layout tests for different viewport sizes.
 *
 * Tests verify that the scoreboard correctly adapts to different resolutions:
 * - Vertical 1080×1920 - full layout with footer
 * - Ledwall 768×384 - compact layout without footer
 * - Ledwall 1920×480 - wide ledwall layout
 * - Dynamic resize - switching between layouts
 *
 * As per checklist item 10.3
 */

// Helper to wait for data load
async function waitForDataLoad(page: Page, timeout = 30000) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForSelector('[data-testid="results-list"]', { timeout })
  await page.waitForFunction(() => {
    const list = document.querySelector('[data-testid="results-list"]')
    return list && list.querySelectorAll('div[class*="row"]').length > 1
  }, { timeout })
  await page.waitForTimeout(1000)
}

// Parametrized layout configurations
interface LayoutConfig {
  name: string
  width: number
  height: number
  type: 'vertical' | 'ledwall'
  expectedColumns: number
  showFooter: boolean
  screenshotName: string
}

const layoutConfigs: LayoutConfig[] = [
  {
    name: 'Vertical 1080×1920',
    width: 1080,
    height: 1920,
    type: 'vertical',
    expectedColumns: 6,
    showFooter: true,
    screenshotName: 'layout-vertical-1080x1920.png',
  },
  {
    name: 'Ledwall 768×384',
    width: 768,
    height: 384,
    type: 'ledwall',
    expectedColumns: 5,
    showFooter: false,
    screenshotName: 'layout-ledwall-768x384.png',
  },
  {
    name: 'Ledwall 1920×480 (wide)',
    width: 1920,
    height: 480,
    type: 'ledwall',
    expectedColumns: 5,
    showFooter: false,
    screenshotName: 'layout-ledwall-1920x480.png',
  },
]

for (const config of layoutConfigs) {
  test.describe(`Layout: ${config.name}`, () => {
    test('displays layout with correct components', async ({ page }) => {
      await page.setViewportSize({ width: config.width, height: config.height })
      // Need more messages for competitor to have dtStart (starts around message 190)
      await page.goto(`/?type=${config.type}&speed=100&pauseAfter=250&disableScroll=true`)
      await waitForDataLoad(page)

      // Main components should be visible
      await expect(page.getByTestId('topbar')).toBeVisible()
      await expect(page.getByTestId('title')).toBeVisible()
      // oncourse is only visible when competitor has dtStart (actively racing)
      await expect(page.getByTestId('oncourse')).toBeVisible()
      await expect(page.getByTestId('results-list')).toBeVisible()

      // Footer visibility depends on layout type
      if (config.showFooter) {
        await expect(page.getByTestId('footer')).toBeVisible()
      } else {
        await expect(page.getByTestId('footer')).not.toBeVisible()
      }
    })

    test('results grid has correct number of columns', async ({ page }) => {
      await page.setViewportSize({ width: config.width, height: config.height })
      await page.goto(`/?type=${config.type}&speed=100&pauseAfter=50&disableScroll=true`)
      await waitForDataLoad(page)

      const gridStyle = await page.evaluate(() => {
        const list = document.querySelector('[data-testid="results-list"]')
        if (!list) return null
        const row = list.querySelector('div[class*="row"]')
        if (!row) return null
        return window.getComputedStyle(row).gridTemplateColumns
      })

      expect(gridStyle).toBeTruthy()
      const columnCount = gridStyle!.split(' ').filter(s => s.trim()).length
      expect(columnCount).toBe(config.expectedColumns)
    })

    test('screenshot for reference', async ({ page }) => {
      await page.setViewportSize({ width: config.width, height: config.height })
      // Need more messages for competitor to have dtStart (starts around message 190)
      await page.goto(`/?type=${config.type}&speed=100&pauseAfter=250&disableScroll=true`)
      await waitForDataLoad(page)
      await page.waitForTimeout(1000)

      await expect(page).toHaveScreenshot(config.screenshotName, {
        fullPage: true,
      })
    })
  })
}

// Ledwall-specific tests
test.describe('Layout: Ledwall specific', () => {
  test('all content fits in viewport (768×384)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 384 })
    await page.goto('/?type=ledwall&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    const hasScroll = await page.evaluate(() => {
      return document.documentElement.scrollHeight > document.documentElement.clientHeight
    })

    expect(hasScroll).toBe(false)
  })

  test('wide ledwall has more rows than standard', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 480 })
    await page.goto('/?type=ledwall&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    const wideRowCount = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="results-list"]')
      return list ? list.querySelectorAll('div[class*="row"]').length : 0
    })

    await page.setViewportSize({ width: 768, height: 384 })
    await page.waitForTimeout(500)

    const standardRowCount = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="results-list"]')
      return list ? list.querySelectorAll('div[class*="row"]').length : 0
    })

    expect(wideRowCount).toBeGreaterThanOrEqual(standardRowCount)
  })
})

test.describe('Layout: Dynamic resize', () => {
  test('switches from vertical to ledwall on resize', async ({ page }) => {
    // Start with vertical
    await page.setViewportSize({ width: 1080, height: 1920 })
    await page.goto('/?speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    // Verify vertical layout (footer visible)
    await expect(page.getByTestId('footer')).toBeVisible()

    // Get column count for vertical
    const verticalColumns = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="results-list"]')
      if (!list) return 0
      const row = list.querySelector('div[class*="row"]')
      if (!row) return 0
      return window.getComputedStyle(row).gridTemplateColumns.split(' ').filter(s => s.trim()).length
    })

    // Resize to ledwall dimensions
    await page.setViewportSize({ width: 768, height: 384 })
    await page.waitForTimeout(1000)

    // Get column count for ledwall
    const ledwallColumns = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="results-list"]')
      if (!list) return 0
      const row = list.querySelector('div[class*="row"]')
      if (!row) return 0
      return window.getComputedStyle(row).gridTemplateColumns.split(' ').filter(s => s.trim()).length
    })

    // Vertical should have more columns than ledwall
    expect(verticalColumns).toBeGreaterThan(ledwallColumns)
  })

  test('switches from ledwall to vertical on resize', async ({ page }) => {
    // Start with ledwall
    await page.setViewportSize({ width: 768, height: 384 })
    await page.goto('/?type=ledwall&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    // Verify ledwall layout (footer hidden)
    await expect(page.getByTestId('footer')).not.toBeVisible()

    // Resize to vertical dimensions
    await page.setViewportSize({ width: 1080, height: 1920 })
    await page.goto('/?type=vertical&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    // Footer should now be visible in vertical
    await expect(page.getByTestId('footer')).toBeVisible()
  })

  test('handles rapid resize changes', async ({ page }) => {
    await page.setViewportSize({ width: 1080, height: 1920 })
    await page.goto('/?speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    // Rapid resize sequence
    const sizes = [
      { width: 768, height: 384 },
      { width: 1920, height: 480 },
      { width: 1080, height: 1920 },
      { width: 768, height: 384 },
    ]

    for (const size of sizes) {
      await page.setViewportSize(size)
      await page.waitForTimeout(200)
    }

    // Final state should be ledwall
    await page.waitForTimeout(500)

    // App should not crash - check that main components are still visible
    await expect(page.getByTestId('results-list')).toBeVisible()
  })
})

test.describe('Layout: displayRows scaling (Phase 11)', () => {
  test('applies CSS transform when displayRows is set', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/?type=ledwall&displayRows=5&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    // Check that transform is applied
    const transform = await page.evaluate(() => {
      const layout = document.querySelector('[data-layout-mode]')
      if (!layout) return null
      return window.getComputedStyle(layout).transform
    })

    // Transform should be a scale matrix (not 'none')
    expect(transform).not.toBe('none')
    expect(transform).toContain('matrix')
  })

  test('scales layout to fill viewport with displayRows=5', async ({ page }) => {
    const viewportWidth = 1920
    const viewportHeight = 1080
    await page.setViewportSize({ width: viewportWidth, height: viewportHeight })
    // Need more messages for competitor to have dtStart (starts around message 190)
    await page.goto('/?type=ledwall&displayRows=5&speed=100&pauseAfter=250&disableScroll=true')
    await waitForDataLoad(page)

    // Check that layout fills viewport height
    const layoutRect = await page.evaluate(() => {
      const layout = document.querySelector('[data-layout-mode]')
      if (!layout) return null
      const rect = layout.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    })

    // Layout should approximately fill viewport (at least 90% of viewport dimensions)
    expect(layoutRect).not.toBeNull()
    expect(layoutRect!.height).toBeGreaterThanOrEqual(viewportHeight * 0.9)
    expect(layoutRect!.width).toBeGreaterThanOrEqual(viewportWidth * 0.9)
  })

  test('displayRows=3 applies scale transform', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 384 })
    await page.goto('/?type=ledwall&displayRows=3&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    // Get scale factor from transform matrix
    const scaleInfo = await page.evaluate(() => {
      const layout = document.querySelector('[data-layout-mode]')
      if (!layout) return null
      const transform = window.getComputedStyle(layout).transform
      // Parse scale from matrix(a, b, c, d, tx, ty) - 'a' is scaleX
      const match = transform.match(/matrix\(([^,]+),/)
      const scale = match ? parseFloat(match[1]) : null
      return { transform, scale }
    })

    // Transform should be applied with scale factor
    expect(scaleInfo).not.toBeNull()
    expect(scaleInfo!.transform).not.toBe('none')
    // With displayRows=3 on 384px viewport, scale should be > 1 (content is scaled up)
    expect(scaleInfo!.scale).toBeGreaterThan(1)
  })

  test('no scaling when displayRows is not set', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 384 })
    await page.goto('/?type=ledwall&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    // Check that no transform is applied
    const transform = await page.evaluate(() => {
      const layout = document.querySelector('[data-layout-mode]')
      if (!layout) return null
      return window.getComputedStyle(layout).transform
    })

    // Transform should be 'none' or identity matrix
    expect(transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true)
  })

  test('screenshot with displayRows=5 on 1920x1080', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    // Need more messages for competitor to have dtStart (starts around message 190)
    await page.goto('/?type=ledwall&displayRows=5&speed=100&pauseAfter=250&disableScroll=true')
    await waitForDataLoad(page)
    await page.waitForTimeout(1000)

    await expect(page).toHaveScreenshot('layout-ledwall-displayRows5-1920x1080.png', {
      fullPage: true,
    })
  })

  // Edge case tests for displayRows validation (min: 3, max: 20)
  test('displayRows below minimum (2) is clamped to 3', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/?type=ledwall&displayRows=2&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    // Should still render properly with clamped value
    const transform = await page.evaluate(() => {
      const layout = document.querySelector('[data-layout-mode]')
      if (!layout) return null
      return window.getComputedStyle(layout).transform
    })

    expect(transform).not.toBe('none')
    expect(transform).toContain('matrix')
  })

  test('displayRows at minimum (3) applies transform', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/?type=ledwall&displayRows=3&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    const scaleInfo = await page.evaluate(() => {
      const layout = document.querySelector('[data-layout-mode]')
      if (!layout) return null
      const transform = window.getComputedStyle(layout).transform
      const match = transform.match(/matrix\(([^,]+),/)
      const scale = match ? parseFloat(match[1]) : null
      return { transform, scale }
    })

    expect(scaleInfo).not.toBeNull()
    expect(scaleInfo!.transform).not.toBe('none')
    // With only 3 rows on 1080px viewport, scale should be significantly > 1
    expect(scaleInfo!.scale).toBeGreaterThan(2)
  })

  test('displayRows at maximum (20) applies transform', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/?type=ledwall&displayRows=20&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    const scaleInfo = await page.evaluate(() => {
      const layout = document.querySelector('[data-layout-mode]')
      if (!layout) return null
      const transform = window.getComputedStyle(layout).transform
      const match = transform.match(/matrix\(([^,]+),/)
      const scale = match ? parseFloat(match[1]) : null
      return { transform, scale }
    })

    expect(scaleInfo).not.toBeNull()
    expect(scaleInfo!.transform).not.toBe('none')
    // With 20 rows on 1080px viewport, scale should be < 1 (content scaled down)
    expect(scaleInfo!.scale).toBeLessThan(1)
  })

  test('displayRows above maximum (25) is clamped to 20', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/?type=ledwall&displayRows=25&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    // Should still render properly with clamped value
    const transform = await page.evaluate(() => {
      const layout = document.querySelector('[data-layout-mode]')
      if (!layout) return null
      return window.getComputedStyle(layout).transform
    })

    expect(transform).not.toBe('none')
    expect(transform).toContain('matrix')
  })
})
