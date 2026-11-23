import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Phase } from '@opencanoetiming/c123-contract'
import { displayPolicy } from './displayPolicy'
import { runLabel } from './labels'

// The run label of the on-site board comes from `format` (DERIVATIONS §9: "On-site clients label from `format`,
// showing an unknown token verbatim"), never from the organiser's `title`. An unknown token is shown verbatim,
// paired or not (CONTRACTS §2.4 "Labelling a format": a client never invents a name). Today's look: #170, row 5.

const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/synthetic/slalom-k1m-best-of-two.json'), 'utf8')
)
const secondRun: Phase = fixture.steps
  .flatMap((s: { responses?: Record<string, { phases?: Phase[] }> }) => Object.values(s.responses ?? {}))
  .flatMap((e: { phases?: Phase[] }) => e.phases ?? [])
  .find((p: Phase) => p.phaseId === 'race-b')

const organiserTitle = {
  state: 'known',
  value: 'K1m - střední trať - 2. jízda',
  observedAt: '2026-09-15T13:20:00.000Z',
  source: 'xml',
  confidence: 'authoritative',
  provisional: false,
} as Phase['title']

describe('runLabel', () => {
  it('fixture carries the paired second run', () => {
    expect(secondRun).toMatchObject({ format: 'BR2', pair: { role: 'second' } })
  })

  it('labels BR2 with an organiser title as today, /2, not the title', () => {
    expect(runLabel({ ...secondRun, title: organiserTitle }, displayPolicy)).toBe('2')
  })

  it.each(['SUF', 'HT2'])('shows the unknown paired token %s verbatim, never a bare pair number', (format) => {
    expect(runLabel({ ...secondRun, format }, displayPolicy)).toBe(format)
  })
})
