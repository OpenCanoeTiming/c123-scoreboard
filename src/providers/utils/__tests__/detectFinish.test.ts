import { describe, it, expect } from 'vitest'
import { detectFinish, isOnCourse, hasFinished } from '../detectFinish'
import type { OnCourseCompetitor } from '@/types'

const createCompetitor = (overrides: Partial<OnCourseCompetitor> = {}): OnCourseCompetitor => ({
  bib: '42',
  name: 'Test Competitor',
  club: 'TEST',
  nat: 'CZE',
  raceId: 'race1',
  time: '90.00',
  total: '92.00',
  pen: 2,
  gates: '0,0,2,0',
  dtStart: '2024-01-01T10:00:00',
  dtFinish: null,
  ttbDiff: '+1.50',
  ttbName: 'Leader',
  rank: 2,
  ...overrides,
})

describe('detectFinish', () => {
  it('should detect finish when dtFinish changes from null to value', () => {
    const previous = createCompetitor({ dtFinish: null })
    const current = createCompetitor({ dtFinish: '2024-01-01T10:01:30' })

    expect(detectFinish(previous, current)).toBe(true)
  })

  it('should detect finish when dtFinish changes from empty to value', () => {
    const previous = createCompetitor({ dtFinish: '' })
    const current = createCompetitor({ dtFinish: '2024-01-01T10:01:30' })

    expect(detectFinish(previous, current)).toBe(true)
  })

  it('should not detect finish when previous is null and current has finish', () => {
    const current = createCompetitor({ dtFinish: '2024-01-01T10:01:30' })

    // First time seeing competitor with finish is not a "finish event"
    expect(detectFinish(null, current)).toBe(false)
  })

  it('should not detect finish when dtFinish stays null', () => {
    const previous = createCompetitor({ dtFinish: null })
    const current = createCompetitor({ dtFinish: null })

    expect(detectFinish(previous, current)).toBe(false)
  })

  it('should not detect finish when dtFinish was already set', () => {
    const previous = createCompetitor({ dtFinish: '2024-01-01T10:01:30' })
    const current = createCompetitor({ dtFinish: '2024-01-01T10:01:30' })

    expect(detectFinish(previous, current)).toBe(false)
  })

  it('should not detect finish for different competitors', () => {
    const previous = createCompetitor({ bib: '42', dtFinish: null })
    const current = createCompetitor({ bib: '43', dtFinish: '2024-01-01T10:01:30' })

    expect(detectFinish(previous, current)).toBe(false)
  })

  it('should not detect finish when current is null', () => {
    const previous = createCompetitor({ dtFinish: null })

    expect(detectFinish(previous, null)).toBe(false)
  })
})

describe('isOnCourse', () => {
  it('should return true when started but not finished', () => {
    const competitor = createCompetitor({
      dtStart: '2024-01-01T10:00:00',
      dtFinish: null,
    })

    expect(isOnCourse(competitor)).toBe(true)
  })

  it('should return false when not started', () => {
    const competitor = createCompetitor({
      dtStart: null,
      dtFinish: null,
    })

    expect(isOnCourse(competitor)).toBe(false)
  })

  it('should return false when finished', () => {
    const competitor = createCompetitor({
      dtStart: '2024-01-01T10:00:00',
      dtFinish: '2024-01-01T10:01:30',
    })

    expect(isOnCourse(competitor)).toBe(false)
  })

  it('should return false for null competitor', () => {
    expect(isOnCourse(null)).toBe(false)
  })

  it('should return false when dtStart is empty string', () => {
    const competitor = createCompetitor({
      dtStart: '',
      dtFinish: null,
    })

    expect(isOnCourse(competitor)).toBe(false)
  })
})

describe('hasFinished', () => {
  it('should return true when dtFinish is set', () => {
    const competitor = createCompetitor({
      dtFinish: '2024-01-01T10:01:30',
    })

    expect(hasFinished(competitor)).toBe(true)
  })

  it('should return false when dtFinish is null', () => {
    const competitor = createCompetitor({
      dtFinish: null,
    })

    expect(hasFinished(competitor)).toBe(false)
  })

  it('should return false when dtFinish is empty string', () => {
    const competitor = createCompetitor({
      dtFinish: '',
    })

    expect(hasFinished(competitor)).toBe(false)
  })

  it('should return false for null competitor', () => {
    expect(hasFinished(null)).toBe(false)
  })
})
