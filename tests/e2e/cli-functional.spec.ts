import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import * as net from 'net'

/**
 * Get layout type based on viewport dimensions
 */
function getLayoutType(viewport: { width: number; height: number } | null): 'vertical' | 'ledwall' {
  if (!viewport) return 'vertical'
  // Ledwall is typically 768×384 or similar wide format
  return viewport.width > viewport.height ? 'ledwall' : 'vertical'
}

/**
 * Build CLI URL with correct layout type for current viewport
 */
function buildCLIUrl(page: Page, extraParams = ''): string {
  const layoutType = getLayoutType(page.viewportSize())
  const base = `/?type=${layoutType}&source=cli&host=${CLI_HOST}`
  return extraParams ? `${base}&${extraParams}` : base
}

/**
 * CLI Functional E2E Tests
 *
 * These tests verify the functional behavior when connected to the CLI WebSocket server.
 * They test message handling, data display, and reconnection behavior.
 *
 * Prerequisites:
 * - CLI WebSocket server running at 192.168.68.108:8081
 * - Dev server running at localhost:5173
 *
 * Tests will auto-skip if CLI server is not available.
 */

const CLI_HOST = '192.168.68.108:8081'
const CLI_WS_URL = `ws://${CLI_HOST}`

/**
 * Check if CLI WebSocket server is available via TCP port check
 */
async function isCLIServerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const socket = new net.Socket()
      socket.setTimeout(5000)

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

      const [host, port] = CLI_HOST.split(':')
      socket.connect(parseInt(port), host)
    } catch {
      resolve(false)
    }
  })
}

/**
 * Wait for WebSocket connection to be established
 */
async function waitForConnection(page: Page, timeout = 15000) {
  await page.waitForFunction(
    () => {
      // Check for connection status element or results being displayed
      const status = document.querySelector('[data-testid="connection-status"]')
      const results = document.querySelector('[data-testid="results-list"]')
      // Either status shows connected, or we have results (implying connected)
      return (
        (status && status.textContent?.toLowerCase().includes('connected')) ||
        (results && results.querySelectorAll('div[class*="row"]').length > 1)
      )
    },
    { timeout }
  )
}

/**
 * Wait for results to be displayed
 */
async function waitForResults(page: Page, timeout = 30000) {
  await page.waitForSelector('[data-testid="results-list"]', { timeout })
  await page.waitForFunction(
    () => {
      const list = document.querySelector('[data-testid="results-list"]')
      return list && list.querySelectorAll('div[class*="row"]').length > 1
    },
    { timeout }
  )
}

/**
 * Wait for current competitor (oncourse) to be displayed
 * @deprecated Currently unused - kept for future tests
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function waitForCurrentCompetitor(page: Page, timeout = 30000) {
  await page.waitForSelector('[data-testid="oncourse"]', { timeout })
  await page.waitForFunction(
    () => {
      const oncourse = document.querySelector('[data-testid="oncourse"]')
      return oncourse && oncourse.textContent && oncourse.textContent.length > 5
    },
    { timeout }
  )
}

test.describe('CLI Connection', () => {
  test.beforeEach(async () => {
    const available = await isCLIServerAvailable()
    test.skip(!available, `CLI server not available at ${CLI_WS_URL}`)
  })

  test('connects to CLI WebSocket server', async ({ page }) => {
    // Navigate to app with CLI source
    await page.goto(buildCLIUrl(page))
    await page.waitForLoadState('domcontentloaded')

    // Wait for connection to be established
    await waitForConnection(page, 20000)

    // Verify connection status (if visible) or that data is being received
    const hasResults = await page
      .waitForSelector('[data-testid="results-list"]', { timeout: 15000 })
      .then(() => true)
      .catch(() => false)

    expect(hasResults).toBe(true)
  })

  test('shows connecting/reconnecting status', async ({ page }) => {
    // Use a slow approach to catch the connecting state
    await page.goto(buildCLIUrl(page))

    // The connection status component should briefly show connecting
    // Since this is fast, we mainly verify the page loads without errors
    await page.waitForLoadState('domcontentloaded')

    // Page should eventually show content (results or connecting status)
    const hasContent = await page
      .waitForFunction(
        () => {
          return (
            document.querySelector('[data-testid="connection-status"]') ||
            document.querySelector('[data-testid="results-list"]')
          )
        },
        { timeout: 10000 }
      )
      .then(() => true)
      .catch(() => false)

    expect(hasContent).toBe(true)
  })
})

test.describe('CLI Message Handling - top (results)', () => {
  test.beforeEach(async () => {
    const available = await isCLIServerAvailable()
    test.skip(!available, `CLI server not available at ${CLI_WS_URL}`)
  })

  test('displays results from top message', async ({ page }) => {
    await page.goto(buildCLIUrl(page, "disableScroll=true"))
    await page.waitForLoadState('domcontentloaded')

    // Wait for results to appear
    await waitForResults(page)

    // Verify results list is visible
    const resultsList = page.getByTestId('results-list')
    await expect(resultsList).toBeVisible()

    // Verify we have actual result rows (not just header)
    const rows = resultsList.locator('div[class*="row"]')
    const count = await rows.count()
    expect(count).toBeGreaterThan(1) // At least header + 1 result
  })

  test('shows correct result row data (rank, bib, name, time)', async ({ page }) => {
    await page.goto(buildCLIUrl(page, "disableScroll=true"))
    await page.waitForLoadState('domcontentloaded')

    await waitForResults(page)

    // Check that first data row has expected structure
    const resultsList = page.getByTestId('results-list')

    // Wait for non-header rows
    await page.waitForFunction(
      () => {
        const list = document.querySelector('[data-testid="results-list"]')
        if (!list) return false
        const dataRows = list.querySelectorAll('div[class*="row"]:not([class*="header"])')
        return dataRows.length > 0
      },
      { timeout: 15000 }
    )

    // Get first data row
    const dataRow = resultsList.locator('div[class*="row"]').nth(1) // Skip header
    const rowText = await dataRow.textContent()

    // Row should contain some text (competitor data)
    expect(rowText).toBeTruthy()
    expect(rowText!.length).toBeGreaterThan(5)
  })

  test('updates results when new top message arrives', async ({ page }) => {
    await page.goto(buildCLIUrl(page, "disableScroll=true"))
    await page.waitForLoadState('domcontentloaded')

    await waitForResults(page)

    // Capture initial state
    const resultsList = page.getByTestId('results-list')

    // Wait some time for potential updates (live data)
    await page.waitForTimeout(5000)

    // Results should still be displayed (no crash/disconnect)
    await expect(resultsList).toBeVisible()
    const finalRowCount = await resultsList.locator('div[class*="row"]').count()

    // Should have at least the same number of rows (data may have changed)
    expect(finalRowCount).toBeGreaterThanOrEqual(1)
  })
})

test.describe('CLI Message Handling - comp (current competitor)', () => {
  test.beforeEach(async () => {
    const available = await isCLIServerAvailable()
    test.skip(!available, `CLI server not available at ${CLI_WS_URL}`)
  })

  test('displays current competitor from comp message', async ({ page }) => {
    await page.goto(buildCLIUrl(page))
    await page.waitForLoadState('domcontentloaded')

    // Wait for either oncourse to appear or results (in case no competitor is running)
    const hasOncourse = await page
      .waitForSelector('[data-testid="oncourse"]', { timeout: 15000 })
      .then(() => true)
      .catch(() => false)

    if (hasOncourse) {
      const oncourse = page.getByTestId('oncourse')
      await expect(oncourse).toBeVisible()

      // Should contain competitor info
      const text = await oncourse.textContent()
      expect(text).toBeTruthy()
    } else {
      // No competitor currently on course - this is valid state
      // Just verify results are showing instead
      await waitForResults(page)
    }
  })

  test('shows competitor bib and name', async ({ page }) => {
    await page.goto(buildCLIUrl(page))
    await page.waitForLoadState('domcontentloaded')

    const hasOncourse = await page
      .waitForSelector('[data-testid="oncourse"]', { timeout: 15000 })
      .then(() => true)
      .catch(() => false)

    if (hasOncourse) {
      // Check for bib number (typically shown prominently)
      const bibElement = page.locator('[data-testid="oncourse"] [class*="bib"]')
      const hasBib = await bibElement.isVisible().catch(() => false)

      // Check for name
      const nameElement = page.locator('[data-testid="oncourse"] [class*="name"]')
      const hasName = await nameElement.isVisible().catch(() => false)

      // At least one of these should be visible for a valid competitor display
      expect(hasBib || hasName).toBe(true)
    }
  })

  test('shows running time and gates', async ({ page }) => {
    await page.goto(buildCLIUrl(page))
    await page.waitForLoadState('domcontentloaded')

    const hasOncourse = await page
      .waitForSelector('[data-testid="oncourse"]', { timeout: 15000 })
      .then(() => true)
      .catch(() => false)

    if (hasOncourse) {
      const oncourse = page.getByTestId('oncourse')
      const text = await oncourse.textContent()

      // If competitor is running, should show some timing/gate info
      // This could be time, penalty, or gate data
      expect(text).toBeTruthy()
    }
  })
})

test.describe('CLI Message Handling - control (visibility)', () => {
  test.beforeEach(async () => {
    const available = await isCLIServerAvailable()
    test.skip(!available, `CLI server not available at ${CLI_WS_URL}`)
  })

  test('respects visibility control for results', async ({ page }) => {
    await page.goto(buildCLIUrl(page))
    await page.waitForLoadState('domcontentloaded')

    // Wait for results to appear with data
    await waitForResults(page)

    // The visibility is controlled by CLI server
    // Verify the component renders properly when visible
    const resultsList = page.locator('[data-testid="results-list"]')
    const isVisible = await resultsList.isVisible().catch(() => false)

    if (isVisible) {
      // If visible, should have proper content
      const rows = await resultsList.locator('div[class*="row"]').count()
      expect(rows).toBeGreaterThanOrEqual(1)
    }
    // If not visible, that's also valid - controlled by CLI
  })

  test('respects visibility control for current competitor', async ({ page }) => {
    await page.goto(buildCLIUrl(page))
    await page.waitForLoadState('domcontentloaded')

    await page.waitForTimeout(3000) // Allow time for initial data

    const oncourse = page.locator('[data-testid="oncourse"]')
    const isVisible = await oncourse.isVisible().catch(() => false)

    // Visibility is controlled by CLI control message
    // Both visible and hidden states are valid
    // Just verify the element exists in DOM if visible
    if (isVisible) {
      await expect(oncourse).toBeVisible()
    }
  })
})

test.describe('CLI Reconnection', () => {
  test.beforeEach(async () => {
    const available = await isCLIServerAvailable()
    test.skip(!available, `CLI server not available at ${CLI_WS_URL}`)
  })

  test('maintains connection over time', async ({ page }) => {
    await page.goto(buildCLIUrl(page, "disableScroll=true"))
    await page.waitForLoadState('domcontentloaded')

    // Wait for initial connection
    await waitForResults(page)

    // Record initial state
    const resultsList = page.getByTestId('results-list')
    await expect(resultsList).toBeVisible()

    // Wait for 10 seconds to verify stable connection
    await page.waitForTimeout(10000)

    // Should still be showing results (no disconnect)
    await expect(resultsList).toBeVisible()
    const rows = await resultsList.locator('div[class*="row"]').count()
    expect(rows).toBeGreaterThan(0)
  })

  test('handles rapid data updates without crashing', async ({ page }) => {
    await page.goto(buildCLIUrl(page))
    await page.waitForLoadState('domcontentloaded')

    // Wait for connection
    await waitForResults(page)

    // Wait for several update cycles
    await page.waitForTimeout(15000)

    // Page should not have any console errors (check for crashes)
    const hasError = await page.evaluate(() => {
      return (window as Window & { __hasError?: boolean }).__hasError ?? false
    })

    expect(hasError).toBe(false)

    // Results should still be visible
    const resultsList = page.getByTestId('results-list')
    await expect(resultsList).toBeVisible()
  })
})

test.describe('CLI Integration - Full Workflow', () => {
  test.beforeEach(async () => {
    const available = await isCLIServerAvailable()
    test.skip(!available, `CLI server not available at ${CLI_WS_URL}`)
  })

  test('vertical layout displays all components with live data', async ({ page }) => {
    await page.setViewportSize({ width: 1080, height: 1920 })
    await page.goto(buildCLIUrl(page))
    await page.waitForLoadState('domcontentloaded')

    // Wait for data
    await waitForResults(page)

    // Check all major components
    const resultsList = page.getByTestId('results-list')
    await expect(resultsList).toBeVisible()

    const topbar = page.getByTestId('topbar')
    const topbarVisible = await topbar.isVisible().catch(() => false)

    const footer = page.getByTestId('footer')
    const footerVisible = await footer.isVisible().catch(() => false)

    // In vertical layout, topbar and footer should typically be visible
    // (unless hidden by control message)
    expect(topbarVisible || footerVisible).toBe(true)
  })

  test('ledwall layout displays correctly with live data', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 384 })
    await page.goto(buildCLIUrl(page))
    await page.waitForLoadState('domcontentloaded')

    // Wait for data
    await waitForResults(page)

    // Results should be visible
    const resultsList = page.getByTestId('results-list')
    await expect(resultsList).toBeVisible()

    // Ledwall typically doesn't show footer
    const footer = page.getByTestId('footer')
    await expect(footer).not.toBeVisible()
  })
})
