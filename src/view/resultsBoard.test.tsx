import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadFixture, startHarness, type Harness } from '@/fixture/harness'
import { ScoreboardContent } from '@/App'
import { BoardProvider } from './BoardProvider'

// Tier 3 on the DOM (TEST-ARCHITECTURE §3.3): the results side of the board (c123-scoreboard#161) rendered by
// the same components, in both layouts (`?type=`). Vertical shows both runs of a pair, ledwall the result
// with its `*` (c123-scoreboard#170, rows 2 and 4); a provisional result has no mark (row 1).

const DIR = resolve(process.cwd(), 'tests/fixtures/synthetic')
const OFFSET = 43_000

function start(name: string): Harness {
  return startHarness(loadFixture(JSON.parse(readFileSync(resolve(DIR, `${name}.json`), 'utf8'))), { offsetMs: OFFSET })
}

function renderBoard(h: Harness, layout: 'vertical' | 'ledwall', category: string | null = null) {
  window.history.replaceState(null, '', `/?type=${layout}&disableScroll=true`)
  return render(
    <BoardProvider store={h.state} clock={h.clock} connection="live" category={category}>
      <ScoreboardContent />
    </BoardProvider>
  )
}

/** Each result row: its bib and the text of each cell, in DOM order. */
function rows() {
  const list = screen.getByTestId('results-list')
  return [...list.querySelectorAll<HTMLElement>('[data-bib]')].map((row) => ({
    bib: row.dataset.bib,
    cells: [...row.children].map((cell) => cell.textContent ?? ''),
    /** The time of each run cell (vertical): the cell's first span, without the penalty badge */
    times: [...row.children].slice(3).map((cell) => cell.querySelector('span')?.textContent ?? null),
  }))
}

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('best-of-two pair on the DOM', () => {
  it('vertical: run 1 and run 2 columns, the run-2 mark, the review star; the title /2.', () => {
    renderBoard(start('slalom-k1m-best-of-two'), 'vertical')
    expect(screen.getByTestId('title')).toHaveTextContent('Autumn Slalom K1M/2.')
    const shown = rows()
    expect(shown.map((r) => [r.bib, r.cells[0]])).toEqual([
      ['1', '1.'],
      ['4', '2.'],
      ['2', '3.'],
      ['3', '4.'],
    ])
    expect(shown.map((r) => r.times.slice(0, 2))).toEqual([
      ['90.00', '*88.50'],
      ['92.00', '-'],
      ['95.00', 'DNS'],
      ['102.00', '-'],
    ])
  })

  it('ledwall: one result column, the combined result as delivered, with the review star', () => {
    renderBoard(start('slalom-k1m-best-of-two'), 'ledwall')
    expect(rows().map((r) => [r.bib, r.cells[0], r.cells[3]])).toEqual([
      ['1', '1.', '*88.50'],
      ['4', '2.', '92.00'],
      ['2', '3.', '95.00'],
      ['3', '4.', '102.00'],
    ])
  })
})

describe('result rows on the DOM', () => {
  for (const layout of ['vertical', 'ledwall'] as const) {
    it(`${layout}: an unknown format verbatim; delivered order; marks; an untimed placed row; no provisional mark`, () => {
      renderBoard(start('slalom-k1m-result-rows'), layout)
      expect(screen.getByTestId('title')).toHaveTextContent('Autumn Slalom K1M/ZZ9.')
      const shown = rows()
      expect(shown.map((r) => [r.bib, r.cells[0]])).toEqual([
        ['1', '1.'],
        ['2', '2.'],
        ['3', '3.'],
        ['6', '4.'],
        ['5', ''],
        ['4', ''],
      ])
      const time = (r: (typeof shown)[number]) => (layout === 'vertical' ? r.times[0] : r.cells[3])
      expect(shown.map(time)).toEqual(['90.00', '95.50', '', '101.00', 'DNS', 'DNF'])
    })

    it(`${layout}: a row turned DSQ shows the mark, and a retracted row is gone`, () => {
      const h = start('slalom-k1m-result-rows')
      h.next()
      h.next()
      const { rerender } = renderBoard(h, layout)
      const dsq = rows().find((r) => r.bib === '6')
      expect(dsq?.cells.join('|')).toContain('DSQ')
      expect(dsq?.cells.join('|')).not.toContain('101.00')

      h.runToEnd()
      rerender(
        <BoardProvider store={h.state} clock={h.clock} connection="live">
          <ScoreboardContent />
        </BoardProvider>
      )
      expect(rows().map((r) => r.bib)).toEqual(['1', '3', '5', '4', '6'])
    })
  }
})

describe('Phase choice on the DOM', () => {
  it('?category= pins the class shown', () => {
    renderBoard(start('slalom-two-classes'), 'vertical', 'K1M')
    expect(screen.getByTestId('title')).toHaveTextContent('K1M')
    expect(rows().map((r) => r.bib)).toEqual(['1'])
  })

  it('without a pin, the class of the most recently changed Standing', () => {
    renderBoard(start('slalom-two-classes'), 'ledwall')
    expect(screen.getByTestId('title')).toHaveTextContent('C1W')
    expect(rows().map((r) => r.bib)).toEqual(['11'])
  })
})
