import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Allow exporting hooks and context from component files
      // Context files typically need to export Provider, hook, and context object
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    // TEST-ARCHITECTURE §5: time is read only through the injected Clock; only src/clock calls the real timers.
    files: ['src/{store,view,transport,fixture}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['setTimeout', 'setInterval', 'requestAnimationFrame'].map((name) => ({
          name,
          message: 'Use the injected Clock (src/clock), not the real timer.',
        })),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Use Clock.now() (src/clock).' },
        { object: 'performance', property: 'now', message: 'Use Clock.now() (src/clock).' },
        ...['window', 'globalThis', 'self'].flatMap((object) =>
          ['setTimeout', 'setInterval', 'requestAnimationFrame'].map((property) => ({
            object,
            property,
            message: 'Use the injected Clock (src/clock), not the real timer.',
          })),
        ),
      ],
    },
  },
])
