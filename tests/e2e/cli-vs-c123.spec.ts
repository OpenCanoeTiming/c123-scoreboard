import { test, expect, Page } from '@playwright/test'
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

/**
 * Visual Comparison Test: CLI Provider vs C123Server Provider
 *
 * This test compares the visual output of the scoreboard when connected to:
 * 1. CLI Provider (via mock WebSocket server replaying CLI messages)
 * 2. C123ServerProvider (via C123 Server connected to mock TCP replaying Canoe123 data)
 *
 * Both use the same recording file as source data.
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  Mock CLI WS (port 8091)      Mock TCP (port 27334)                 │
 * │       ↓                              ↓                              │
 * │  Scoreboard (CLI)             C123 Server (port 27124)              │
 * │  localhost:5173               ↓                                     │
 * │  ?source=cli&host=...         Scoreboard (C123)                     │
 * │                               localhost:5173                        │
 * │                               ?server=localhost:27124               │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Run with: npx playwright test cli-vs-c123.spec.ts --project=vertical
 */

// ES module directory resolution
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Test configuration
const PROJECT_ROOT = path.resolve(__dirname, '../..')
const RECORDING_PATH = path.resolve(PROJECT_ROOT, '../analysis/recordings/rec-2025-12-28T09-34-10.jsonl')
const SCREENSHOT_DIR = path.join(__dirname, 'cli-vs-c123-screenshots')

// Ports
const CLI_WS_PORT = 8091
const TCP_PORT = 27334
const C123_SERVER_PORT = 27124

// URLs - Note: V3 uses server=host:port, the app auto-probes to detect CLI vs C123 Server
const CLI_URL_VERTICAL = `http://localhost:5173/?type=vertical&server=localhost:${CLI_WS_PORT}&disableScroll=true`
const C123_URL_VERTICAL = `http://localhost:5173/?type=vertical&server=localhost:${C123_SERVER_PORT}&disableScroll=true`
const CLI_URL_LEDWALL = `http://localhost:5173/?type=ledwall&server=localhost:${CLI_WS_PORT}&disableScroll=true`
const C123_URL_LEDWALL = `http://localhost:5173/?type=ledwall&server=localhost:${C123_SERVER_PORT}&disableScroll=true`

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

/**
 * Check if recording file exists
 */
function isRecordingAvailable(): boolean {
  return fs.existsSync(RECORDING_PATH)
}

/**
 * Check if C123 Server project is available
 */
function isC123ServerProjectAvailable(): boolean {
  const c123Path = path.resolve(PROJECT_ROOT, '../c123-server')
  return fs.existsSync(c123Path) && fs.existsSync(path.join(c123Path, 'package.json'))
}

/**
 * Wait for process output to contain a string
 */
function waitForOutput(proc: ChildProcess, searchStr: string, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for "${searchStr}"`))
    }, timeoutMs)

    const check = (data: Buffer) => {
      const text = data.toString()
      if (text.includes(searchStr)) {
        clearTimeout(timeout)
        proc.stdout?.off('data', check)
        resolve()
      }
    }

    proc.stdout?.on('data', check)
    proc.stderr?.on('data', (data) => {
      // Log but don't fail on stderr
      console.error(`[stderr] ${data.toString().trim()}`)
    })
  })
}

/**
 * Wait for scoreboard to load with data
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
 * Delay helper
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

test.describe('CLI vs C123Server Visual Comparison', () => {
  // Run tests serially to share mock servers
  test.describe.configure({ mode: 'serial' })

  // Prerequisites check
  const recordingExists = isRecordingAvailable()
  const c123Available = isC123ServerProjectAvailable()
  const canRun = recordingExists && c123Available

  // Child processes (shared across tests)
  let mockCliWs: ChildProcess | null = null
  let mockTcp: ChildProcess | null = null
  let c123Server: ChildProcess | null = null
  let serversStarted = false

  test.beforeAll(async () => {
    // Guard: Only start servers once
    if (serversStarted) {
      console.log('Servers already started, skipping...')
      return
    }

    if (!canRun) {
      console.warn(`
        ⚠️  CLI vs C123 comparison tests require:
        - Recording file: ${recordingExists ? '✓' : '✗'} (${RECORDING_PATH})
        - C123 Server project: ${c123Available ? '✓' : '✗'}
      `)
      return
    }

    // Kill any stale processes from previous test runs
    console.log('\n=== Cleaning up stale processes ===')
    const { execSync } = await import('child_process')
    try {
      // Kill processes listening on our test ports
      execSync(`fuser -k ${CLI_WS_PORT}/tcp ${TCP_PORT}/tcp ${C123_SERVER_PORT}/tcp 2>/dev/null || true`, { stdio: 'ignore' })
      // Small delay to allow ports to be released
      await delay(500)
    } catch {
      // Ignore errors - ports might already be free
    }

    console.log('\n=== Starting mock servers ===')
    console.log(`Recording: ${RECORDING_PATH}`)

    // 1. Start mock CLI WebSocket server with --loop for multiple test requests
    console.log('Starting Mock CLI WS server...')
    mockCliWs = spawn(
      'npx',
      ['tsx', 'scripts/mock-cli-ws.ts', '--file', RECORDING_PATH, '--port', String(CLI_WS_PORT), '--speed', '0', '--loop'],
      { cwd: PROJECT_ROOT, stdio: 'pipe' }
    )

    // 2. Start mock Canoe123 TCP server with --loop for multiple connections
    console.log('Starting Mock TCP server...')
    mockTcp = spawn(
      'npx',
      ['tsx', 'scripts/mock-c123-tcp.ts', '--file', RECORDING_PATH, '--port', String(TCP_PORT), '--speed', '0', '--loop'],
      { cwd: PROJECT_ROOT, stdio: 'pipe' }
    )

    // Wait for mock servers to be ready
    await Promise.all([
      waitForOutput(mockCliWs, 'Waiting for', 15000),
      waitForOutput(mockTcp, 'Waiting for', 15000),
    ])
    console.log('Mock servers ready')

    // 3. Start C123 Server
    console.log('Starting C123 Server...')
    const c123Path = path.resolve(PROJECT_ROOT, '../c123-server')
    c123Server = spawn(
      'node',
      ['dist/cli.js', '--host', 'localhost', '--port', String(TCP_PORT), '--server-port', String(C123_SERVER_PORT)],
      { cwd: c123Path, stdio: 'pipe' }
    )

    // Wait for C123 server to start
    try {
      await waitForOutput(c123Server, 'C123 Server started', 15000)
    } catch {
      console.log('C123 Server startup timeout - continuing anyway')
    }
    await delay(3000) // Extra time for connections

    serversStarted = true
    console.log('All servers started\n')
  }, 90000) // 90s timeout for setup

  test.afterAll(() => {
    console.log('\n=== Stopping servers ===')

    // Kill processes synchronously without waiting (faster cleanup)
    const killProcess = (proc: ChildProcess | null, name: string): void => {
      if (!proc || proc.killed || proc.exitCode !== null) return
      try {
        proc.kill('SIGKILL')
        console.log(`  ${name} killed`)
      } catch {
        // Ignore errors
      }
    }

    killProcess(mockCliWs, 'Mock CLI WS')
    killProcess(mockTcp, 'Mock TCP')
    killProcess(c123Server, 'C123 Server')

    mockCliWs = null
    mockTcp = null
    c123Server = null

    console.log('Cleanup complete\n')
  })

  test.skip(!canRun, 'Prerequisites not available')

  test('vertical layout - side by side comparison', async ({ page }) => {
    test.setTimeout(120000) // 2 min timeout for this test
    test.skip(!canRun, 'Prerequisites not available')

    await page.setViewportSize({ width: 1080, height: 1920 })

    // 1. Capture CLI screenshot
    console.log('Capturing CLI scoreboard...')
    await page.goto(CLI_URL_VERTICAL)
    await waitForDataLoad(page)
    const cliScreenshot = await page.screenshot({ fullPage: true })
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'cli-vertical.png'), cliScreenshot)

    // Get CLI data for comparison
    const cliRowCount = await page.locator('[data-testid="results-list"] div[class*="row"]').count()
    const cliRaceName = await page.locator('[data-testid="title"]').textContent().catch(() => 'N/A')

    console.log(`  CLI: ${cliRowCount} rows, race: ${cliRaceName}`)

    // 2. Capture C123 screenshot
    console.log('Capturing C123 scoreboard...')
    await page.goto(C123_URL_VERTICAL)
    await waitForDataLoad(page)
    const c123Screenshot = await page.screenshot({ fullPage: true })
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'c123-vertical.png'), c123Screenshot)

    // Get C123 data for comparison
    const c123RowCount = await page.locator('[data-testid="results-list"] div[class*="row"]').count()
    const c123RaceName = await page.locator('[data-testid="title"]').textContent().catch(() => 'N/A')

    console.log(`  C123: ${c123RowCount} rows, race: ${c123RaceName}`)

    // Save comparison report
    const report = {
      timestamp: new Date().toISOString(),
      cli: {
        url: CLI_URL_VERTICAL,
        rowCount: cliRowCount,
        raceName: cliRaceName,
      },
      c123: {
        url: C123_URL_VERTICAL,
        rowCount: c123RowCount,
        raceName: c123RaceName,
      },
    }
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'vertical-comparison.json'), JSON.stringify(report, null, 2))

    console.log(`\nScreenshots saved to ${SCREENSHOT_DIR}/`)
    console.log('  - cli-vertical.png')
    console.log('  - c123-vertical.png')
    console.log('  - vertical-comparison.json')

    // Both should have data
    expect(cliRowCount).toBeGreaterThan(1)
    expect(c123RowCount).toBeGreaterThan(1)
  })

  test('ledwall layout - side by side comparison', async ({ page }) => {
    test.skip(!canRun, 'Prerequisites not available')

    await page.setViewportSize({ width: 768, height: 384 })

    // 1. Capture CLI screenshot
    console.log('Capturing CLI ledwall...')
    await page.goto(CLI_URL_LEDWALL)
    await waitForDataLoad(page)
    const cliScreenshot = await page.screenshot({ fullPage: true })
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'cli-ledwall.png'), cliScreenshot)

    // 2. Capture C123 screenshot
    console.log('Capturing C123 ledwall...')
    await page.goto(C123_URL_LEDWALL)
    await waitForDataLoad(page)
    const c123Screenshot = await page.screenshot({ fullPage: true })
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'c123-ledwall.png'), c123Screenshot)

    console.log(`\nScreenshots saved to ${SCREENSHOT_DIR}/`)
    console.log('  - cli-ledwall.png')
    console.log('  - c123-ledwall.png')

    // Verify both loaded successfully
    const cliRowCount = await page.locator('[data-testid="results-list"] div[class*="row"]').count()
    expect(cliRowCount).toBeGreaterThan(0)
  })

  test('oncourse component comparison', async ({ page }) => {
    test.skip(!canRun, 'Prerequisites not available')

    await page.setViewportSize({ width: 1080, height: 1920 })

    // Capture oncourse from CLI
    console.log('Capturing CLI oncourse...')
    await page.goto(CLI_URL_VERTICAL)
    await waitForDataLoad(page)

    const cliOncourse = page.getByTestId('oncourse')
    const cliOncourseVisible = await cliOncourse.isVisible().catch(() => false)
    if (cliOncourseVisible) {
      const screenshot = await cliOncourse.screenshot()
      fs.writeFileSync(path.join(SCREENSHOT_DIR, 'cli-oncourse.png'), screenshot)
      const cliOncourseText = await cliOncourse.textContent()
      console.log(`  CLI oncourse: ${cliOncourseText?.substring(0, 50)}...`)
    } else {
      console.log('  CLI: No oncourse visible')
    }

    // Capture oncourse from C123
    console.log('Capturing C123 oncourse...')
    await page.goto(C123_URL_VERTICAL)
    await waitForDataLoad(page)

    const c123Oncourse = page.getByTestId('oncourse')
    const c123OncourseVisible = await c123Oncourse.isVisible().catch(() => false)
    if (c123OncourseVisible) {
      const screenshot = await c123Oncourse.screenshot()
      fs.writeFileSync(path.join(SCREENSHOT_DIR, 'c123-oncourse.png'), screenshot)
      const c123OncourseText = await c123Oncourse.textContent()
      console.log(`  C123 oncourse: ${c123OncourseText?.substring(0, 50)}...`)
    } else {
      console.log('  C123: No oncourse visible')
    }

    // Both should have same visibility state (both visible or both hidden)
    expect(c123OncourseVisible).toBe(cliOncourseVisible)
  })

  test('results list comparison', async ({ page }) => {
    test.skip(!canRun, 'Prerequisites not available')

    await page.setViewportSize({ width: 1080, height: 1920 })

    // Capture results from CLI
    console.log('Capturing CLI results...')
    await page.goto(CLI_URL_VERTICAL)
    await waitForDataLoad(page)

    const cliResults = page.getByTestId('results-list')
    const cliScreenshot = await cliResults.screenshot()
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'cli-results.png'), cliScreenshot)

    // Get first 3 result rows text for comparison
    const cliRows = await page.locator('[data-testid="results-list"] div[class*="row"]').allTextContents()
    console.log(`  CLI results (${cliRows.length} rows):`)
    cliRows.slice(0, 3).forEach((row, i) => console.log(`    ${i}: ${row.substring(0, 60)}...`))

    // Capture results from C123
    console.log('Capturing C123 results...')
    await page.goto(C123_URL_VERTICAL)
    await waitForDataLoad(page)

    const c123Results = page.getByTestId('results-list')
    const c123Screenshot = await c123Results.screenshot()
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'c123-results.png'), c123Screenshot)

    const c123Rows = await page.locator('[data-testid="results-list"] div[class*="row"]').allTextContents()
    console.log(`  C123 results (${c123Rows.length} rows):`)
    c123Rows.slice(0, 3).forEach((row, i) => console.log(`    ${i}: ${row.substring(0, 60)}...`))

    // Save detailed comparison
    const comparison = {
      timestamp: new Date().toISOString(),
      cli: { rowCount: cliRows.length, firstRows: cliRows.slice(0, 5) },
      c123: { rowCount: c123Rows.length, firstRows: c123Rows.slice(0, 5) },
    }
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'results-comparison.json'), JSON.stringify(comparison, null, 2))

    console.log(`\nDetailed comparison saved to ${SCREENSHOT_DIR}/results-comparison.json`)
  })
})
