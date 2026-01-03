/**
 * EventComparator - Compares events from two providers
 *
 * Usage:
 *   const result = compareEvents(cliEvents, c123Events)
 *   if (!result.identical) {
 *     console.log(result.differences)
 *   }
 */

import type { NormalizedEvents, NormalizedResult, NormalizedOnCourse } from './EventCollector'

/**
 * Difference in a specific field
 */
export interface FieldDiff {
  field: string
  expected: unknown
  actual: unknown
}

/**
 * Difference in results
 */
export interface ResultDiff {
  raceName: string
  type: 'missing' | 'extra' | 'different'
  differences?: FieldDiff[]
  expected?: NormalizedResult
  actual?: NormalizedResult
}

/**
 * Difference in on-course data
 */
export interface OnCourseDiff {
  index: number
  type: 'missing' | 'extra' | 'different'
  differences?: FieldDiff[]
  expected?: NormalizedOnCourse
  actual?: NormalizedOnCourse
}

/**
 * Comparison result
 */
export interface ComparisonResult {
  /** True if both event sets are identical (within tolerance) */
  identical: boolean

  /** Summary of differences */
  summary: {
    resultsMatch: boolean
    onCourseMatch: boolean
    dayTimesMatch: boolean
    configsMatch: boolean
  }

  /** Result differences */
  resultDiffs: ResultDiff[]

  /** OnCourse differences */
  onCourseDiffs: OnCourseDiff[]

  /** DayTime differences */
  dayTimeDiffs: { expected: string[]; actual: string[] }

  /** Statistics comparison */
  statsComparison: {
    resultsCount: { expected: number; actual: number; match: boolean }
    onCourseCount: { expected: number; actual: number; match: boolean }
    configCount: { expected: number; actual: number; match: boolean }
  }
}

/**
 * Comparison options
 */
export interface ComparisonOptions {
  /** Ignore result count differences (compare only content) */
  ignoreResultCount?: boolean
  /** Ignore on-course count differences */
  ignoreOnCourseCount?: boolean
  /** Compare only last result per race */
  compareLastResultOnly?: boolean
  /** Compare only final on-course state */
  compareFinalOnCourseOnly?: boolean
  /** Fields to ignore in results comparison */
  ignoreResultFields?: string[]
  /** Fields to ignore in on-course comparison */
  ignoreOnCourseFields?: string[]
}

/**
 * Compare two normalized event sets
 *
 * @param expected - Events from reference provider (CLI)
 * @param actual - Events from provider under test (C123Server)
 * @param options - Comparison options
 * @returns Comparison result with differences
 */
export function compareEvents(
  expected: NormalizedEvents,
  actual: NormalizedEvents,
  options: ComparisonOptions = {}
): ComparisonResult {
  const resultDiffs = compareResults(expected.results, actual.results, options)
  const onCourseDiffs = compareOnCourse(expected.onCourse, actual.onCourse, options)
  const dayTimeDiffs = compareDayTimes(expected.dayTimes, actual.dayTimes)

  const resultsMatch = resultDiffs.length === 0
  const onCourseMatch = onCourseDiffs.length === 0
  const dayTimesMatch = dayTimeDiffs.expected.length === 0 && dayTimeDiffs.actual.length === 0
  const configsMatch = JSON.stringify(expected.configs) === JSON.stringify(actual.configs)

  return {
    identical: resultsMatch && onCourseMatch && dayTimesMatch && configsMatch,
    summary: {
      resultsMatch,
      onCourseMatch,
      dayTimesMatch,
      configsMatch,
    },
    resultDiffs,
    onCourseDiffs,
    dayTimeDiffs,
    statsComparison: {
      resultsCount: {
        expected: expected.stats.resultsCount,
        actual: actual.stats.resultsCount,
        match: expected.stats.resultsCount === actual.stats.resultsCount,
      },
      onCourseCount: {
        expected: expected.stats.onCourseCount,
        actual: actual.stats.onCourseCount,
        match: expected.stats.onCourseCount === actual.stats.onCourseCount,
      },
      configCount: {
        expected: expected.stats.configCount,
        actual: actual.stats.configCount,
        match: expected.stats.configCount === actual.stats.configCount,
      },
    },
  }
}

/**
 * Compare results arrays
 */
function compareResults(
  expected: NormalizedResult[],
  actual: NormalizedResult[],
  options: ComparisonOptions
): ResultDiff[] {
  const diffs: ResultDiff[] = []
  const ignoreFields = new Set(options.ignoreResultFields || [])

  // Build maps by raceName for efficient lookup
  const expectedByRace = new Map<string, NormalizedResult[]>()
  const actualByRace = new Map<string, NormalizedResult[]>()

  for (const r of expected) {
    const arr = expectedByRace.get(r.raceName) || []
    arr.push(r)
    expectedByRace.set(r.raceName, arr)
  }

  for (const r of actual) {
    const arr = actualByRace.get(r.raceName) || []
    arr.push(r)
    actualByRace.set(r.raceName, arr)
  }

  // Get all race names
  const allRaces = new Set([...expectedByRace.keys(), ...actualByRace.keys()])

  for (const raceName of allRaces) {
    const expectedResults = expectedByRace.get(raceName) || []
    const actualResults = actualByRace.get(raceName) || []

    if (expectedResults.length === 0) {
      diffs.push({
        raceName,
        type: 'extra',
        actual: actualResults[actualResults.length - 1],
      })
      continue
    }

    if (actualResults.length === 0) {
      diffs.push({
        raceName,
        type: 'missing',
        expected: expectedResults[expectedResults.length - 1],
      })
      continue
    }

    // Compare last result for each race (or all if option set)
    const toCompare = options.compareLastResultOnly
      ? [[expectedResults[expectedResults.length - 1], actualResults[actualResults.length - 1]]]
      : expectedResults.map((e, i) => [e, actualResults[i]])

    for (const [exp, act] of toCompare) {
      if (!act) {
        diffs.push({ raceName, type: 'missing', expected: exp })
        continue
      }

      const fieldDiffs = compareResultFields(exp, act, ignoreFields)
      if (fieldDiffs.length > 0) {
        diffs.push({
          raceName,
          type: 'different',
          differences: fieldDiffs,
          expected: exp,
          actual: act,
        })
      }
    }
  }

  return diffs
}

/**
 * Compare fields of two results
 */
function compareResultFields(
  expected: NormalizedResult,
  actual: NormalizedResult,
  ignoreFields: Set<string>
): FieldDiff[] {
  const diffs: FieldDiff[] = []

  // Compare scalar fields
  if (!ignoreFields.has('raceStatus') && expected.raceStatus !== actual.raceStatus) {
    diffs.push({ field: 'raceStatus', expected: expected.raceStatus, actual: actual.raceStatus })
  }

  if (!ignoreFields.has('highlightBib') && expected.highlightBib !== actual.highlightBib) {
    diffs.push({
      field: 'highlightBib',
      expected: expected.highlightBib,
      actual: actual.highlightBib,
    })
  }

  // Compare results array
  if (!ignoreFields.has('results')) {
    if (expected.results.length !== actual.results.length) {
      diffs.push({
        field: 'results.length',
        expected: expected.results.length,
        actual: actual.results.length,
      })
    } else {
      for (let i = 0; i < expected.results.length; i++) {
        const expRow = expected.results[i]
        const actRow = actual.results[i]

        // Compare each field
        for (const key of ['rank', 'bib', 'name', 'total', 'pen', 'behind'] as const) {
          if (!ignoreFields.has(`results.${key}`) && expRow[key] !== actRow[key]) {
            diffs.push({
              field: `results[${i}].${key}`,
              expected: expRow[key],
              actual: actRow[key],
            })
          }
        }
      }
    }
  }

  return diffs
}

/**
 * Compare on-course arrays
 */
function compareOnCourse(
  expected: NormalizedOnCourse[],
  actual: NormalizedOnCourse[],
  options: ComparisonOptions
): OnCourseDiff[] {
  const diffs: OnCourseDiff[] = []
  const ignoreFields = new Set(options.ignoreOnCourseFields || [])

  // If comparing only final state
  if (options.compareFinalOnCourseOnly) {
    const expLast = expected[expected.length - 1]
    const actLast = actual[actual.length - 1]

    if (!expLast && !actLast) return []
    if (!expLast) {
      return [{ index: 0, type: 'extra', actual: actLast }]
    }
    if (!actLast) {
      return [{ index: 0, type: 'missing', expected: expLast }]
    }

    const fieldDiffs = compareOnCourseFields(expLast, actLast, ignoreFields)
    if (fieldDiffs.length > 0) {
      diffs.push({
        index: 0,
        type: 'different',
        differences: fieldDiffs,
        expected: expLast,
        actual: actLast,
      })
    }
    return diffs
  }

  // Full comparison - compare by currentBib as key
  const expectedByBib = new Map<string, NormalizedOnCourse[]>()
  const actualByBib = new Map<string, NormalizedOnCourse[]>()

  for (const oc of expected) {
    const key = oc.currentBib || '__null__'
    const arr = expectedByBib.get(key) || []
    arr.push(oc)
    expectedByBib.set(key, arr)
  }

  for (const oc of actual) {
    const key = oc.currentBib || '__null__'
    const arr = actualByBib.get(key) || []
    arr.push(oc)
    actualByBib.set(key, arr)
  }

  // Compare counts per bib
  const allBibs = new Set([...expectedByBib.keys(), ...actualByBib.keys()])

  let idx = 0
  for (const bib of allBibs) {
    const expectedOcs = expectedByBib.get(bib) || []
    const actualOcs = actualByBib.get(bib) || []

    // Compare last occurrence for each bib
    const expLast = expectedOcs[expectedOcs.length - 1]
    const actLast = actualOcs[actualOcs.length - 1]

    if (!actLast && expLast) {
      diffs.push({ index: idx++, type: 'missing', expected: expLast })
      continue
    }

    if (!expLast && actLast) {
      diffs.push({ index: idx++, type: 'extra', actual: actLast })
      continue
    }

    if (expLast && actLast) {
      const fieldDiffs = compareOnCourseFields(expLast, actLast, ignoreFields)
      if (fieldDiffs.length > 0) {
        diffs.push({
          index: idx,
          type: 'different',
          differences: fieldDiffs,
          expected: expLast,
          actual: actLast,
        })
      }
    }
    idx++
  }

  return diffs
}

/**
 * Compare fields of two on-course states
 */
function compareOnCourseFields(
  expected: NormalizedOnCourse,
  actual: NormalizedOnCourse,
  ignoreFields: Set<string>
): FieldDiff[] {
  const diffs: FieldDiff[] = []

  const fields: (keyof NormalizedOnCourse)[] = [
    'currentBib',
    'currentName',
    'currentTime',
    'currentPen',
    'currentDtFinish',
    'competitorCount',
  ]

  for (const field of fields) {
    if (ignoreFields.has(field)) continue

    const expVal = expected[field]
    const actVal = actual[field]

    if (expVal !== actVal) {
      diffs.push({ field, expected: expVal, actual: actVal })
    }
  }

  // Compare onCourseBibs array
  if (!ignoreFields.has('onCourseBibs')) {
    const expBibs = expected.onCourseBibs.join(',')
    const actBibs = actual.onCourseBibs.join(',')

    if (expBibs !== actBibs) {
      diffs.push({
        field: 'onCourseBibs',
        expected: expected.onCourseBibs,
        actual: actual.onCourseBibs,
      })
    }
  }

  return diffs
}

/**
 * Compare day times
 */
function compareDayTimes(
  expected: string[],
  actual: string[]
): { expected: string[]; actual: string[] } {
  // Get unique day times that differ
  const expSet = new Set(expected)
  const actSet = new Set(actual)

  const onlyInExpected = expected.filter((dt) => !actSet.has(dt))
  const onlyInActual = actual.filter((dt) => !expSet.has(dt))

  return {
    expected: onlyInExpected,
    actual: onlyInActual,
  }
}

/**
 * Format comparison result as human-readable string
 */
export function formatComparisonResult(result: ComparisonResult): string {
  const lines: string[] = []

  lines.push('=== COMPARISON RESULT ===')
  lines.push(`Identical: ${result.identical}`)
  lines.push('')

  lines.push('Summary:')
  lines.push(`  Results match: ${result.summary.resultsMatch}`)
  lines.push(`  OnCourse match: ${result.summary.onCourseMatch}`)
  lines.push(`  DayTimes match: ${result.summary.dayTimesMatch}`)
  lines.push(`  Configs match: ${result.summary.configsMatch}`)
  lines.push('')

  lines.push('Statistics:')
  lines.push(
    `  Results: ${result.statsComparison.resultsCount.expected} vs ${result.statsComparison.resultsCount.actual}`
  )
  lines.push(
    `  OnCourse: ${result.statsComparison.onCourseCount.expected} vs ${result.statsComparison.onCourseCount.actual}`
  )
  lines.push(
    `  Configs: ${result.statsComparison.configCount.expected} vs ${result.statsComparison.configCount.actual}`
  )
  lines.push('')

  if (result.resultDiffs.length > 0) {
    lines.push('Result differences:')
    for (const diff of result.resultDiffs) {
      lines.push(`  [${diff.type}] Race: ${diff.raceName}`)
      if (diff.differences) {
        for (const fd of diff.differences) {
          lines.push(`    ${fd.field}: ${JSON.stringify(fd.expected)} → ${JSON.stringify(fd.actual)}`)
        }
      }
    }
    lines.push('')
  }

  if (result.onCourseDiffs.length > 0) {
    lines.push('OnCourse differences:')
    for (const diff of result.onCourseDiffs) {
      lines.push(`  [${diff.type}] Index: ${diff.index}`)
      if (diff.differences) {
        for (const fd of diff.differences) {
          lines.push(`    ${fd.field}: ${JSON.stringify(fd.expected)} → ${JSON.stringify(fd.actual)}`)
        }
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}
