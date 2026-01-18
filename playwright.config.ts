import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 60000, // 60s per test to allow for data loading

  expect: {
    toHaveScreenshot: {
      // Strict threshold for visual comparison - catch any visual differences
      maxDiffPixelRatio: 0.001, // 0.1% tolerance
      maxDiffPixels: 0, // No pixel differences allowed by default
    },
  },

  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    // Disable CSS animations for stable screenshots
    // This prevents "Failed to take two consecutive stable screenshots" errors
    launchOptions: {
      args: ['--force-prefers-reduced-motion'],
    },
  },

  projects: [
    {
      name: 'vertical',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1080, height: 1920 },
      },
      // Uses global strict threshold (0 pixels, 0.1% ratio)
    },
    {
      name: 'ledwall',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 384 },
      },
      // Uses global strict threshold (0 pixels, 0.1% ratio)
    },
  ],

  webServer: {
    command: 'npm run dev -- --port 5174',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
  },
})
