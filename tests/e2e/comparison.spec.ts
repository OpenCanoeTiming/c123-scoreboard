import { test, expect, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import * as net from 'net'

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
 * Supports both original (class-based) and new (data-testid) versions
 */
async function waitForDataLoad(page: Page, timeout = 30000, isOriginal = false) {
  await page.waitForLoadState('domcontentloaded')

  // Different selectors for original vs new version
  const resultsSelector = isOriginal ? '.results-list' : '[data-testid="results-list"]'
  const rowSelector = isOriginal ? '.result-row' : 'div[class*="row"]'

  // Wait for results-list element
  await page.waitForSelector(resultsSelector, { timeout })
  // Wait for actual data rows to appear
  await page.waitForFunction(
    ({ resultsSelector, rowSelector }) => {
      const list = document.querySelector(resultsSelector)
      return list && list.querySelectorAll(rowSelector).length > 1
    },
    { resultsSelector, rowSelector },
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
    await waitForDataLoad(page, 30000, true) // isOriginal=true
    const originalScreenshot = await page.screenshot({ fullPage: true })
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'original-vertical.png'),
      originalScreenshot
    )

    // 2. Screenshot new v2
    await page.goto(`${NEW_BASE_URL}/?${newParams}`)
    await waitForDataLoad(page, 30000, false) // isOriginal=false
    const newScreenshot = await page.screenshot({ fullPage: true })
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'new-vertical.png'),
      newScreenshot
    )

    // Screenshoty uloženy pro manuální porovnání
    // original-vertical.png vs new-vertical.png v tests/e2e/comparison-screenshots/
    console.log('Screenshots saved: original-vertical.png, new-vertical.png')
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
    await waitForDataLoad(page, 30000, true) // isOriginal=true
    const originalScreenshot = await page.screenshot({ fullPage: true })
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'original-ledwall.png'),
      originalScreenshot
    )

    // 2. Screenshot new v2
    await page.goto(`${NEW_BASE_URL}/?${newParams}`)
    await waitForDataLoad(page, 30000, false) // isOriginal=false
    const newScreenshot = await page.screenshot({ fullPage: true })
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'new-ledwall.png'),
      newScreenshot
    )

    // Screenshoty uloženy pro manuální porovnání
    console.log('Screenshots saved: original-ledwall.png, new-ledwall.png')
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
    await waitForDataLoad(page, 30000, true) // isOriginal=true
    // Original uses class-based selector
    const originalOncourse = page.locator('.current-competitor')
    if (await originalOncourse.isVisible()) {
      const originalScreenshot = await originalOncourse.screenshot()
      fs.writeFileSync(
        path.join(SCREENSHOT_DIR, 'original-oncourse.png'),
        originalScreenshot
      )
    }

    // Capture oncourse from new version
    await page.goto(`${NEW_BASE_URL}/?${newParams}`)
    await waitForDataLoad(page, 30000, false) // isOriginal=false
    const newOncourse = page.getByTestId('oncourse')
    if (await newOncourse.isVisible()) {
      const newScreenshot = await newOncourse.screenshot()
      fs.writeFileSync(
        path.join(SCREENSHOT_DIR, 'new-oncourse.png'),
        newScreenshot
      )
    }
    console.log('Screenshots saved: original-oncourse.png, new-oncourse.png')
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
    await waitForDataLoad(page, 30000, true) // isOriginal=true
    // Original uses class-based selector
    const originalResults = page.locator('.results-list')
    if (await originalResults.isVisible()) {
      const originalScreenshot = await originalResults.screenshot()
      fs.writeFileSync(
        path.join(SCREENSHOT_DIR, 'original-results.png'),
        originalScreenshot
      )
    }

    // Capture results from new version
    await page.goto(`${NEW_BASE_URL}/?${newParams}`)
    await waitForDataLoad(page, 30000, false) // isOriginal=false
    const newResults = page.getByTestId('results-list')
    const newScreenshot = await newResults.screenshot()
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'new-results.png'),
      newScreenshot
    )
    console.log('Screenshots saved: original-results.png, new-results.png')
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

    // Collect styles from original (uses class-based selectors)
    await page.goto(`${ORIGINAL_BASE_URL}/?${originalParams}`)
    await waitForDataLoad(page, 30000, true) // isOriginal=true

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
        resultsList: getStyles('.results-list'),
        oncourse: getStyles('.current-competitor'),
        topbar: getStyles('.top-bar'),
        title: getStyles('.event-title'),
      }
    })

    // Collect styles from new version (uses data-testid selectors)
    await page.goto(`${NEW_BASE_URL}/?${newParams}`)
    await waitForDataLoad(page, 30000, false) // isOriginal=false

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

    // Get DOM structure from original (uses class-based selectors)
    await page.goto(`${ORIGINAL_BASE_URL}/?${originalParams}`)
    await waitForDataLoad(page, 30000, true) // isOriginal=true

    const originalStructure = await page.evaluate(() => {
      const countElements = (selector: string) => {
        return document.querySelectorAll(selector).length
      }

      return {
        resultRows: countElements('.results-list .result-row'),
        hasOncourse: !!document.querySelector('.current-competitor'),
        hasTopbar: !!document.querySelector('.top-bar'),
        hasTitle: !!document.querySelector('.event-title'),
        hasFooter: !!document.querySelector('.footer'),
      }
    })

    // Get DOM structure from new version (uses data-testid selectors)
    await page.goto(`${NEW_BASE_URL}/?${newParams}`)
    await waitForDataLoad(page, 30000, false) // isOriginal=false

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
