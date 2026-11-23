import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadFixture, startHarness, type Harness } from '@/fixture/harness'
import { displayPolicy } from './displayPolicy'
import { selectBoardView } from './selectBoardView'

// Tier 3 on the BoardView (TEST-ARCHITECTURE §3.3): synthetic fixtures through the harness and the selector.
// The results side of the board (c123-scoreboard#161): which Phase is shown, the title, and the rows as the
// Standing delivers them. CLIENT-OBLIGATIONS at 1db1a33: L27, L41, L68, L70, L71, L73, L74, L84-L87,
// L104, L114, L144, L158, L165, L166. Display defaults: c123-scoreboard#170, rows 1, 2, 4, 5, 9.
// Every fixture's phaseIds are opaque (`race-a`, `race-b`...): nothing can be parsed from them.

const DIR = resolve(process.cwd(), 'tests/fixtures/synthetic')
const OFFSET = 41_000

function start(name: string): Harness {
  return startHarness(loadFixture(JSON.parse(readFileSync(resolve(DIR, `${name}.json`), 'utf8'))), { offsetMs: OFFSET })
}

const view = (h: Harness, category: string | null = null) => selectBoardView(h.state, displayPolicy, h.clock, { category })
const steps = (h: Harness, n: number) => {
  for (let i = 0; i < n; i++) h.next()
}

describe('best-of-two pair, run 2 in progress (slalom-k1m-best-of-two)', () => {
  it('shows the Phase of the first on-course Attempt: the second run, titled /2 from its format', () => {
    const v = view(start('slalom-k1m-best-of-two'))
    expect(v.title).toEqual({ event: 'Autumn Slalom', category: 'K1M', run: '2' })
  })

  it('rows are the pair Standing in delivered order with delivered rank; the result is pairTotal', () => {
    const rows = view(start('slalom-k1m-best-of-two')).rows
    expect(rows.map((r) => [r.bib, r.rank, r.name])).toEqual([
      ['1', '1.', 'NOVAK Jan'],
      ['4', '2.', 'CERNY Adam'],
      ['2', '3.', 'SVOBODA Petr'],
      ['3', '4.', 'DVORAK Tomas'],
    ])
    expect(rows.map((r) => r.result.text)).toEqual(['88.50', '92.00', '95.00', '102.00'])
    expect(rows.map((r) => r.behind)).toEqual(['', '+3.50', '+6.50', '+13.50'])
  })

  it('run 1 from the first Phase, run 2 from the pair entry, the highlighted run from countingRun', () => {
    const [first, onCourse, dns, notStarted] = view(start('slalom-k1m-best-of-two')).rows
    expect(first.runs).toMatchObject({
      first: { kind: 'time', text: '90.00', penalty: '2', penaltyKind: 'touch' },
      second: { kind: 'time', text: '88.50', penalty: '2', underReview: true },
      better: 2,
    })
    expect(onCourse.runs).toMatchObject({ first: { text: '92.00' }, second: { kind: 'missing', text: '-' }, better: null })
    expect(notStarted.runs).toMatchObject({ first: { text: '102.00', penalty: '52', penaltyKind: 'miss' }, better: null })
    // A second-run mark describes run 2 only: the combined result and rank stay.
    expect(dns.runs).toMatchObject({ first: { text: '95.00' }, second: { kind: 'status', text: 'DNS' }, better: 1 })
    expect(dns.result).toMatchObject({ kind: 'time', text: '95.00' })
  })

  it('provisional and underReview are carried on the row as delivered', () => {
    const rows = view(start('slalom-k1m-best-of-two')).rows
    expect(rows.map((r) => r.provisional)).toEqual([false, true, false, true])
    expect(rows[0].result.underReview).toBe(true)
  })

  it('after the finish: the re-ranked pair Standing as pushed, and still the same Phase', () => {
    const h = start('slalom-k1m-best-of-two')
    h.runToEnd()
    const v = view(h)
    expect(v.title.run).toBe('2')
    const athlete = v.rows.find((r) => r.bib === '4')
    expect(athlete).toMatchObject({ rank: '2.', behind: '+2.50', result: { text: '91.00' }, provisional: false })
    expect(athlete?.runs).toMatchObject({ first: { text: '92.00' }, second: { text: '91.00' }, better: 2 })
  })
})

describe('second run before its sibling is known (slalom-k1m-second-run-cold-start)', () => {
  it('shows the phase Standing; the result is the Attempt pairTotal, not run 2 own total', () => {
    const v = view(start('slalom-k1m-second-run-cold-start'))
    expect(v.title.run).toBe('2')
    expect(v.rows.map((r) => [r.bib, r.rank, r.result.text])).toEqual([
      ['1', '1.', '88.50'],
      ['2', '2.', '95.00'],
    ])
    expect(v.rows.map((r) => r.runs)).toMatchObject([
      { first: { kind: 'none' }, second: { text: '88.50' }, better: 2 },
      { first: { kind: 'none' }, second: { text: '96.00' }, better: 1 },
    ])
  })

  it('once the sibling is named, the pair Standing and run 1 from the first Phase', () => {
    const h = start('slalom-k1m-second-run-cold-start')
    h.runToEnd()
    const v = view(h)
    expect(v.rows.map((r) => [r.bib, r.rank, r.result.text])).toEqual([
      ['1', '1.', '88.50'],
      ['2', '2.', '95.00'],
    ])
    expect(v.rows.map((r) => r.runs)).toMatchObject([
      { first: { text: '90.00' }, second: { text: '88.50' }, better: 2 },
      { first: { text: '95.00' }, second: { text: '96.00' }, better: 1 },
    ])
  })
})

describe('result rows (slalom-k1m-result-rows)', () => {
  it('an unknown format token is the run label, verbatim', () => {
    expect(view(start('slalom-k1m-result-rows')).title).toEqual({ event: 'Autumn Slalom', category: 'K1M', run: 'ZZ9' })
  })

  it('delivered order, never re-sorted; unplaced entries last with no rank; an untimed row placed with no time', () => {
    const rows = view(start('slalom-k1m-result-rows')).rows
    expect(rows.map((r) => [r.bib, r.rank])).toEqual([
      ['1', '1.'],
      ['2', '2.'],
      ['3', '3.'],
      ['6', '4.'],
      ['5', ''],
      ['4', ''],
    ])
    expect(rows.map((r) => [r.result.kind, r.result.text])).toEqual([
      ['time', '90.00'],
      ['time', '95.50'],
      ['none', ''],
      ['time', '101.00'],
      ['status', 'DNS'],
      ['status', 'DNF'],
    ])
    expect(rows.map((r) => r.runs)).toEqual([null, null, null, null, null, null])
    expect(rows[0].provisional).toBe(true)
  })

  it('a row that turns DSQ shows its mark, not the time it had', () => {
    const h = start('slalom-k1m-result-rows')
    steps(h, 2)
    const row = view(h).rows.find((r) => r.bib === '6')
    expect(row).toMatchObject({ rank: '', behind: '', result: { kind: 'status', text: 'DSQ' } })
  })

  it('a retracted result leaves the table at once', () => {
    const h = start('slalom-k1m-result-rows')
    h.runToEnd()
    expect(view(h).rows.map((r) => [r.bib, r.rank])).toEqual([
      ['1', '1.'],
      ['3', '2.'],
      ['5', ''],
      ['4', ''],
      ['6', ''],
    ])
  })
})

describe('Phase choice (slalom-two-classes)', () => {
  const shown = (h: Harness, category: string | null = null) => {
    const v = view(h, category)
    return [v.title.category, v.rows.map((r) => r.bib)]
  }

  it('nobody on course: the Phase of the most recently changed Standing', () => {
    expect(shown(start('slalom-two-classes'))).toEqual(['C1W', ['11']])
  })

  it('someone on course: the Phase of the first on-course Attempt', () => {
    const h = start('slalom-two-classes')
    steps(h, 2)
    expect(shown(h)).toEqual(['K1M', ['1']])
  })

  it('an on-course Attempt whose Phase is not held renders what it carries; the choice stays on a held Phase', () => {
    const h = start('slalom-two-classes')
    steps(h, 4)
    const v = view(h)
    expect(v.featured?.bib).toBe('7')
    expect([v.title.category, v.rows.map((r) => r.bib)]).toEqual(['K1M', ['1']])
  })

  it('after the finish: the most recently changed Standing; after its Phase is deleted, the same rule again', () => {
    const h = start('slalom-two-classes')
    steps(h, 7)
    expect(shown(h)).toEqual(['K1M', ['1', '2']])
    h.next() // phase.deleted
    expect(shown(h)).toEqual(['C1W', ['11']])
  })

  it('?category= pins a class whatever is on course', () => {
    const h = start('slalom-two-classes')
    expect(shown(h, 'K1M')).toEqual(['K1M', ['1']])
    expect(shown(h, 'C1W')).toEqual(['C1W', ['11']])
    steps(h, 2)
    expect(shown(h, 'C1W')).toEqual(['C1W', ['11']])
  })
})
