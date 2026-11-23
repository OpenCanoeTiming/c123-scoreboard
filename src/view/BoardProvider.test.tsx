import { describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadFixture, startHarness, type Harness } from '@/fixture/harness'
import { ScoreboardContent } from '@/App'
import { BoardProvider } from './BoardProvider'
import { FINISH_DISPLAY_DURATION, FINISHED_GRACE_PERIOD, TICK_PERIOD_MS } from './displayPolicy'
import { useBoardView } from './useBoardView'

// Tier 3 on the DOM (TEST-ARCHITECTURE §3.3): the harness feeds the first synthetic fixture through the
// store, BoardProvider turns it into a BoardView, and the same components the legacy path uses render it.
// The rows are the Standing's, in its delivered order, with its rank; the featured row is the first of
// the server's on-course order (c123-scoreboard#170, choice 10).

const FIXTURE = resolve(process.cwd(), 'tests/fixtures/synthetic/slalom-k1m-one-run.json')
const OFFSET = 37_000

function start(): Harness {
  return startHarness(loadFixture(JSON.parse(readFileSync(FIXTURE, 'utf8'))), { offsetMs: OFFSET })
}

function board(h: Harness) {
  return (
    <BoardProvider store={h.state} clock={h.clock} connection="live">
      <ScoreboardContent />
    </BoardProvider>
  )
}

/** Each result row as [bib, rank, name], in DOM order, and the row's whole text. */
function rows() {
  const list = screen.getByTestId('results-list')
  return [...list.querySelectorAll<HTMLElement>('[data-bib]')].map((row) => ({
    cells: [...row.children].slice(0, 3).map((cell) => cell.textContent),
    text: row.textContent ?? '',
  }))
}

describe('walking skeleton: fixture -> store -> BoardView -> components (tier 3)', () => {
  it('after hydration: the title, and the Standing rows in delivered order with rank, bib, name and time', () => {
    const h = start()
    render(board(h))

    const title = screen.getByTestId('title')
    expect(title).toHaveTextContent('Autumn Slalom')
    expect(title).toHaveTextContent('K1M')
    expect(title).toHaveTextContent('/1.')

    const shown = rows()
    expect(shown.map((r) => r.cells)).toEqual([
      ['1.', '1', 'NOVAK Jan'],
      ['2.', '2', expect.any(String)],
      ['', '3', expect.any(String)],
    ])
    expect(shown[0].text).toContain('90.00')
    expect(shown[1].text).toContain('100.10')
    expect(screen.queryByTestId('oncourse')).toBeNull()
  })

  it('features the first athlete of the on-course set once the server lists them', () => {
    const h = start()
    const { rerender } = render(board(h))
    h.next() // attempt 3 on course
    h.next() // oncourse.updated: [attempt 3]
    rerender(board(h))

    const featured = screen.getByTestId('oncourse')
    expect(within(featured).getByText('3')).toBeInTheDocument()
    expect(featured).toHaveTextContent(rows()[2].cells[2] as string)
  })

  it('after the last step: the re-ranked Standing as delivered, and nobody featured', () => {
    const h = start()
    const { rerender } = render(board(h))
    h.runToEnd()
    rerender(board(h))

    const shown = rows()
    expect(shown.map((r) => r.cells.slice(0, 2))).toEqual([
      ['1.', '1'],
      ['2.', '3'],
      ['3.', '2'],
    ])
    expect(shown[1].text).toContain('97.42')
    expect(shown[2].text).toContain('100.10')
    expect(screen.queryByTestId('oncourse')).toBeNull()
  })
})

// The display lifetimes end on a Clock tick, with no new data (CLIENT-OBLIGATIONS L121; c123-scoreboard#162).
describe('BoardProvider re-evaluates the lifetimes on a Clock tick (tier 3)', () => {
  const FINISH = resolve(process.cwd(), 'tests/fixtures/synthetic/slalom-finish.json')

  function Probe() {
    const v = useBoardView()
    return (
      <output data-testid="probe">
        {JSON.stringify({ category: v.title.category, featured: v.featured?.bib ?? null, highlight: v.resultsScroll.highlightBib })}
      </output>
    )
  }

  it('after the finish, grace and highlight end at 5 s and the top at 8 s, on elapsed time alone', () => {
    const h = startHarness(loadFixture(JSON.parse(readFileSync(FINISH, 'utf8'))), { offsetMs: OFFSET })
    const tree = () => (
      <BoardProvider store={h.state} clock={h.clock} connection="live">
        <Probe />
      </BoardProvider>
    )
    const probe = () => JSON.parse(screen.getByTestId('probe').textContent ?? 'null')
    const { rerender } = render(tree())
    const step = () => {
      act(() => h.next())
      rerender(tree())
    }
    for (let i = 0; i < 4; i++) step() // on course, then status becoming finished
    const finish = h.clock.now()
    while (!h.done) step() // the closure after 1 s, then a newer C1W Standing
    expect(probe()).toEqual({ category: 'K1M', featured: '2', highlight: '2' })

    act(() => h.clock.advance(finish + FINISHED_GRACE_PERIOD + TICK_PERIOD_MS - h.clock.now()))
    expect(probe()).toEqual({ category: 'C1W', featured: '2', highlight: null })

    act(() => h.clock.advance(finish + FINISH_DISPLAY_DURATION + TICK_PERIOD_MS - h.clock.now()))
    expect(probe()).toEqual({ category: 'C1W', featured: null, highlight: null })
  })
})
