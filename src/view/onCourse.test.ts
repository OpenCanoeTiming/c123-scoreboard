import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadFixture, startHarness, type Harness } from '@/fixture/harness'
import {
  DEPARTING_TIMEOUT,
  displayPolicy,
  FINISH_DISPLAY_DURATION,
  FINISHED_GRACE_PERIOD,
  HIGHLIGHT_DURATION,
  TICK_PERIOD_MS,
} from './displayPolicy'
import { emptyLifetimes, observeLifetimes, type Lifetimes } from './lifetimes'
import { selectBoardView } from './selectBoardView'

// Tier 3 on the BoardView (TEST-ARCHITECTURE §3.3, §5): the on-course side and the display lifetimes
// (c123-scoreboard#162). Synthetic fixtures through the harness; every lifetime is asserted after a step
// or after advancing the fake Clock alone, at deadline + TICK_PERIOD_MS. CLIENT-OBLIGATIONS at 1db1a33:
// L38-L40, L62-L64, L67, L75, L77, L81, L96, L114, L116, L117, L121, L126, L129, L145, L161, L167-L169.
// Display defaults: c123-scoreboard#170, rows 3, 7, 8, 10, 11; c123-server#309 (no smoothing).

const DIR = resolve(process.cwd(), 'tests/fixtures/synthetic')
const OFFSET = 43_000

type Board = {
  h: Harness
  step(): void
  steps(n: number): void
  toEnd(): void
  view(category?: string | null): ReturnType<typeof selectBoardView>
  /** Moves the fake Clock alone, with no new step, to `at`. */
  advanceTo(at: number): void
}

/** The harness, with the board's lifetimes observed after every step, as BoardProvider observes each store. */
function board(name: string): Board {
  const h = startHarness(loadFixture(JSON.parse(readFileSync(resolve(DIR, `${name}.json`), 'utf8'))), { offsetMs: OFFSET })
  let lifetimes: Lifetimes = emptyLifetimes
  const step = () => {
    const before = h.state
    h.next()
    lifetimes = observeLifetimes(lifetimes, before, h.state, h.clock.now())
  }
  return {
    h,
    step,
    steps(n) {
      for (let i = 0; i < n; i++) step()
    },
    toEnd() {
      while (!h.done) step()
    },
    view: (category = null) => selectBoardView(h.state, displayPolicy, h.clock, { category, lifetimes }),
    advanceTo(at) {
      h.clock.advance(at - h.clock.now())
    },
  }
}

const rowOf = (v: ReturnType<typeof selectBoardView>, bib: string) => v.rows.find((r) => r.bib === bib)

describe('display policy: the four lifetimes and the tick (#170, row 8)', () => {
  it('8 s on top, 5 s on course, 5 s highlight, 3 s departing; the tick period at most 1 s', () => {
    expect([FINISH_DISPLAY_DURATION, FINISHED_GRACE_PERIOD, HIGHLIGHT_DURATION, DEPARTING_TIMEOUT]).toEqual([8000, 5000, 5000, 3000])
    expect(TICK_PERIOD_MS).toBeGreaterThan(0)
    expect(TICK_PERIOD_MS).toBeLessThanOrEqual(1000)
    expect(displayPolicy.lifetimes).toEqual({
      finishDisplayMs: FINISH_DISPLAY_DURATION,
      finishedGraceMs: FINISHED_GRACE_PERIOD,
      highlightMs: HIGHLIGHT_DURATION,
      departingMs: DEPARTING_TIMEOUT,
      tickPeriodMs: TICK_PERIOD_MS,
    })
  })
})

describe('a finish (slalom-finish)', () => {
  it('on course: time and penalty as delivered, gate penalties from gates, a not-judged gate never 0', () => {
    const b = board('slalom-finish')
    b.steps(3)
    expect(b.view().featured).toEqual({
      bib: '2',
      name: 'SVOBODA Petr',
      gatePenalties: [
        { gate: 2, kind: 'touch' },
        { gate: 3, kind: 'miss' },
      ],
      penalty: '52',
      hasPenalty: true,
      time: '55',
      racing: true,
      departing: false,
    })
    expect(b.view().resultsScroll).toEqual({ highlightBib: null, someoneRacing: true })
  })

  it('status becoming finished: the finisher on top with the final time, the row highlighted', () => {
    const b = board('slalom-finish')
    b.steps(4)
    const v = b.view()
    expect(v.featured).toMatchObject({ bib: '2', time: '150.50', racing: false, departing: true })
    expect(v.resultsScroll).toEqual({ highlightBib: '2', someoneRacing: false })
    expect(v.rows.filter((r) => r.highlighted).map((r) => r.bib)).toEqual(['2'])
  })

  it('upstream closes the run after 1 s: the finisher still counts as on course and stays on top', () => {
    const b = board('slalom-finish')
    b.steps(4)
    const finish = b.h.clock.now()
    b.toEnd() // the closure, then a C1W Standing newer than K1M's
    expect(b.h.state.onCourse.attemptIds).toEqual([])
    b.advanceTo(finish + FINISHED_GRACE_PERIOD - TICK_PERIOD_MS)
    const v = b.view()
    expect(v.title.category).toBe('K1M')
    expect(v.featured).toMatchObject({ bib: '2', departing: true })
    expect(rowOf(v, '2')?.highlighted).toBe(true)
  })

  it('on elapsed time alone: grace and highlight end at 5 s, the finisher leaves the top at 8 s', () => {
    const b = board('slalom-finish')
    b.steps(4)
    const finish = b.h.clock.now()
    b.toEnd()

    b.advanceTo(finish + FINISHED_GRACE_PERIOD + TICK_PERIOD_MS)
    expect(b.view().title.category).toBe('C1W') // nobody on course: the most recently changed Standing
    const pinned = b.view('K1M')
    expect(pinned.rows.some((r) => r.highlighted)).toBe(false)
    expect(pinned.resultsScroll.highlightBib).toBeNull()
    expect(pinned.featured).toMatchObject({ bib: '2', departing: true })

    b.advanceTo(finish + FINISH_DISPLAY_DURATION + TICK_PERIOD_MS)
    expect(b.view().featured).toBeNull()
  })

  it('a finisher hydrated as finished is no finish: nothing is highlighted or pinned', () => {
    const b = board('slalom-finish')
    const v = b.view('K1M')
    expect(v.featured).toBeNull()
    expect(v.rows.some((r) => r.highlighted)).toBe(false)
  })
})

describe('two athletes on course, the later starter finishing first (slalom-two-on-course)', () => {
  it('the featured row is the first of the server order: the earlier starter, then the one who passed', () => {
    const b = board('slalom-two-on-course')
    b.steps(4)
    expect(b.view().featured).toMatchObject({ bib: '3', time: '0' })
    b.steps(3)
    expect(b.view().featured).toMatchObject({ bib: '4', time: '45', departing: false })
  })

  it('the finisher stays on top for 8 s while the other runs on and comes first in the set', () => {
    const b = board('slalom-two-on-course')
    b.steps(9) // finish, and the set reordered with the finisher last
    const finish = b.h.clock.now()
    expect(b.h.state.onCourse.attemptIds).toEqual(['race-a:3', 'race-a:4'])
    expect(b.view().featured).toMatchObject({ bib: '4', time: '75.20', departing: true })
    expect(b.view().resultsScroll).toEqual({ highlightBib: '4', someoneRacing: true })

    b.toEnd()
    b.advanceTo(finish + HIGHLIGHT_DURATION + TICK_PERIOD_MS)
    expect(b.view().resultsScroll.highlightBib).toBeNull()
    expect(b.view().featured).toMatchObject({ bib: '4', departing: true })

    b.advanceTo(finish + FINISH_DISPLAY_DURATION + TICK_PERIOD_MS)
    expect(b.h.state.onCourse.attemptIds).toContain('race-a:4') // still listed: upstream has not closed the run
    expect(b.view().featured).toMatchObject({ bib: '3', time: '110', racing: true, departing: false })
  })
})

describe('leaving the course without a finish (slalom-left-without-finish)', () => {
  it('leaves the on-course row at once, with no label and no departing row', () => {
    const b = board('slalom-left-without-finish')
    b.steps(3)
    expect(b.view().featured).toMatchObject({ bib: '3', time: '45' })
    b.step() // left-without-finish, the set not yet updated
    expect(b.view().featured).toBeNull()
    b.step() // the set without the athlete
    const left = b.h.clock.now()
    expect(b.view().featured).toBeNull()
    expect(b.view().resultsScroll.someoneRacing).toBe(false)
    b.advanceTo(left + DEPARTING_TIMEOUT + TICK_PERIOD_MS)
    expect(b.view().featured).toBeNull()
  })

  it('no mark is inferred; the mark shows in the table once status carries it', () => {
    const b = board('slalom-left-without-finish')
    b.steps(5)
    expect(rowOf(b.view(), '3')?.result).toMatchObject({ kind: 'missing' })
    b.toEnd()
    expect(rowOf(b.view(), '3')?.result).toMatchObject({ kind: 'status', text: 'DNF' })
    expect(b.view().featured).toBeNull()
  })
})

describe('a mark while on course (slalom-mark-on-course)', () => {
  it('the departing row lasts 3 s, though upstream lists the athlete until it closes the run', () => {
    const b = board('slalom-mark-on-course')
    b.steps(4)
    const marked = b.h.clock.now()
    expect(b.view().featured).toMatchObject({ bib: '3', time: '', racing: false, departing: true })
    expect(b.view().resultsScroll.highlightBib).toBeNull()

    b.step() // the Standing with the mark
    b.advanceTo(marked + DEPARTING_TIMEOUT - TICK_PERIOD_MS)
    expect(b.view().featured).toMatchObject({ bib: '3', departing: true })
    b.advanceTo(marked + DEPARTING_TIMEOUT + TICK_PERIOD_MS)
    expect(b.h.state.onCourse.attemptIds).toEqual(['race-a:3'])
    expect(b.view().featured).toBeNull()
    expect(rowOf(b.view(), '3')?.result).toMatchObject({ kind: 'status', text: 'DNF' })
  })
})

describe('a finish the on-course stream contradicts (slalom-finish-contradicted; c123-server#309)', () => {
  it('the false finish is shown as stated: on top, highlighted, and the leader at once', () => {
    const b = board('slalom-finish-contradicted')
    b.steps(4)
    const v = b.view()
    expect(v.featured).toMatchObject({ bib: '3', time: '9.16', departing: true })
    expect(v.rows.map((r) => [r.bib, r.rank, r.highlighted])).toEqual([
      ['3', '1.', true],
      ['1', '2.', false],
    ])
  })

  it('withdrawn at once: running again, no highlight, out of the placed Standing; no smoothing', () => {
    const b = board('slalom-finish-contradicted')
    b.steps(5)
    const v = b.view()
    expect(v.featured).toMatchObject({ bib: '3', time: '58', penalty: '2', racing: true, departing: false })
    expect(v.resultsScroll).toEqual({ highlightBib: null, someoneRacing: true })
    expect(v.rows.some((r) => r.highlighted)).toBe(false)
    b.step()
    expect(b.view().rows.map((r) => [r.bib, r.rank])).toEqual([
      ['1', '1.'],
      ['3', ''],
    ])
  })

  it('the real finish is a new finish: on top and highlighted from its own receipt', () => {
    const b = board('slalom-finish-contradicted')
    b.steps(7)
    const finish = b.h.clock.now()
    b.toEnd()
    expect(b.view().featured).toMatchObject({ bib: '3', time: '95.40', departing: true })
    expect(rowOf(b.view(), '3')).toMatchObject({ rank: '2.', highlighted: true })
    b.advanceTo(finish + FINISH_DISPLAY_DURATION - TICK_PERIOD_MS)
    expect(b.view().featured).toMatchObject({ bib: '3', departing: true })
    b.advanceTo(finish + FINISH_DISPLAY_DURATION + TICK_PERIOD_MS)
    expect(b.view().featured).toBeNull()
  })
})

describe('a re-run (slalom-re-run)', () => {
  it('the old result goes; the athlete is shown as if the run had not happened', () => {
    const b = board('slalom-re-run')
    b.steps(7)
    const v = b.view()
    expect(v.featured).toBeNull()
    expect(rowOf(v, '3')).toMatchObject({ rank: '', result: { kind: 'missing' }, highlighted: false })
  })

  it('racing the run again, then a new finish on top and highlighted', () => {
    const b = board('slalom-re-run')
    b.steps(9)
    expect(b.view().featured).toMatchObject({ bib: '3', time: '0', racing: true, departing: false })
    b.step()
    const finish = b.h.clock.now()
    b.toEnd()
    expect(b.view().featured).toMatchObject({ bib: '3', time: '89.00', departing: true })
    expect(rowOf(b.view(), '3')).toMatchObject({ rank: '1.', highlighted: true })
    b.advanceTo(finish + HIGHLIGHT_DURATION + TICK_PERIOD_MS)
    expect(rowOf(b.view(), '3')?.highlighted).toBe(false)
  })
})

describe('a split hold (slalom-split-hold)', () => {
  it('whole seconds, the split in decimals, whole seconds again: still running, never a finish', () => {
    const b = board('slalom-split-hold')
    b.steps(2) // on course, in the set
    const shown: unknown[] = []
    for (let i = 0; i < 3; i++) {
      b.step()
      const f = b.view().featured
      shown.push([f?.time, f?.racing, f?.departing, b.view().resultsScroll.highlightBib])
    }
    expect(shown).toEqual([
      ['44', true, false, null],
      ['45.23', true, false, null],
      ['48', true, false, null],
    ])
  })

  it('gates not configured: the penalty sum only, as delivered', () => {
    const b = board('slalom-split-hold')
    b.steps(4)
    expect(b.view().featured).toMatchObject({ gatePenalties: [], penalty: '2', hasPenalty: true })
  })

  it('no lifetime starts from the hold: after 8 s on the Clock alone the athlete is still on the row', () => {
    const b = board('slalom-split-hold')
    b.toEnd()
    b.advanceTo(b.h.clock.now() + FINISH_DISPLAY_DURATION + TICK_PERIOD_MS)
    expect(b.view().featured).toMatchObject({ bib: '3', time: '48', departing: false })
  })
})

// c123-scoreboard#182, #170 rows 9 and 10: the start queue is not on course; ?category= pins the featured row.
describe('an athlete at the start (slalom-athlete-at-start)', () => {
  it('is not featured and does not choose the Phase while nobody is running', () => {
    const b = board('slalom-athlete-at-start')
    b.steps(2)
    const v = b.view()
    expect(v.featured).toBeNull()
    expect(v.title.category).toBe('C1W') // the most recently changed Standing, not the athlete's class
    expect(v.resultsScroll.someoneRacing).toBe(false)
  })

  it('is featured, and chooses the Phase, once on course', () => {
    const b = board('slalom-athlete-at-start')
    b.steps(3)
    const v = b.view()
    expect(v.featured).toMatchObject({ bib: '2', racing: true })
    expect(v.title.category).toBe('K1M')
  })
})

describe('?category= pins the featured row (slalom-category-pinned)', () => {
  it('shows the first on-course athlete of the pinned class, not the first of the set', () => {
    const b = board('slalom-category-pinned')
    b.steps(4)
    expect(b.view().featured?.bib).toBe('11')
    expect(b.view('K1M').featured?.bib).toBe('2')
    expect(b.view('C1W').featured?.bib).toBe('11')
  })

  it('shows nothing when nobody of the pinned class is on course', () => {
    const b = board('slalom-category-pinned')
    b.steps(2)
    expect(b.view('C1W').featured).toBeNull()
    expect(b.view('C1W').resultsScroll.someoneRacing).toBe(false)
  })

  it('a finisher of another class is not put on top', () => {
    const b = board('slalom-category-pinned')
    b.steps(5)
    expect(b.view().featured).toMatchObject({ bib: '11', departing: true })
    expect(b.view('K1M').featured).toMatchObject({ bib: '2', racing: true })
    expect(b.view('K1M').title.category).toBe('K1M')
  })
})
