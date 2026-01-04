import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Exclude integration tests that require external processes (C123 Server, mock servers)
    // Run these with: npm run test:providers
    exclude: [
      '**/node_modules/**',
      'src/__tests__/provider-comparison.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
