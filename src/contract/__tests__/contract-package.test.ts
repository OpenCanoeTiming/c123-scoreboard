import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import type { SourceTag } from '@opencanoetiming/c123-contract'
import errorSchema from '@opencanoetiming/c123-contract/schemas/error.schema.json'
import fixtureAdmittedSchema from '@opencanoetiming/c123-contract/schemas/fixture-admitted.schema.json'
import observedSchema from '@opencanoetiming/c123-contract/schemas/observed.schema.json'

const PACKAGE = '@opencanoetiming/c123-contract'
const PINNED = '0.2.0'

function readJson(url: URL): { [key: string]: unknown } {
  return JSON.parse(readFileSync(url, 'utf8'))
}

describe('contract package', () => {
  it('is pinned to an exact version in package.json', () => {
    const manifest = readJson(new URL('../../../package.json', import.meta.url)) as {
      dependencies: Record<string, string>
    }
    expect(manifest.dependencies[PACKAGE]).toBe(PINNED)
  })

  it('installs the pinned version', () => {
    const installed = readJson(
      new URL(`../../../node_modules/${PACKAGE}/package.json`, import.meta.url)
    )
    expect(installed.version).toBe(PINNED)
  })

  it('ships the three schemas and exports types', () => {
    const tag: SourceTag = 'tcp'
    expect(tag).toBe('tcp')
    for (const schema of [errorSchema, fixtureAdmittedSchema, observedSchema]) {
      expect(typeof schema).toBe('object')
    }
  })
})
