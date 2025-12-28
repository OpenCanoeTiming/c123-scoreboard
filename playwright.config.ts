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
      // Default threshold for visual comparison
      maxDiffPixelRatio: 0.01,
    },
  },

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'vertical',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1080, height: 1920 },
      },
      expect: {
        toHaveScreenshot: {
          maxDiffPixels: 100, // Tolerance for vertical
        },
      },
    },
    {
      name: 'ledwall',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 384 },
      },
      expect: {
        toHaveScreenshot: {
          maxDiffPixels: 50, // Tolerance for ledwall
        },
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
