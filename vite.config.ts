import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf-8')
) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base URL for deployment - relative by default so the build can be served
  // from any subdirectory. Override with VITE_BASE_URL if an absolute base is needed.
  // Usage: VITE_BASE_URL=/scoreboard/ npm run build
  base: process.env.VITE_BASE_URL || './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    // Generate source maps for production debugging
    sourcemap: false,
    // Optimize chunk size
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor'
          }
        },
      },
    },
  },
})
