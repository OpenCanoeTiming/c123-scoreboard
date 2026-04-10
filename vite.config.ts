import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base URL for deployment - relative by default so the build can be served
  // from any subdirectory. Override with VITE_BASE_URL if an absolute base is needed.
  // Usage: VITE_BASE_URL=/scoreboard/ npm run build
  base: process.env.VITE_BASE_URL || './',
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
