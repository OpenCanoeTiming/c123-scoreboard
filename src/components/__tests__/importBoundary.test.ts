/**
 * View seam guard (#157).
 *
 * Components render a BoardView read through useBoardView(). They must not
 * reach past the seam into the legacy data path: the legacy types, the
 * providers, the race-id helpers or the scoreboard context. This test greps
 * every file under src/components/ (tests included) and fails on any import
 * that resolves into one of those places.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

const SRC = resolve(__dirname, '../..')
const COMPONENTS = join(SRC, 'components')

const FORBIDDEN = ['types', 'providers', 'utils/raceUtils', 'context']

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return listSourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

/** Module specifiers of static imports, re-exports and dynamic imports. */
function importSpecifiers(source: string): string[] {
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  return patterns.flatMap((re) => [...source.matchAll(re)].map((m) => m[1]))
}

/** Path of a specifier relative to src/, or null for packages. */
function resolveInSrc(file: string, specifier: string): string | null {
  let absolute: string
  if (specifier.startsWith('@/')) absolute = join(SRC, specifier.slice(2))
  else if (specifier.startsWith('.')) absolute = resolve(dirname(file), specifier)
  else if (specifier.startsWith('src/')) absolute = join(SRC, '..', specifier)
  else return null
  return relative(SRC, absolute).split(sep).join('/')
}

function isForbidden(target: string): boolean {
  return FORBIDDEN.some((prefix) => target === prefix || target.startsWith(`${prefix}/`) || target.startsWith(`${prefix}.`))
}

describe('component import boundary', () => {
  it('no file under src/components imports types, providers, raceUtils or context', () => {
    const violations = listSourceFiles(COMPONENTS).flatMap((file) =>
      importSpecifiers(readFileSync(file, 'utf8'))
        .filter((specifier) => {
          const target = resolveInSrc(file, specifier)
          return target !== null && isForbidden(target)
        })
        .map((specifier) => `${relative(SRC, file).split(sep).join('/')}: ${specifier}`)
    )
    expect(violations).toEqual([])
  })
})
