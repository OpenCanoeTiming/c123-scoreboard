import { test, expect } from '@playwright/test'

/**
 * Visual regression tests for scoreboard layouts.
 *
 * Uses ReplayProvider with high speed to quickly load data.
 * Compares screenshots against baseline images.
 */

test.describe('Vertical Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Use replay with high speed to quickly load data
    // type=vertical forces vertical layout
    await page.goto('/?type=vertical&speed=100')
    // Wait for DOM to be ready
    await page.waitForLoadState('domcontentloaded')
    // Wait for results-list container to appear (always rendered)
    await page.waitForSelector('[data-testid="results-list"]', { timeout: 30000 })
    // Wait for actual result rows to appear (data loaded) - using nth-child selector
    await page.waitForFunction(() => {
      const list = document.querySelector('[data-testid="results-list"]')
      return list && list.querySelectorAll('div[class*="row"]').length > 1
    }, { timeout: 30000 })
    // Additional wait for animations to settle
    await page.waitForTimeout(500)
  })

  test('full page screenshot matches reference', async ({ page }) => {
    await expect(page).toHaveScreenshot('vertical-full-page.png', {
      fullPage: true,
    })
  })

  test('topbar renders correctly', async ({ page }) => {
    const topbar = page.getByTestId('topbar')
    await expect(topbar).toBeVisible()
    await expect(topbar).toHaveScreenshot('vertical-topbar.png')
  })

  test('title renders correctly', async ({ page }) => {
    const title = page.getByTestId('title')
    await expect(title).toBeVisible()
    await expect(title).toHaveScreenshot('vertical-title.png')
  })

  test('oncourse renders correctly', async ({ page }) => {
    const oncourse = page.getByTestId('oncourse')
    await expect(oncourse).toBeVisible()
    await expect(oncourse).toHaveScreenshot('vertical-oncourse.png')
  })

  test('results list renders correctly', async ({ page }) => {
    const results = page.getByTestId('results-list')
    await expect(results).toBeVisible()
    await expect(results).toHaveScreenshot('vertical-results.png')
  })

  test('footer renders correctly', async ({ page }) => {
    const footer = page.getByTestId('footer')
    await expect(footer).toBeVisible()
    await expect(footer).toHaveScreenshot('vertical-footer.png')
  })
})

test.describe('Ledwall Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Use replay with high speed, type=ledwall forces ledwall layout
    await page.goto('/?type=ledwall&speed=100')
    // Wait for DOM to be ready
    await page.waitForLoadState('domcontentloaded')
    // Wait for results-list container to appear (always rendered)
    await page.waitForSelector('[data-testid="results-list"]', { timeout: 30000 })
    // Wait for actual result rows to appear (data loaded)
    await page.waitForFunction(() => {
      const list = document.querySelector('[data-testid="results-list"]')
      return list && list.querySelectorAll('div[class*="row"]').length > 1
    }, { timeout: 30000 })
    await page.waitForTimeout(500)
  })

  test('full page screenshot matches reference', async ({ page }) => {
    await expect(page).toHaveScreenshot('ledwall-full-page.png', {
      fullPage: true,
    })
  })

  test('topbar renders correctly', async ({ page }) => {
    const topbar = page.getByTestId('topbar')
    await expect(topbar).toBeVisible()
    await expect(topbar).toHaveScreenshot('ledwall-topbar.png')
  })

  test('title renders correctly', async ({ page }) => {
    const title = page.getByTestId('title')
    await expect(title).toBeVisible()
    await expect(title).toHaveScreenshot('ledwall-title.png')
  })

  test('oncourse renders correctly', async ({ page }) => {
    const oncourse = page.getByTestId('oncourse')
    await expect(oncourse).toBeVisible()
    await expect(oncourse).toHaveScreenshot('ledwall-oncourse.png')
  })

  test('results list renders correctly', async ({ page }) => {
    const results = page.getByTestId('results-list')
    await expect(results).toBeVisible()
    await expect(results).toHaveScreenshot('ledwall-results.png')
  })

  // Footer is hidden in ledwall layout - verify it's not visible
  test('footer is hidden', async ({ page }) => {
    const footer = page.getByTestId('footer')
    await expect(footer).not.toBeVisible()
  })
})
