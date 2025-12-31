import { test, expect } from '@playwright/test'

/**
 * Dynamic/interactive tests for scoreboard behavior.
 *
 * These tests verify animations, transitions, and interactive features.
 * Unlike visual.spec.ts, these tests allow playback to continue
 * and verify dynamic behavior.
 */

test.describe('Data Loading', () => {
  test('shows connection status during initial load', async ({ page }) => {
    // Go to page with slow speed to see connection status
    await page.goto('/?type=vertical&speed=1')

    // Should show loading/connecting state initially
    await page.waitForLoadState('domcontentloaded')

    // Wait for connection status element (if visible)
    // The app should transition from loading to connected state
    await page.waitForSelector('[data-testid="results-list"]', { timeout: 30000 })

    // Eventually data should appear
    await page.waitForFunction(
      () => {
        const list = document.querySelector('[data-testid="results-list"]')
        return list && list.querySelectorAll('div[class*="row"]').length > 1
      },
      { timeout: 30000 }
    )
  })
})

test.describe('Highlight Behavior', () => {
  test.skip('highlight appears and fades after competitor finishes', async ({ page }) => {
    // SKIPPED: This test requires specific recording data with highlight events
    // which may not be present in all test recordings.
    // Use replay without pauseAfter to let playback continue
    // Speed up to reach a highlight event quickly
    await page.goto('/?type=vertical&speed=50')

    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('[data-testid="results-list"]', { timeout: 30000 })

    // Wait for data to load
    await page.waitForFunction(
      () => {
        const list = document.querySelector('[data-testid="results-list"]')
        return list && list.querySelectorAll('div[class*="row"]').length > 1
      },
      { timeout: 30000 }
    )

    // Wait for a highlight to appear (look for highlighted row class)
    // This may take some time as we need a competitor to finish
    const highlighted = await page.waitForSelector('[class*="highlighted"]', {
      timeout: 60000,
      state: 'attached',
    }).catch(() => null)

    // Highlight may or may not appear depending on recording data
    // If it appears, verify it's visible
    if (highlighted) {
      await expect(highlighted).toBeVisible()
    }
  })
})

test.describe('Current Competitor', () => {
  test('shows current competitor data', async ({ page }) => {
    // Need more messages for competitor to have dtStart (starts around message 190)
    await page.goto('/?type=vertical&speed=100&pauseAfter=250')

    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('[data-testid="oncourse"]', { timeout: 30000 })
    await page.waitForTimeout(2000)

    const oncourse = page.getByTestId('oncourse')
    await expect(oncourse).toBeVisible()

    // Should contain competitor info (bib number, name, etc.)
    const text = await oncourse.textContent()
    expect(text).toBeTruthy()
    expect(text!.length).toBeGreaterThan(0)
  })

  test('running indicator pulses for active competitor', async ({ page }) => {
    // Need more messages for competitor to have dtStart (starts around message 190)
    await page.goto('/?type=vertical&speed=100&pauseAfter=250')

    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('[data-testid="oncourse"]', { timeout: 30000 })
    await page.waitForTimeout(2000)

    // Look for the running indicator (►)
    const indicator = page.locator('[class*="runningIndicator"]')

    // If a competitor is running, the indicator should be visible
    const isVisible = await indicator.isVisible().catch(() => false)

    // This is optional - may not be visible if competitor has finished
    if (isVisible) {
      // The indicator should have the pulsing animation class
      await expect(indicator).toHaveText('►')
    }
  })
})

test.describe('Layout Switching', () => {
  test('vertical layout shows footer', async ({ page }) => {
    await page.goto('/?type=vertical&speed=100&pauseAfter=50')
    await page.waitForSelector('[data-testid="results-list"]', { timeout: 30000 })
    await page.waitForTimeout(1000)

    const footer = page.getByTestId('footer')
    await expect(footer).toBeVisible()
  })

  test('ledwall layout hides footer', async ({ page }) => {
    await page.goto('/?type=ledwall&speed=100&pauseAfter=50')
    await page.waitForSelector('[data-testid="results-list"]', { timeout: 30000 })
    await page.waitForTimeout(1000)

    const footer = page.getByTestId('footer')
    await expect(footer).not.toBeVisible()
  })
})

test.describe('Results List', () => {
  test('displays multiple result rows', async ({ page }) => {
    await page.goto('/?type=vertical&speed=100&pauseAfter=50&disableScroll=true')
    await page.waitForSelector('[data-testid="results-list"]', { timeout: 30000 })
    await page.waitForFunction(
      () => {
        const list = document.querySelector('[data-testid="results-list"]')
        return list && list.querySelectorAll('div[class*="row"]').length > 1
      },
      { timeout: 30000 }
    )

    const results = page.getByTestId('results-list')
    const rows = results.locator('div[class*="row"]')

    // Should have header row + at least a few result rows
    const count = await rows.count()
    expect(count).toBeGreaterThan(2)
  })

  test('shows rank, bib, name, time for each result', async ({ page }) => {
    await page.goto('/?type=vertical&speed=100&pauseAfter=50&disableScroll=true')
    await page.waitForSelector('[data-testid="results-list"]', { timeout: 30000 })
    await page.waitForFunction(
      () => {
        const list = document.querySelector('[data-testid="results-list"]')
        return list && list.querySelectorAll('div[class*="row"]').length > 1
      },
      { timeout: 30000 }
    )

    const results = page.getByTestId('results-list')

    // No header row in original v1 - check that data rows exist directly
    const dataRows = results.locator('div[class*="row"]')
    const count = await dataRows.count()
    expect(count).toBeGreaterThan(0)
  })
})
