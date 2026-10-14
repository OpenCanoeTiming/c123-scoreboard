import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// The harness lives outside src/, which the repo's vitest.config.ts does not include.
// Everything else mirrors that config.
const root = resolve(__dirname, '../..')

export default defineConfig({
  root,
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [resolve(root, 'src/test/setup.ts')],
    include: ['spike/s3/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': resolve(root, 'src'),
    },
  },
})
