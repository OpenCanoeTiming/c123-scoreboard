import { describe, expect, it } from 'vitest'
import { ESLint } from 'eslint'

// TEST-ARCHITECTURE §5 / CLIENT-OBLIGATIONS L120: outside src/clock, time is read only through the
// injected Clock. The lint rule enforces it in the folders that hold display-lifetime logic.

const eslint = new ESLint({ cwd: process.cwd() })
const TIMING_RULES = new Set(['no-restricted-globals', 'no-restricted-properties'])

const DIRECT_CALLS = [
  'Date.now()',
  'setTimeout(() => {}, 1)',
  'setInterval(() => {}, 1)',
  'requestAnimationFrame(() => {})',
  'performance.now()',
  'window.setTimeout(() => {}, 1)',
  'globalThis.requestAnimationFrame(() => {})',
]

async function timingErrorsIn(filePath: string, call: string): Promise<number> {
  const [result] = await eslint.lintText(`export const probe = () => ${call}\n`, { filePath })
  return result.messages.filter((m) => m.severity === 2 && m.ruleId !== null && TIMING_RULES.has(m.ruleId)).length
}

const timingErrors = (folder: string, call: string) => timingErrorsIn(`src/${folder}/probe.ts`, call)

describe('lint rule: no direct timer calls outside src/clock', () => {
  for (const folder of ['store', 'view', 'transport', 'fixture', 'hooks', 'components']) {
    it(`fails on every direct timer call in src/${folder}`, { timeout: 60_000 }, async () => {
      for (const call of DIRECT_CALLS) expect(await timingErrors(folder, call), call).toBeGreaterThan(0)
    })
  }

  it('fails on every direct timer call in src/App.tsx', { timeout: 60_000 }, async () => {
    for (const call of DIRECT_CALLS) expect(await timingErrorsIn('src/App.tsx', call), call).toBeGreaterThan(0)
  })

  it('allows them in src/clock', { timeout: 60_000 }, async () => {
    for (const call of DIRECT_CALLS) expect(await timingErrors('clock', call), call).toBe(0)
  })
})
