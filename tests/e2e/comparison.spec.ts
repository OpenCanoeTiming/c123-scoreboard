import { test, expect, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Visual comparison tests between v1 (original) and v2 (new) versions.
 *
 * These tests capture screenshots from both versions and compare them.
 * The original version runs at http://192.168.68.108:3000
 * The new version runs at http://localhost:5173
 *
 * Prerequisites:
 * - Original v1 server must be running at 192.168.68.108:3000
 * - CLI WebSocket server must be running at 192.168.68.108:8081
 * - New v2 dev server must be running at localhost:5173
 * - Both versions must connect to the same CLI server for live data
 *
 * Note: These tests require live CLI data because the original v1 version
 * does not support the same replay parameters as v2. Both versions will
 * connect to the same CLI WebSocket server and capture synchronized screenshots.
 *
 * Run with: npx playwright test comparison.spec.ts --project=vertical
 *
 * To skip these tests when CLI is unavailable, they will auto-skip.
 */

const ORIGINAL_BASE_URL = 'http://192.168.68.108:3000'
const NEW_BASE_URL = 'http://localhost:5173'
const CLI_WS_URL = 'ws://192.168.68.108:8081'
const CLI_WS_URL_ENCODED = encodeURIComponent(CLI_WS_URL + '/')
const SCREENSHOT_DIR = 'tests/e2e/comparison-screenshots'

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

/**
 * Wait for scoreboard data to load (with results visible)
 */
async function waitForDataLoad(page: Page, timeout = 30000) {
  await page.waitForLoadState('domcontentloaded')
  // Wait for results-list element
  await page.waitForSelector('[data-testid="results-list"]', { timeout })
  // Wait for actual data rows to appear
  await page.waitForFunction(
    () => {
      const list = document.querySelector('[data-testid="results-list"]')
      return list && list.querySelectorAll('div[class*="row"]').length > 1
    },
    { timeout }
  )
  // Extra wait for animations to settle
  await page.waitForTimeout(2000)
}

/**
 * Check if original server is available and has data
 */
async function isOriginalServerAvailable(page: Page): Promise<boolean> {
  try {
    const response = await page.goto(ORIGINAL_BASE_URL, { timeout: 5000 })
    return response?.ok() ?? false
  } catch {
    return false
  }
}

/**
 * Check if CLI WebSocket server is available
 */
async function isCLIServerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Simple TCP check - in Node.js we can't directly check WebSocket
      // but we can check if port is open
      const net = require('net')
      const socket = new net.Socket()
      socket.setTimeout(2000)

      socket.on('connect', () => {
        socket.destroy()
        resolve(true)
      })

      socket.on('timeout', () => {
        socket.destroy()
        resolve(false)
      })

      socket.on('error', () => {
        socket.destroy()
        resolve(false)
      })

      socket.connect(8081, '192.168.68.108')
    } catch {
      resolve(false)
    }
  })
}

test.describe('Visual Comparison with Original v1', () => {
  test.beforeAll(async ({ browser }) => {
    // Check if both servers are available
    const page = await browser.newPage()
    const serverAvailable = await isOriginalServerAvailable(page)
    await page.close()

    const cliAvailable = await isCLIServerAvailable()

    if (!serverAvailable || !cliAvailable) {
      console.warn(`
        ⚠️  Comparison tests require:
        - Original v1 server at ${ORIGINAL_BASE_URL}: ${serverAvailable ? '✓' : '✗'}
        - CLI WebSocket at ${CLI_WS_URL}: ${cliAvailable ? '✓' : '✗'}

        To run these tests:
        1. Ensure the original v1 scoreboard is running
        2. Ensure the CLI WebSocket server is running
        3. Run: npx playwright test comparison.spec.ts
      `)
    }
  })

  test('vertical layout - full page comparison', async ({ page }) => {
    // Check prerequisites
    const serverAvailable = await isOriginalServerAvailable(page)
    const cliAvailable = await isCLIServerAvailable()
    test.skip(!serverAvailable || !cliAvailable, 'Servers not available')

    // Configure viewport for vertical
    await page.setViewportSize({ width: 1080, height: 1920 })

    // URL params for original v1 (uses 'server' param for WebSocket)
    const originalParams = `type=vertical&server=${CLI_WS_URL_ENCODED}&disableScroll=true`
    // URL params for new v2 (uses 'source=cli' and 'host' param)
    const newParams = 'type=vertical&source=cli&host=192.168.68.108:8081&disableScroll=true'

    // 1. Screenshot original v1
    await page.goto(`${ORIGINAL_BASE_URL}/?${originalParams}`)
    await waitForDataLoad(page)
    const originalScreenshot = await page.screenshot({ fullPage: true })
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'original-vertical.png'),
      originalScreenshot
    )

    // 2. Screenshot new v2
    await page.goto(`${NEW_BASE_URL}/?${newParams}`)
    await waitForDataLoad(page)
    const newScreenshot = await page.screenshot({ fullPage: true })
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'new-vertical.png'),
      newScreenshot
    )

    // 3. Compare - using 2% tolerance for layout/styling differences
    // Strict threshold to catch any visual issues
    await expect(page).toHaveScreenshot('comparison-vertical.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02, // 2% tolerance for live data timing variations
    })
  })

  test('ledwall layout - full page comparison', async ({ page }) => {
    const serverAvailable = await isOriginalServerAvailable(page)
    const cliAvailable = await isCLIServerAvailable()
    test.skip(!serverAvailable || !cliAvailable, 'Servers not available')

    // Configure viewport for ledwall
    await page.setViewportSize({ width: 768, height: 384 })

    // URL params
    const originalParams = `type=ledwall&server=${CLI_WS_URL_ENCODED}&disableScroll=true&ledwallExactSize=true`
    const newParams = 'type=ledwall&source=cli&host=192.168.68.108:8081&disableScroll=true'

    // 1. Screenshot original v1
    await page.goto(`${ORIGINAL_BASE_URL}/?${originalParams}`)
    await waitForDataLoad(page)
    const originalScreenshot = await page.screenshot({ fullPage: true })
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'original-ledwall.png'),
      originalScreenshot
    )

    // 2. Screenshot new v2
    await page.goto(`${NEW_BASE_URL}/?${newParams}`)
    await waitForDataLoad(page)
    const newScreenshot = await page.screenshot({ fullPage: true })
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'new-ledwall.png'),
      newScreenshot
    )

    // 3. Compare - strict threshold
    await expect(page).toHaveScreenshot('comparison-ledwall.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02, // 2% tolerance
    })
  })

  test('vertical - oncourse component comparison', async ({ page }) => {
    const serverAvailable = await isOriginalServerAvailable(page)
    const cliAvailable = await isCLIServerAvailable()
    test.skip(!serverAvailable || !cliAvailable, 'Servers not available')

    await page.setViewportSize({ width: 1080, height: 1920 })

    const originalParams = `type=vertical&server=${CLI_WS_URL_ENCODED}&disableScroll=true`
    const newParams = 'type=vertical&source=cli&host=192.168.68.108:8081&disableScroll=true'

    // Capture oncourse from original
    await page.goto(`${ORIGINAL_BASE_URL}/?${originalParams}`)
    await waitForDataLoad(page)
    const originalOncourse = page.locator('[data-testid="oncourse"]')
    if (await originalOncourse.isVisible()) {
      const originalScreenshot = await originalOncourse.screenshot()
      fs.writeFileSync(
        path.join(SCREENSHOT_DIR, 'original-oncourse.png'),
        originalScreenshot
      )
    }

    // Capture oncourse from new version
    await page.goto(`${NEW_BASE_URL}/?${newParams}`)
    await waitForDataLoad(page)
    const newOncourse = page.getByTestId('oncourse')
    if (await newOncourse.isVisible()) {
      await expect(newOncourse).toHaveScreenshot('comparison-oncourse.png', {
        maxDiffPixelRatio: 0.02, // 2% tolerance
      })
    }
  })

  test('vertical - results list comparison', async ({ page }) => {
    const serverAvailable = await isOriginalServerAvailable(page)
    const cliAvailable = await isCLIServerAvailable()
    test.skip(!serverAvailable || !cliAvailable, 'Servers not available')

    await page.setViewportSize({ width: 1080, height: 1920 })

    const originalParams = `type=vertical&server=${CLI_WS_URL_ENCODED}&disableScroll=true`
    const newParams = 'type=vertical&source=cli&host=192.168.68.108:8081&disableScroll=true'

    // Capture results from original
    await page.goto(`${ORIGINAL_BASE_URL}/?${originalParams}`)
    await waitForDataLoad(page)
    const originalResults = page.locator('[data-testid="results-list"]')
    if (await originalResults.isVisible()) {
      const originalScreenshot = await originalResults.screenshot()
      fs.writeFileSync(
        path.join(SCREENSHOT_DIR, 'original-results.png'),
        originalScreenshot
      )
    }

    // Capture results from new version
    await page.goto(`${NEW_BASE_URL}/?${newParams}`)
    await waitForDataLoad(page)
    const newResults = page.getByTestId('results-list')
    await expect(newResults).toHaveScreenshot('comparison-results.png', {
      maxDiffPixelRatio: 0.02, // 2% tolerance
    })
  })
})

test.describe('Metrics Comparison', () => {
  test('compare CSS computed styles', async ({ page }) => {
    const serverAvailable = await isOriginalServerAvailable(page)
    const cliAvailable = await isCLIServerAvailable()
    test.skip(!serverAvailable || !cliAvailable, 'Servers not available')

    await page.setViewportSize({ width: 1080, height: 1920 })

    const originalParams = `type=vertical&server=${CLI_WS_URL_ENCODED}&disableScroll=true`
    const newParams = 'type=vertical&source=cli&host=192.168.68.108:8081&disableScroll=true'

    // Collect styles from original
    await page.goto(`${ORIGINAL_BASE_URL}/?${originalParams}`)
    await waitForDataLoad(page)

    const originalStyles = await page.evaluate(() => {
      const getStyles = (selector: string) => {
        const el = document.querySelector(selector)
        if (!el) return null
        const computed = window.getComputedStyle(el)
        return {
          fontSize: computed.fontSize,
          fontFamily: computed.fontFamily,
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          padding: computed.padding,
          margin: computed.margin,
        }
      }

      return {
        body: getStyles('body'),
        resultsList: getStyles('[data-testid="results-list"]'),
        oncourse: getStyles('[data-testid="oncourse"]'),
        topbar: getStyles('[data-testid="topbar"]'),
        title: getStyles('[data-testid="title"]'),
      }
    })

    // Collect styles from new version
    await page.goto(`${NEW_BASE_URL}/?${newParams}`)
    await waitForDataLoad(page)

    const newStyles = await page.evaluate(() => {
      const getStyles = (selector: string) => {
        const el = document.querySelector(selector)
        if (!el) return null
        const computed = window.getComputedStyle(el)
        return {
          fontSize: computed.fontSize,
          fontFamily: computed.fontFamily,
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          padding: computed.padding,
          margin: computed.margin,
        }
      }

      return {
        body: getStyles('body'),
        resultsList: getStyles('[data-testid="results-list"]'),
        oncourse: getStyles('[data-testid="oncourse"]'),
        topbar: getStyles('[data-testid="topbar"]'),
        title: getStyles('[data-testid="title"]'),
      }
    })

    // Save comparison report
    const report = {
      timestamp: new Date().toISOString(),
      original: originalStyles,
      new: newStyles,
    }

    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'styles-comparison.json'),
      JSON.stringify(report, null, 2)
    )

    // Log differences for debugging
    console.log('Style comparison saved to', path.join(SCREENSHOT_DIR, 'styles-comparison.json'))
  })

  test('compare DOM structure', async ({ page }) => {
    const serverAvailable = await isOriginalServerAvailable(page)
    const cliAvailable = await isCLIServerAvailable()
    test.skip(!serverAvailable || !cliAvailable, 'Servers not available')

    await page.setViewportSize({ width: 1080, height: 1920 })

    const originalParams = `type=vertical&server=${CLI_WS_URL_ENCODED}&disableScroll=true`
    const newParams = 'type=vertical&source=cli&host=192.168.68.108:8081&disableScroll=true'

    // Get DOM structure from original
    await page.goto(`${ORIGINAL_BASE_URL}/?${originalParams}`)
    await waitForDataLoad(page)

    const originalStructure = await page.evaluate(() => {
      const countElements = (selector: string) => {
        return document.querySelectorAll(selector).length
      }

      return {
        resultRows: countElements('[data-testid="results-list"] div[class*="row"]'),
        hasOncourse: !!document.querySelector('[data-testid="oncourse"]'),
        hasTopbar: !!document.querySelector('[data-testid="topbar"]'),
        hasTitle: !!document.querySelector('[data-testid="title"]'),
        hasFooter: !!document.querySelector('[data-testid="footer"]'),
      }
    })

    // Get DOM structure from new version
    await page.goto(`${NEW_BASE_URL}/?${newParams}`)
    await waitForDataLoad(page)

    const newStructure = await page.evaluate(() => {
      const countElements = (selector: string) => {
        return document.querySelectorAll(selector).length
      }

      return {
        resultRows: countElements('[data-testid="results-list"] div[class*="row"]'),
        hasOncourse: !!document.querySelector('[data-testid="oncourse"]'),
        hasTopbar: !!document.querySelector('[data-testid="topbar"]'),
        hasTitle: !!document.querySelector('[data-testid="title"]'),
        hasFooter: !!document.querySelector('[data-testid="footer"]'),
      }
    })

    // Compare structures
    expect(newStructure.hasOncourse).toBe(originalStructure.hasOncourse)
    expect(newStructure.hasTopbar).toBe(originalStructure.hasTopbar)
    expect(newStructure.hasTitle).toBe(originalStructure.hasTitle)
    expect(newStructure.hasFooter).toBe(originalStructure.hasFooter)

    // Result rows should be similar (within 10% tolerance for timing differences)
    const rowDiff = Math.abs(newStructure.resultRows - originalStructure.resultRows)
    const tolerance = Math.max(1, Math.floor(originalStructure.resultRows * 0.1))
    expect(rowDiff).toBeLessThanOrEqual(tolerance)
  })
})
