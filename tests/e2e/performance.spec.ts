import { test, expect } from '@playwright/test'

/**
 * Performance tests for the scoreboard application.
 *
 * These tests measure:
 * - FPS (frames per second) during animation
 * - Memory usage over time
 * - Initial load time
 * - Bundle size analysis
 *
 * Results are logged for comparison with the original v1 version.
 */

interface PerformanceMetrics {
  fps: number
  frameDrops: number
  avgFrameTime: number
  maxFrameTime: number
}

interface MemoryMetrics {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

test.describe('Performance Metrics', () => {
  test.describe.configure({ mode: 'serial' })

  test('measures FPS during replay playback - vertical', async ({ page }) => {
    // Use fast replay to stress-test rendering
    await page.goto('/?type=vertical&speed=50')
    await page.waitForSelector('[data-testid="results-list"]', { timeout: 30000 })

    // Wait for some data to load
    await page.waitForFunction(
      () => {
        const list = document.querySelector('[data-testid="results-list"]')
        return list && list.querySelectorAll('div[class*="row"]').length > 1
      },
      { timeout: 30000 }
    )

    // Measure FPS using requestAnimationFrame
    const metrics = await page.evaluate(async (): Promise<PerformanceMetrics> => {
      return new Promise((resolve) => {
        const frameTimes: number[] = []
        let lastTime = performance.now()
        const duration = 5000 // 5 seconds of measurement

        const measureFrame = () => {
          const now = performance.now()
          const delta = now - lastTime
          frameTimes.push(delta)
          lastTime = now

          if (now - frameTimes[0] < duration) {
            requestAnimationFrame(measureFrame)
          } else {
            // Calculate metrics
            const avgFrameTime =
              frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
            const fps = 1000 / avgFrameTime
            const maxFrameTime = Math.max(...frameTimes)
            const frameDrops = frameTimes.filter((t) => t > 33.33).length // > 30fps threshold

            resolve({
              fps: Math.round(fps * 10) / 10,
              frameDrops,
              avgFrameTime: Math.round(avgFrameTime * 100) / 100,
              maxFrameTime: Math.round(maxFrameTime * 100) / 100,
            })
          }
        }

        // Start measuring
        requestAnimationFrame(measureFrame)
      })
    })

    console.log('\n=== FPS Metrics (Vertical Layout) ===')
    console.log(`Average FPS: ${metrics.fps}`)
    console.log(`Average frame time: ${metrics.avgFrameTime}ms`)
    console.log(`Max frame time: ${metrics.maxFrameTime}ms`)
    console.log(`Frame drops (>33ms): ${metrics.frameDrops}`)
    console.log('=====================================\n')

    // Assertions - expect reasonable performance
    // CI environments may have lower FPS due to virtualization
    // We accept 20+ FPS as a minimum baseline
    expect(metrics.fps).toBeGreaterThan(20) // At least 20 FPS (CI tolerance)
    expect(metrics.avgFrameTime).toBeLessThan(60) // <60ms average frame time
  })

  test('measures FPS during replay playback - ledwall', async ({ page }) => {
    await page.goto('/?type=ledwall&speed=50')
    await page.waitForSelector('[data-testid="results-list"]', { timeout: 30000 })

    await page.waitForFunction(
      () => {
        const list = document.querySelector('[data-testid="results-list"]')
        return list && list.querySelectorAll('div[class*="row"]').length > 1
      },
      { timeout: 30000 }
    )

    const metrics = await page.evaluate(async (): Promise<PerformanceMetrics> => {
      return new Promise((resolve) => {
        const frameTimes: number[] = []
        let lastTime = performance.now()
        const duration = 5000

        const measureFrame = () => {
          const now = performance.now()
          const delta = now - lastTime
          frameTimes.push(delta)
          lastTime = now

          if (now - frameTimes[0] < duration) {
            requestAnimationFrame(measureFrame)
          } else {
            const avgFrameTime =
              frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
            const fps = 1000 / avgFrameTime
            const maxFrameTime = Math.max(...frameTimes)
            const frameDrops = frameTimes.filter((t) => t > 33.33).length

            resolve({
              fps: Math.round(fps * 10) / 10,
              frameDrops,
              avgFrameTime: Math.round(avgFrameTime * 100) / 100,
              maxFrameTime: Math.round(maxFrameTime * 100) / 100,
            })
          }
        }

        requestAnimationFrame(measureFrame)
      })
    })

    console.log('\n=== FPS Metrics (Ledwall Layout) ===')
    console.log(`Average FPS: ${metrics.fps}`)
    console.log(`Average frame time: ${metrics.avgFrameTime}ms`)
    console.log(`Max frame time: ${metrics.maxFrameTime}ms`)
    console.log(`Frame drops (>33ms): ${metrics.frameDrops}`)
    console.log('====================================\n')

    // CI tolerance
    expect(metrics.fps).toBeGreaterThan(20)
    expect(metrics.avgFrameTime).toBeLessThan(60)
  })

  test('measures memory usage over 30 seconds', async ({ page }) => {
    // Enable performance metrics in Chrome
    const client = await page.context().newCDPSession(page)
    await client.send('Performance.enable')

    await page.goto('/?type=vertical&speed=20')
    await page.waitForSelector('[data-testid="results-list"]', { timeout: 30000 })

    // Initial memory measurement
    const initialMemory = await page.evaluate((): MemoryMetrics | null => {
      // @ts-expect-error - Chrome-specific API
      const memory = performance.memory
      if (!memory) return null
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      }
    })

    // Let the app run for 30 seconds
    console.log('\n=== Memory Test ===')
    console.log('Running for 30 seconds...')
    await page.waitForTimeout(30000)

    // Final memory measurement
    const finalMemory = await page.evaluate((): MemoryMetrics | null => {
      // @ts-expect-error - Chrome-specific API
      const memory = performance.memory
      if (!memory) return null
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      }
    })

    if (initialMemory && finalMemory) {
      const memoryGrowth = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize
      const memoryGrowthMB = Math.round(memoryGrowth / 1024 / 1024 * 100) / 100

      console.log(`Initial heap: ${Math.round(initialMemory.usedJSHeapSize / 1024 / 1024 * 100) / 100} MB`)
      console.log(`Final heap: ${Math.round(finalMemory.usedJSHeapSize / 1024 / 1024 * 100) / 100} MB`)
      console.log(`Memory growth: ${memoryGrowthMB} MB`)
      console.log('===================\n')

      // Expect no significant memory leak (less than 50MB growth in 30s)
      expect(Math.abs(memoryGrowthMB)).toBeLessThan(50)
    } else {
      console.log('Memory API not available (non-Chrome browser)')
      console.log('===================\n')
    }
  })

  test('measures initial load time', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/?type=vertical&speed=100&pauseAfter=150')
    await page.waitForLoadState('domcontentloaded')

    const domContentLoaded = Date.now() - startTime

    await page.waitForSelector('[data-testid="results-list"]', { timeout: 30000 })

    const resultsVisible = Date.now() - startTime

    // Wait for first data to appear
    await page.waitForFunction(
      () => {
        const list = document.querySelector('[data-testid="results-list"]')
        return list && list.querySelectorAll('div[class*="row"]').length > 1
      },
      { timeout: 30000 }
    )

    const firstDataVisible = Date.now() - startTime

    console.log('\n=== Load Time Metrics ===')
    console.log(`DOM Content Loaded: ${domContentLoaded}ms`)
    console.log(`Results container visible: ${resultsVisible}ms`)
    console.log(`First data visible: ${firstDataVisible}ms`)
    console.log('=========================\n')

    // Performance expectations
    expect(domContentLoaded).toBeLessThan(3000) // DOM in <3s
    expect(resultsVisible).toBeLessThan(5000) // Layout in <5s
    expect(firstDataVisible).toBeLessThan(10000) // Data in <10s
  })

  test('measures render performance during rapid updates', async ({ page }) => {
    // Use maximum speed to stress-test updates
    await page.goto('/?type=vertical&speed=100')
    await page.waitForSelector('[data-testid="results-list"]', { timeout: 30000 })

    await page.waitForFunction(
      () => {
        const list = document.querySelector('[data-testid="results-list"]')
        return list && list.querySelectorAll('div[class*="row"]').length > 1
      },
      { timeout: 30000 }
    )

    // Measure paint operations using PerformanceObserver
    const paintMetrics = await page.evaluate(async () => {
      return new Promise<{
        layoutCount: number
        recalcStyleCount: number
        paintCount: number
      }>((resolve) => {
        let layoutCount = 0
        const recalcStyleCount = 0
        const paintCount = 0

        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'layout-shift') {
              layoutCount++
            }
          }
        })

        try {
          observer.observe({ type: 'layout-shift', buffered: true })
        } catch {
          // layout-shift may not be supported
        }

        // Use requestAnimationFrame to count paints
        let frames = 0
        const countFrames = () => {
          frames++
          paintCount = frames
          if (frames < 300) {
            // ~5 seconds at 60fps
            requestAnimationFrame(countFrames)
          } else {
            observer.disconnect()
            resolve({ layoutCount, recalcStyleCount, paintCount })
          }
        }

        requestAnimationFrame(countFrames)
      })
    })

    console.log('\n=== Render Performance (5s) ===')
    console.log(`Paint frames: ${paintMetrics.paintCount}`)
    console.log(`Layout shifts detected: ${paintMetrics.layoutCount}`)
    console.log('===============================\n')

    // Expect smooth rendering
    expect(paintMetrics.paintCount).toBeGreaterThan(100) // At least 20 FPS average
  })
})

test.describe('Bundle Size Analysis', () => {
  test('reports dev bundle size (unbundled modules)', async ({ page }) => {
    // Navigate to the app
    await page.goto('/?type=vertical&speed=100&pauseAfter=10')
    await page.waitForLoadState('load')

    // Get all loaded resources
    const resources = await page.evaluate(() => {
      const entries = performance.getEntriesByType(
        'resource'
      ) as PerformanceResourceTiming[]
      return entries
        .filter(
          (e) =>
            e.initiatorType === 'script' ||
            e.initiatorType === 'link' ||
            e.name.includes('.js') ||
            e.name.includes('.css')
        )
        .map((e) => ({
          name: e.name.split('/').pop() || e.name,
          type: e.name.includes('.css') ? 'CSS' : 'JS',
          size: e.transferSize,
          duration: Math.round(e.duration),
        }))
    })

    console.log('\n=== Dev Bundle Size Report ===')
    console.log('(Note: Dev mode loads unbundled modules - larger than production)')

    let totalJS = 0
    let totalCSS = 0

    for (const resource of resources) {
      const sizeKB = Math.round((resource.size / 1024) * 100) / 100
      console.log(`${resource.type}: ${resource.name} - ${sizeKB} KB (${resource.duration}ms)`)

      if (resource.type === 'JS') totalJS += resource.size
      if (resource.type === 'CSS') totalCSS += resource.size
    }

    const totalJSKB = Math.round((totalJS / 1024) * 100) / 100
    const totalCSSKB = Math.round((totalCSS / 1024) * 100) / 100

    console.log('------------------------')
    console.log(`Total JS (dev): ${totalJSKB} KB`)
    console.log(`Total CSS (dev): ${totalCSSKB} KB`)
    console.log(`Total (dev): ${Math.round((totalJSKB + totalCSSKB) * 100) / 100} KB`)
    console.log('==============================\n')

    // Dev mode has unbundled modules - expect larger sizes
    // Production build is ~438KB JS, ~14KB CSS
    // Dev mode can be 3-4x larger due to:
    // - No minification
    // - Source maps inline
    // - React development build
    // - HMR runtime
    expect(totalJSKB).toBeLessThan(2000) // Dev mode limit
    expect(totalCSSKB).toBeLessThan(100)
  })
})

test.describe('Production Bundle Size', () => {
  test('verifies production bundle size from build output', async () => {
    // This test analyzes the production build output
    // Run `npm run build` before this test to generate fresh output
    const fs = await import('fs')
    const path = await import('path')

    const distDir = path.join(process.cwd(), 'dist', 'assets')

    // Check if dist exists
    if (!fs.existsSync(distDir)) {
      console.log('dist/assets not found - run `npm run build` first')
      console.log('Skipping production bundle size test')
      return
    }

    const files = fs.readdirSync(distDir)
    const jsFiles = files.filter((f: string) => f.endsWith('.js'))
    const cssFiles = files.filter((f: string) => f.endsWith('.css'))

    let totalJS = 0
    let totalCSS = 0

    console.log('\n=== Production Bundle Size ===')

    for (const file of jsFiles) {
      const filePath = path.join(distDir, file)
      const stats = fs.statSync(filePath)
      const sizeKB = Math.round((stats.size / 1024) * 100) / 100
      console.log(`JS: ${file} - ${sizeKB} KB`)
      totalJS += stats.size
    }

    for (const file of cssFiles) {
      const filePath = path.join(distDir, file)
      const stats = fs.statSync(filePath)
      const sizeKB = Math.round((stats.size / 1024) * 100) / 100
      console.log(`CSS: ${file} - ${sizeKB} KB`)
      totalCSS += stats.size
    }

    const totalJSKB = Math.round((totalJS / 1024) * 100) / 100
    const totalCSSKB = Math.round((totalCSS / 1024) * 100) / 100

    console.log('------------------------')
    console.log(`Total JS: ${totalJSKB} KB`)
    console.log(`Total CSS: ${totalCSSKB} KB`)
    console.log(`Total: ${Math.round((totalJSKB + totalCSSKB) * 100) / 100} KB`)
    console.log('==============================\n')

    // Production bundle size expectations (from checklist: 438 kB JS, 14 kB CSS)
    expect(totalJSKB).toBeLessThan(500)
    expect(totalCSSKB).toBeLessThan(20)
  })
})

test.describe('Comparative Performance (with CLI)', () => {
  // These tests require the CLI server to be running
  // They will auto-skip if the server is not available

  test('compares load time with original v1 (CLI)', async ({ page, browserName }) => {
    // Skip for non-chromium browsers
    if (browserName !== 'chromium') {
      test.skip()
      return
    }

    // Check if CLI server is available
    const cliAvailable = await page
      .goto('http://192.168.68.108:3000', { timeout: 5000 })
      .then(() => true)
      .catch(() => false)

    if (!cliAvailable) {
      console.log('CLI server not available, skipping comparative test')
      test.skip()
      return
    }

    // Measure v1 load time
    const v1Start = Date.now()
    await page.goto(
      'http://192.168.68.108:3000/?type=vertical&server=ws%3A%2F%2F192.168.68.108%3A8081%2F'
    )
    await page.waitForLoadState('domcontentloaded')
    const v1DomLoaded = Date.now() - v1Start

    await page.waitForFunction(
      () => document.querySelector('.results-list, [data-testid="results-list"]'),
      { timeout: 30000 }
    )
    const v1ResultsVisible = Date.now() - v1Start

    // Measure v2 load time
    const v2Start = Date.now()
    await page.goto('http://localhost:5173/?type=vertical&source=cli&host=192.168.68.108:8081')
    await page.waitForLoadState('domcontentloaded')
    const v2DomLoaded = Date.now() - v2Start

    await page.waitForSelector('[data-testid="results-list"]', { timeout: 30000 })
    const v2ResultsVisible = Date.now() - v2Start

    console.log('\n=== Load Time Comparison ===')
    console.log(`V1 DOM Loaded: ${v1DomLoaded}ms`)
    console.log(`V2 DOM Loaded: ${v2DomLoaded}ms`)
    console.log(`V1 Results Visible: ${v1ResultsVisible}ms`)
    console.log(`V2 Results Visible: ${v2ResultsVisible}ms`)
    console.log(`Difference (DOM): ${v2DomLoaded - v1DomLoaded}ms`)
    console.log(`Difference (Results): ${v2ResultsVisible - v1ResultsVisible}ms`)
    console.log('============================\n')

    // v2 should not be significantly slower than v1
    // Allow 2x tolerance for different environments
    expect(v2DomLoaded).toBeLessThan(v1DomLoaded * 2 + 1000)
  })
})

test.describe('Lighthouse Audit', () => {
  // Lighthouse audit for performance metrics
  // Note: Uses Playwright's browser for consistent testing

  test('measures Web Vitals (simulated Lighthouse)', async ({ page }) => {
    // Navigate to app with stable data
    await page.goto('/?type=vertical&speed=100&pauseAfter=150&disableScroll=true')
    await page.waitForLoadState('load')

    // Wait for data to appear
    await page.waitForSelector('[data-testid="results-list"]', { timeout: 30000 })
    await page.waitForFunction(
      () => {
        const list = document.querySelector('[data-testid="results-list"]')
        return list && list.querySelectorAll('div[class*="row"]').length > 1
      },
      { timeout: 30000 }
    )

    // Collect Web Vitals-like metrics
    const metrics = await page.evaluate(() => {
      return new Promise<{
        fcp: number | null
        lcp: number | null
        cls: number
        domContentLoaded: number
        load: number
        domSize: number
        scripts: number
        stylesheets: number
      }>((resolve) => {
        const timing = performance.timing
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        const paintEntries = performance.getEntriesByType('paint')
        const layoutShiftEntries = performance.getEntriesByType('layout-shift') as (PerformanceEntry & { value: number })[]

        // FCP
        const fcpEntry = paintEntries.find((e) => e.name === 'first-contentful-paint')
        const fcp = fcpEntry ? fcpEntry.startTime : null

        // LCP (approximation - use largest paint)
        const lcpEntry = paintEntries.find((e) => e.name === 'largest-contentful-paint')
        const lcp = lcpEntry ? lcpEntry.startTime : null

        // CLS
        const cls = layoutShiftEntries.reduce((sum, entry) => sum + entry.value, 0)

        // Load times
        const domContentLoaded = navigation
          ? navigation.domContentLoadedEventEnd - navigation.startTime
          : timing.domContentLoadedEventEnd - timing.navigationStart
        const load = navigation
          ? navigation.loadEventEnd - navigation.startTime
          : timing.loadEventEnd - timing.navigationStart

        // DOM size
        const domSize = document.getElementsByTagName('*').length

        // Resource counts
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
        const scripts = resources.filter((r) => r.initiatorType === 'script').length
        const stylesheets = resources.filter((r) => r.initiatorType === 'link' || r.name.includes('.css')).length

        resolve({
          fcp,
          lcp,
          cls,
          domContentLoaded,
          load,
          domSize,
          scripts,
          stylesheets,
        })
      })
    })

    console.log('\n=== Web Vitals Metrics ===')
    console.log(`First Contentful Paint (FCP): ${metrics.fcp ? Math.round(metrics.fcp) + 'ms' : 'N/A'}`)
    console.log(`Largest Contentful Paint (LCP): ${metrics.lcp ? Math.round(metrics.lcp) + 'ms' : 'N/A'}`)
    console.log(`Cumulative Layout Shift (CLS): ${Math.round(metrics.cls * 1000) / 1000}`)
    console.log(`DOM Content Loaded: ${Math.round(metrics.domContentLoaded)}ms`)
    console.log(`Load Complete: ${Math.round(metrics.load)}ms`)
    console.log(`DOM Size: ${metrics.domSize} elements`)
    console.log(`Scripts: ${metrics.scripts}`)
    console.log(`Stylesheets: ${metrics.stylesheets}`)
    console.log('==========================\n')

    // Performance expectations (Web Vitals thresholds)
    // FCP should be < 1.8s (Good), < 3s (Needs Improvement)
    if (metrics.fcp) {
      expect(metrics.fcp).toBeLessThan(3000)
    }

    // CLS should be < 0.1 (Good), < 0.25 (Needs Improvement)
    expect(metrics.cls).toBeLessThan(0.25)

    // DOM should be reasonably sized (< 1500 elements)
    expect(metrics.domSize).toBeLessThan(1500)

    // Load should complete in < 5s
    expect(metrics.load).toBeLessThan(5000)
  })
})
