import { test, expect } from '@playwright/test'
import { openSettledReplay } from './helpers/replay'

/**
 * Visual regression tests for scoreboard layouts.
 *
 * Uses ReplayProvider with high speed to quickly load data.
 * The pauseAfter=500 parameter pauses playback after 500 messages, and
 * openSettledReplay() drives a frozen page clock so transient UI states
 * (highlight, departing) have expired before the screenshot.
 *
 * Compares screenshots against baseline images.
 */

test.describe('Vertical Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Use replay with high speed to quickly load data
    // source=replay uses ReplayProvider with recorded data
    // type=vertical forces vertical layout
    // pauseAfter=500 stops playback after 500 messages (enough for results)
    // disableScroll=true prevents auto-scroll for stable screenshots
    await openSettledReplay(page, 'type=vertical&speed=100&pauseAfter=500&disableScroll=true')
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
    // Need to reload with more messages for oncourse - first dtStart comes after ~190 messages
    await openSettledReplay(page, 'type=vertical&speed=100&pauseAfter=250&disableScroll=true')

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
    // source=replay uses ReplayProvider with recorded data
    // pauseAfter=500 stops playback after 500 messages for stable screenshots
    // disableScroll=true prevents auto-scroll for stable screenshots
    await openSettledReplay(page, 'type=ledwall&speed=100&pauseAfter=500&disableScroll=true')
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
    // Need to reload with more messages for oncourse - first dtStart comes after ~190 messages
    await openSettledReplay(page, 'type=ledwall&speed=100&pauseAfter=250&disableScroll=true')

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
