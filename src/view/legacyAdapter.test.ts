import { describe, expect, it } from 'vitest'
import { toBoardView } from './legacyAdapter'
import { defaultVisibility, type OnCourseCompetitor } from '@/types'

// The auto-scroll inputs the legacy path fed the hook directly (the active highlight's bib; on the
// ledwall, someone started and not finished) now travel in the BoardView, unchanged.

const initialState: Parameters<typeof toBoardView>[0] = {
  status: 'connected',
  initialDataReceived: true,
  title: '',
  raceName: '',
  raceId: '',
  dayTime: '',
  currentCompetitor: null,
  departingCompetitor: null,
  onCourse: [],
  results: [],
  visibility: defaultVisibility,
}

const athlete = (over: Partial<OnCourseCompetitor>): OnCourseCompetitor =>
  ({ bib: '9', name: 'X', club: '', nat: '', raceId: '', time: '', total: '', pen: 0, gates: '', dtStart: null, dtFinish: null, ...over }) as OnCourseCompetitor

describe('legacy adapter: results scroll inputs', () => {
  it('carries the active highlight bib, or null', () => {
    expect(toBoardView(initialState, '7').resultsScroll.highlightBib).toBe('7')
    expect(toBoardView(initialState, null).resultsScroll.highlightBib).toBeNull()
  })

  it('someoneRacing: an athlete on course with a start and no finish', () => {
    const racing = (onCourse: OnCourseCompetitor[]) => toBoardView({ ...initialState, onCourse }, null).resultsScroll.someoneRacing
    expect(racing([])).toBe(false)
    expect(racing([athlete({})])).toBe(false)
    expect(racing([athlete({ dtStart: '10:00:00' })])).toBe(true)
    expect(racing([athlete({ dtStart: '10:00:00', dtFinish: '10:01:30' })])).toBe(false)
  })
})
