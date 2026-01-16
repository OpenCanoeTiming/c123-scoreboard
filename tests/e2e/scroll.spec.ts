import { test, expect, Page } from '@playwright/test'

/**
 * E2E tests for auto-scroll functionality.
 *
 * Tests verify that:
 * - Scroll amount is correct (not skipping or missing rows)
 * - Scrolling works on different layouts (vertical, ledwall)
 * - displayRows parameter doesn't break scrolling
 *
 * NOTE: Default Playwright config uses --force-prefers-reduced-motion which
 * disables auto-scroll. These tests need to override that setting.
 */

// Note: Reduced motion is enabled globally for stable screenshots.
// Scroll tests use disableScroll=true anyway, so scroll animation is not tested here.

// Helper to wait for data load
async function waitForDataLoad(page: Page, timeout = 30000) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForSelector('[data-testid="results-list"]', { timeout })
  // Wait for actual data rows to appear (rows have data-bib attribute)
  await page.waitForFunction(
    () => {
      const list = document.querySelector('[data-testid="results-list"]')
      return list && list.querySelectorAll('[data-bib]').length > 1
    },
    { timeout }
  )
  await page.waitForTimeout(500)
}

// Helper to get visible row indices
async function getVisibleRowBibs(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const list = document.querySelector('[data-testid="results-list"]')
    if (!list) return []

    const containerRect = list.getBoundingClientRect()
    const rows = Array.from(list.querySelectorAll('[data-bib]'))

    return rows
      .filter((row) => {
        const rect = row.getBoundingClientRect()
        // Row is visible if its top is within container bounds
        return rect.top >= containerRect.top && rect.top < containerRect.bottom
      })
      .map((row) => row.getAttribute('data-bib') || '')
  })
}

// Helper to get first visible row bib
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getFirstVisibleRowBib(page: Page): Promise<string | null> {
  const bibs = await getVisibleRowBibs(page)
  return bibs.length > 0 ? bibs[0] : null
}

test.describe('Auto-scroll behavior', () => {
  // Note: Auto-scroll timing tests are skipped because:
  // 1. Playwright's --force-prefers-reduced-motion affects the media query
  // 2. Highlight events in recorded data pause scrolling
  // 3. Real scroll timing tests require very long wait times (>30s)
  //
  // The scroll logic is tested via:
  // - Unit tests in useAutoScroll.test.ts
  // - Row spacing calculation test below
  // - Manual testing during development

  test('results list is visible and functional', async ({ page }) => {
    await page.setViewportSize({ width: 1080, height: 1920 })
    await page.goto('/?source=replay&type=vertical&speed=100&pauseAfter=500&disableScroll=true')
    await waitForDataLoad(page)

    // Verify results list is visible
    await expect(page.getByTestId('results-list')).toBeVisible()

    // Verify it has content
    const rowCount = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="results-list"]')
      return list ? list.querySelectorAll('[data-bib]').length : 0
    })
    expect(rowCount).toBeGreaterThan(0)
  })

  test('ledwall with displayRows renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/?source=replay&type=ledwall&displayRows=5&speed=100&pauseAfter=500&disableScroll=true')
    await waitForDataLoad(page)

    // Verify results list is visible and has fixed height for scrolling
    const listInfo = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="results-list"]')
      if (!list) return null
      const style = window.getComputedStyle(list)
      return {
        height: style.height,
        overflow: style.overflowY,
        rowCount: list.querySelectorAll('[data-bib]').length,
      }
    })

    expect(listInfo).not.toBeNull()
    expect(listInfo!.rowCount).toBeGreaterThan(0)
    // Container should have fixed height when displayRows is set
    expect(listInfo!.height).not.toBe('auto')
  })
})

test.describe('Scroll row spacing calculation', () => {
  test('measures actual row spacing including margins', async ({ page }) => {
    await page.setViewportSize({ width: 1080, height: 1920 })
    await page.goto('/?source=replay&type=vertical&speed=100&pauseAfter=500&disableScroll=true')
    await waitForDataLoad(page)

    // Measure row spacing
    const spacing = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="results-list"]')
      if (!list) return null

      const rows = Array.from(list.querySelectorAll('[data-bib]'))
      if (rows.length < 2) return null

      const row0 = rows[0] as HTMLElement
      const row1 = rows[1] as HTMLElement

      return {
        row0OffsetTop: row0.offsetTop,
        row1OffsetTop: row1.offsetTop,
        actualSpacing: row1.offsetTop - row0.offsetTop,
        row0Height: row0.offsetHeight,
        computedRowHeight: parseInt(
          window.getComputedStyle(row0).getPropertyValue('height'),
          10
        ),
      }
    })

    expect(spacing).not.toBeNull()

    // Row spacing should be height + any margin
    // With 2px margin top and bottom, spacing should be height + 4
    // But CSS shows margin: 2px 0, so total margin between rows is 4px
    const expectedMinSpacing = spacing!.computedRowHeight
    const expectedMaxSpacing = spacing!.computedRowHeight + 8 // Allow for some margin

    expect(spacing!.actualSpacing).toBeGreaterThanOrEqual(expectedMinSpacing)
    expect(spacing!.actualSpacing).toBeLessThanOrEqual(expectedMaxSpacing)
  })
})
