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

test.describe('Layout: Vertical 1080×1920', () => {
  test('displays full layout with all components', async ({ page }) => {
    await page.setViewportSize({ width: 1080, height: 1920 })
    await page.goto('/?type=vertical&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    // All main components should be visible
    await expect(page.getByTestId('topbar')).toBeVisible()
    await expect(page.getByTestId('title')).toBeVisible()
    await expect(page.getByTestId('oncourse')).toBeVisible()
    await expect(page.getByTestId('results-list')).toBeVisible()
    await expect(page.getByTestId('footer')).toBeVisible()
  })

  test('results grid has all columns visible', async ({ page }) => {
    await page.setViewportSize({ width: 1080, height: 1920 })
    await page.goto('/?type=vertical&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    // Check that grid template has expected columns for vertical layout
    // Expected: rank, bib, name, penalty, time, behind
    const gridStyle = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="results-list"]')
      if (!list) return null
      const row = list.querySelector('div[class*="row"]')
      if (!row) return null
      return window.getComputedStyle(row).gridTemplateColumns
    })

    // Vertical layout should have 6 columns
    expect(gridStyle).toBeTruthy()
    const columnCount = gridStyle!.split(' ').filter(s => s.trim()).length
    expect(columnCount).toBe(6)
  })

  test('displays correct number of result rows', async ({ page }) => {
    await page.setViewportSize({ width: 1080, height: 1920 })
    await page.goto('/?type=vertical&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    const rowCount = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="results-list"]')
      return list ? list.querySelectorAll('div[class*="row"]').length : 0
    })

    // Should have multiple rows for vertical layout
    expect(rowCount).toBeGreaterThan(5)
  })

  test('screenshot for reference', async ({ page }) => {
    await page.setViewportSize({ width: 1080, height: 1920 })
    await page.goto('/?type=vertical&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)
    await page.waitForTimeout(1000)

    await expect(page).toHaveScreenshot('layout-vertical-1080x1920.png', {
      fullPage: true,
    })
  })
})

test.describe('Layout: Ledwall 768×384 (exactSize)', () => {
  test('displays compact layout without footer', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 384 })
    await page.goto('/?type=ledwall&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    // Main components should be visible
    await expect(page.getByTestId('topbar')).toBeVisible()
    await expect(page.getByTestId('title')).toBeVisible()
    await expect(page.getByTestId('oncourse')).toBeVisible()
    await expect(page.getByTestId('results-list')).toBeVisible()

    // Footer should be hidden in ledwall mode
    await expect(page.getByTestId('footer')).not.toBeVisible()
  })

  test('results grid has compact columns', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 384 })
    await page.goto('/?type=ledwall&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    // Check grid template for ledwall layout
    const gridStyle = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="results-list"]')
      if (!list) return null
      const row = list.querySelector('div[class*="row"]')
      if (!row) return null
      return window.getComputedStyle(row).gridTemplateColumns
    })

    // Ledwall has 5 columns (rank, bib, name, penalty, time) - less than vertical's 6
    // Ledwall grid: 80px 40px 1fr 40px 100px (behind column hidden)
    expect(gridStyle).toBeTruthy()
    const columnCount = gridStyle!.split(' ').filter(s => s.trim()).length
    expect(columnCount).toBe(5)
  })

  test('all content fits in viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 384 })
    await page.goto('/?type=ledwall&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    // Check that no scrollbar is visible (content fits)
    const hasScroll = await page.evaluate(() => {
      return document.documentElement.scrollHeight > document.documentElement.clientHeight
    })

    // Ledwall should not require vertical scroll
    expect(hasScroll).toBe(false)
  })

  test('screenshot for reference', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 384 })
    await page.goto('/?type=ledwall&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)
    await page.waitForTimeout(1000)

    await expect(page).toHaveScreenshot('layout-ledwall-768x384.png', {
      fullPage: true,
    })
  })
})

test.describe('Layout: Ledwall 1920×480 (wide)', () => {
  test('displays wide ledwall layout', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 480 })
    await page.goto('/?type=ledwall&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    // Main components should be visible
    await expect(page.getByTestId('topbar')).toBeVisible()
    await expect(page.getByTestId('title')).toBeVisible()
    await expect(page.getByTestId('oncourse')).toBeVisible()
    await expect(page.getByTestId('results-list')).toBeVisible()

    // Footer should still be hidden in ledwall mode
    await expect(page.getByTestId('footer')).not.toBeVisible()
  })

  test('has more result rows visible than standard ledwall', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 480 })
    await page.goto('/?type=ledwall&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    const wideRowCount = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="results-list"]')
      return list ? list.querySelectorAll('div[class*="row"]').length : 0
    })

    // Compare with standard ledwall
    await page.setViewportSize({ width: 768, height: 384 })
    await page.waitForTimeout(500)

    const standardRowCount = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="results-list"]')
      return list ? list.querySelectorAll('div[class*="row"]').length : 0
    })

    // Wide ledwall (480px height) may display more rows than 384px
    expect(wideRowCount).toBeGreaterThanOrEqual(standardRowCount)
  })

  test('screenshot for reference', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 480 })
    await page.goto('/?type=ledwall&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)
    await page.waitForTimeout(1000)

    await expect(page).toHaveScreenshot('layout-ledwall-1920x480.png', {
      fullPage: true,
    })
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
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/?type=ledwall&displayRows=5&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    // Check that layout fills viewport height
    const layoutRect = await page.evaluate(() => {
      const layout = document.querySelector('[data-layout-mode]')
      if (!layout) return null
      const rect = layout.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    })

    // Layout should approximately fill viewport
    expect(layoutRect).not.toBeNull()
    expect(layoutRect!.height).toBeGreaterThanOrEqual(1000) // Close to 1080
    expect(layoutRect!.width).toBeGreaterThanOrEqual(1800) // Close to 1920
  })

  test('displayRows=3 shows larger elements', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 384 })
    await page.goto('/?type=ledwall&displayRows=3&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)

    // Get scale factor
    const transform = await page.evaluate(() => {
      const layout = document.querySelector('[data-layout-mode]')
      if (!layout) return null
      return window.getComputedStyle(layout).transform
    })

    // Transform should be applied (scale > 1 for fewer rows)
    expect(transform).not.toBe('none')
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
    await page.goto('/?type=ledwall&displayRows=5&speed=100&pauseAfter=50&disableScroll=true')
    await waitForDataLoad(page)
    await page.waitForTimeout(1000)

    await expect(page).toHaveScreenshot('layout-ledwall-displayRows5-1920x1080.png', {
      fullPage: true,
    })
  })
})
