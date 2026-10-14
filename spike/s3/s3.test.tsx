/**
 * Spike S3 - two display-lifetime behaviours, each asserted twice (BRIEFS.md S3 step 3):
 *   (i)  on elapsed time alone: expected to fail today (ARCHITECTURE §2 re-evaluate-on-tick)
 *   (ii) on elapsed time plus one unrelated dispatch: what today's code does; must pass
 *
 * The (i) tests are it.fails so the suite stays green and turns red if the client ever
 * re-evaluates on a tick. S3_STRICT=1 runs them as plain tests to show the failure itself.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import {
  FINISHED_GRACE_PERIOD,
  STALE_COMPETITOR_TIMEOUT,
  FINISH_DISPLAY_DURATION,
  HIGHLIGHT_DURATION,
} from '@/context/constants'
import fixtureJson from './fixture-s3.json'
import type { Fixture } from './FixtureReplayProvider'
import { mountScoreboard, type MountedScoreboard } from './harness'

const fixture = fixtureJson as unknown as Fixture
const mark = fixture.marks
const at = (index: number) => Date.parse(fixture.steps[index].ws.timestamp)
const failsToday = process.env.S3_STRICT ? it : it.fails

let sb: MountedScoreboard

beforeAll(() => {
  // jsdom has no Element.scrollTo; useAutoScroll calls it on highlight (useAutoScroll.ts:267)
  Element.prototype.scrollTo = function scrollTo() {}
})

beforeEach(() => {
  sb = mountScoreboard(fixture)
})

afterEach(() => {
  sb.unmount()
})

describe('fixture lands on the thresholds', () => {
  it('grace deadline falls between the last step before it and the next OnCourse step', () => {
    const deadline = at(mark.finish7) + FINISHED_GRACE_PERIOD
    expect(at(mark.lastBeforeGraceDeadline)).toBeLessThanOrEqual(deadline)
    expect(at(mark.resultsAfterGraceDeadline)).toBeGreaterThan(deadline)
    expect(at(mark.onCourseAfterGraceDeadline)).toBeGreaterThan(deadline)
  })

  it('stale deadline falls between the last step before it and the next OnCourse step', () => {
    const deadline = at(mark.lastSeen8) + STALE_COMPETITOR_TIMEOUT
    expect(at(mark.lastBeforeStaleDeadline)).toBeLessThanOrEqual(deadline)
    expect(at(mark.timeOfDayAfterStaleDeadline)).toBeGreaterThan(deadline)
    expect(at(mark.onCourseAfterStaleDeadline)).toBeGreaterThan(deadline)
  })

  it('bib 7 is a listed finisher inside its grace period at the last step before the deadline', async () => {
    await sb.replayThrough(mark.lastBeforeGraceDeadline)
    const seven = sb.view().onCourse.find((c) => c.bib === '7')
    expect(seven?.dtFinish).toBeTruthy()
    expect(sb.onCourseBibs()).toEqual(['7', '8'])
  })
})

describe('Behaviour A: a finisher leaves the on-course list after FINISHED_GRACE_PERIOD', () => {
  failsToday('A(i) on elapsed time alone', async () => {
    await sb.replayThrough(mark.lastBeforeGraceDeadline)
    await sb.advanceTo(at(mark.onCourseAfterGraceDeadline))
    expect(sb.onCourseBibs()).not.toContain('7')
  })

  it('A(ii) on elapsed time plus one unrelated OnCourse dispatch (bib 8)', async () => {
    await sb.replayThrough(mark.onCourseAfterGraceDeadline)
    expect(sb.onCourseBibs()).toEqual(['8'])
  })

  it('a Results dispatch after the deadline does not evict; only SET_ON_COURSE re-evaluates', async () => {
    await sb.replayThrough(mark.resultsAfterGraceDeadline)
    expect(sb.onCourseBibs()).toContain('7')
  })
})

describe('Behaviour B: a competitor no longer reported leaves after STALE_COMPETITOR_TIMEOUT', () => {
  failsToday('B(i) on elapsed time alone', async () => {
    await sb.replayThrough(mark.lastBeforeStaleDeadline)
    await sb.advanceTo(at(mark.onCourseAfterStaleDeadline))
    expect(sb.onCourseBibs()).not.toContain('8')
  })

  it('B(ii) on elapsed time plus one unrelated OnCourse dispatch (bib 31, next category)', async () => {
    await sb.replayThrough(mark.onCourseAfterStaleDeadline)
    expect(sb.onCourseBibs()).toEqual(['31'])
    expect(sb.view().activeRaceId).toBe('C1M_ST_BR1_6')
    // Rendered consequence: the previous category's results are cleared
    expect(sb.resultBibs()).toEqual([])
  })

  it('a TimeOfDay dispatch after the deadline does not evict; bib 8 is still shown as running', async () => {
    await sb.replayThrough(mark.timeOfDayAfterStaleDeadline)
    expect(sb.onCourseBibs()).toContain('8')
    expect(sb.view().activeRaceId).toBe('K1M_ST_BR1_6')
    // Rendered consequence: the removed competitor stays in the current-competitor slot
    expect(sb.container.querySelector('[data-testid="oncourse"]')?.textContent).toContain('MAREK')
    // The other race's rotation (step 17) was filtered: the target race is K1M_ST_BR1_6
    expect(sb.resultBibs()).toEqual(['3', '7', '1', '5', '2', '6', '4'])
  })
})

describe('contrast: timer-driven display lifetimes do expire on elapsed time alone', () => {
  it('departing finisher clears after FINISH_DISPLAY_DURATION (setTimeout, ScoreboardContext.tsx:738)', async () => {
    await sb.replayThrough(mark.lastSeen8 + 1)
    expect(sb.view().departingCompetitor?.bib).toBe('7')
    await sb.advanceTo(at(mark.finish7) + FINISH_DISPLAY_DURATION + 1)
    expect(sb.view().departingCompetitor).toBeNull()
  })

  it('highlight expires after HIGHLIGHT_DURATION (requestAnimationFrame, useTimestamp.ts:95)', async () => {
    await sb.replayThrough(mark.finish7 + 2)
    expect(sb.highlight()).toMatchObject({ highlightBib: '7', isActive: true })
    const highlightedAt = sb.view().highlightTimestamp!
    await sb.advanceTo(highlightedAt + HIGHLIGHT_DURATION + 1)
    expect(sb.highlight().isActive).toBe(false)
  })
})
