import { describe, it, expect } from 'vitest'
import { mapOnCourse, mapResults, mapTimeOfDay, mapRaceConfig } from '../utils/c123ServerMapper'
import type {
  C123OnCourseData,
  C123OnCourseCompetitor,
  C123ResultsData,
  C123ResultRow,
  C123TimeOfDayData,
  C123RaceConfigData,
} from '@/types/c123server'

// =============================================================================
// Test Data Fixtures
// =============================================================================

function createCompetitor(overrides: Partial<C123OnCourseCompetitor> = {}): C123OnCourseCompetitor {
  return {
    bib: '42',
    name: 'Jan Novák',
    club: 'USK Praha',
    nat: 'CZE',
    raceId: 'K1M_ST_BR1_6',
    raceName: 'K1m - střední trať',
    startOrder: 1,
    warning: '',
    gates: '0,0,0,2,0,0,2,0,50,,,,,,,,,,,,,,',
    completed: false,
    dtStart: '16:14:00.000',
    dtFinish: null,
    pen: 4,
    time: '81.15',
    total: '85.15',
    ttbDiff: '+12.79',
    ttbName: 'Jiří Prskavec',
    rank: 5,
    position: 1,
    ...overrides,
  }
}

function createResultRow(overrides: Partial<C123ResultRow> = {}): C123ResultRow {
  return {
    rank: 1,
    bib: '101',
    name: 'Jiří Prskavec',
    givenName: 'Jiří',
    familyName: 'Prskavec',
    club: 'USK Praha',
    nat: 'CZE',
    startOrder: 5,
    startTime: '16:00:00.000',
    gates: '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0',
    pen: 0,
    time: '78.99',
    total: '78.99',
    behind: '',
    ...overrides,
  }
}

// =============================================================================
// mapOnCourse Tests
// =============================================================================

describe('mapOnCourse', () => {
  describe('basic mapping', () => {
    it('maps empty competitor list', () => {
      const data: C123OnCourseData = {
        total: 0,
        competitors: [],
      }

      const result = mapOnCourse(data)

      expect(result.current).toBeNull()
      expect(result.onCourse).toEqual([])
      expect(result.updateOnCourse).toBe(true)
    })
  })

  it('maps single competitor', () => {
    const competitor = createCompetitor()
    const data: C123OnCourseData = {
      total: 1,
      competitors: [competitor],
    }

    const result = mapOnCourse(data)

    expect(result.current).not.toBeNull()
    expect(result.current?.bib).toBe('42')
    expect(result.current?.name).toBe('Jan Novák')
    expect(result.current?.club).toBe('USK Praha')
    expect(result.current?.nat).toBe('CZE')
    expect(result.current?.time).toBe('81.15')
    expect(result.current?.pen).toBe(4)
    expect(result.current?.total).toBe('85.15')
    expect(result.current?.dtStart).toBe('16:14:00.000')
    expect(result.current?.dtFinish).toBeNull()
    expect(result.onCourse).toHaveLength(1)
  })

  it('selects oldest competitor (earliest dtStart) as current', () => {
    const olderCompetitor = createCompetitor({
      bib: '10',
      name: 'First Starter',
      dtStart: '16:10:00.000',
    })
    const newerCompetitor = createCompetitor({
      bib: '20',
      name: 'Second Starter',
      dtStart: '16:15:00.000',
    })
    const data: C123OnCourseData = {
      total: 2,
      competitors: [newerCompetitor, olderCompetitor], // reversed order
    }

    const result = mapOnCourse(data)

    // Should select the one with earlier dtStart
    expect(result.current?.bib).toBe('10')
    expect(result.current?.name).toBe('First Starter')
    expect(result.onCourse).toHaveLength(2)
  })

  it('handles competitor with null dtStart (goes last in selection)', () => {
    const withDtStart = createCompetitor({
      bib: '10',
      dtStart: '16:10:00.000',
    })
    const withoutDtStart = createCompetitor({
      bib: '20',
      dtStart: '', // empty string maps to null
    })
    const data: C123OnCourseData = {
      total: 2,
      competitors: [withoutDtStart, withDtStart],
    }

    const result = mapOnCourse(data)

    // Should select the one with valid dtStart
    expect(result.current?.bib).toBe('10')
  })

  it('maps dtFinish when competitor has finished', () => {
    const finishedCompetitor = createCompetitor({
      dtFinish: '16:15:21.200',
    })
    const data: C123OnCourseData = {
      total: 1,
      competitors: [finishedCompetitor],
    }

    const result = mapOnCourse(data)

    expect(result.current?.dtFinish).toBe('16:15:21.200')
  })

  it('maps all competitor fields correctly', () => {
    const competitor = createCompetitor()
    const data: C123OnCourseData = {
      total: 1,
      competitors: [competitor],
    }

    const result = mapOnCourse(data)
    const mapped = result.onCourse[0]

    expect(mapped.bib).toBe('42')
    expect(mapped.name).toBe('Jan Novák')
    expect(mapped.club).toBe('USK Praha')
    expect(mapped.nat).toBe('CZE')
    expect(mapped.raceId).toBe('K1M_ST_BR1_6')
    expect(mapped.time).toBe('81.15')
    expect(mapped.total).toBe('85.15')
    expect(mapped.pen).toBe(4)
    expect(mapped.gates).toBe('0,0,0,2,0,0,2,0,50,,,,,,,,,,,,,,')
    expect(mapped.ttbDiff).toBe('+12.79')
    expect(mapped.ttbName).toBe('Jiří Prskavec')
    expect(mapped.rank).toBe(5)
  })

  // =========================================================================
  // Partial OnCourse Messages (12.1)
  // =========================================================================
  describe('partial messages (updateOnCourse detection)', () => {
    it('returns updateOnCourse: true for full message (total === competitors.length)', () => {
      const data: C123OnCourseData = {
        total: 2,
        competitors: [
          createCompetitor({ bib: '10', dtStart: '16:10:00.000' }),
          createCompetitor({ bib: '11', dtStart: '16:11:00.000' }),
        ],
      }

      const result = mapOnCourse(data)

      expect(result.updateOnCourse).toBe(true)
      expect(result.onCourse).toHaveLength(2)
    })

    it('returns updateOnCourse: false for partial message (total > competitors.length)', () => {
      // C123 timing system sends updates for individual competitors alternately
      // e.g., total: 2 but only 1 competitor in message
      const data: C123OnCourseData = {
        total: 2, // Two competitors on course
        competitors: [
          createCompetitor({ bib: '10', dtStart: '16:10:00.000' }),
        ], // But only one in message
      }

      const result = mapOnCourse(data)

      expect(result.updateOnCourse).toBe(false)
      expect(result.onCourse).toHaveLength(1)
      expect(result.current?.bib).toBe('10')
    })

    it('returns updateOnCourse: false when all competitors filtered (no dtStart)', () => {
      // Message contains competitor without dtStart (not yet started)
      // After filtering, activeCompetitors is empty but total > 0
      const data: C123OnCourseData = {
        total: 1,
        competitors: [
          createCompetitor({ bib: '20', dtStart: '' }), // No dtStart - filtered out
        ],
      }

      const result = mapOnCourse(data)

      // This is partial because total (1) > activeCompetitors.length (0)
      expect(result.updateOnCourse).toBe(false)
      expect(result.onCourse).toHaveLength(0)
      expect(result.current).toBeNull()
    })

    it('returns updateOnCourse: true for truly empty list (total === 0)', () => {
      const data: C123OnCourseData = {
        total: 0,
        competitors: [],
      }

      const result = mapOnCourse(data)

      expect(result.updateOnCourse).toBe(true)
      expect(result.onCourse).toHaveLength(0)
    })

    it('treats message as partial when some competitors lack dtStart', () => {
      // total: 3 means 3 competitors, but after filtering only 1 has dtStart
      const data: C123OnCourseData = {
        total: 3,
        competitors: [
          createCompetitor({ bib: '10', dtStart: '16:10:00.000' }),
          createCompetitor({ bib: '11', dtStart: '' }), // filtered out
          createCompetitor({ bib: '12', dtStart: '' }), // filtered out
        ],
      }

      const result = mapOnCourse(data)

      // total (3) > activeCompetitors.length (1) → partial
      expect(result.updateOnCourse).toBe(false)
      expect(result.onCourse).toHaveLength(1)
    })

    it('provides current from partial message for merge', () => {
      // When partial, current should be set so ScoreboardContext can merge
      const competitor = createCompetitor({ bib: '42', dtStart: '16:10:00.000' })
      const data: C123OnCourseData = {
        total: 2, // Partial - more than 1 competitor on course
        competitors: [competitor],
      }

      const result = mapOnCourse(data)

      expect(result.updateOnCourse).toBe(false)
      expect(result.current).not.toBeNull()
      expect(result.current?.bib).toBe('42')
    })
  })
})

// =============================================================================
// mapResults Tests
// =============================================================================

describe('mapResults', () => {
  it('maps empty results list', () => {
    const data: C123ResultsData = {
      raceId: 'K1M_ST_BR1_6',
      classId: 'K1M_ST',
      isCurrent: true,
      mainTitle: 'K1m - střední trať',
      subTitle: '1st Run',
      rows: [],
    }

    const result = mapResults(data)

    expect(result.results).toEqual([])
    expect(result.raceName).toBe('K1m - střední trať - 1. jízda')
    expect(result.raceStatus).toBe('In Progress')
    expect(result.highlightBib).toBeNull()
  })

  it('maps single result row', () => {
    const row = createResultRow()
    const data: C123ResultsData = {
      raceId: 'K1M_ST_BR2_6',
      classId: 'K1M_ST',
      isCurrent: false,
      mainTitle: 'K1m - střední trať',
      subTitle: '2nd Run',
      rows: [row],
    }

    const result = mapResults(data)

    expect(result.results).toHaveLength(1)
    expect(result.results[0].rank).toBe(1)
    expect(result.results[0].bib).toBe('101')
    expect(result.results[0].name).toBe('Jiří Prskavec')
    expect(result.results[0].familyName).toBe('Prskavec')
    expect(result.results[0].givenName).toBe('Jiří')
    expect(result.results[0].total).toBe('78.99')
    expect(result.results[0].behind).toBe('')
  })

  it('maps multiple result rows', () => {
    const rows = [
      createResultRow({ rank: 1, bib: '101', behind: '' }),
      createResultRow({ rank: 2, bib: '102', behind: '+1.50' }),
      createResultRow({ rank: 3, bib: '103', behind: '+3.20' }),
    ]
    const data: C123ResultsData = {
      raceId: 'K1M_ST_BR1_6',
      classId: 'K1M_ST',
      isCurrent: true,
      mainTitle: 'K1m - střední trať',
      subTitle: '1st Run',
      rows,
    }

    const result = mapResults(data)

    expect(result.results).toHaveLength(3)
    expect(result.results[0].behind).toBe('')
    expect(result.results[1].behind).toBe('+1.50')
    expect(result.results[2].behind).toBe('+3.20')
  })

  describe('race name construction', () => {
    it('adds " - 1. jízda" suffix for BR1 race', () => {
      const data: C123ResultsData = {
        raceId: 'K1M_ST_BR1_6',
        classId: 'K1M_ST',
        isCurrent: true,
        mainTitle: 'K1m - střední trať',
        subTitle: '',
        rows: [],
      }

      const result = mapResults(data)

      expect(result.raceName).toBe('K1m - střední trať - 1. jízda')
    })

    it('adds " - 2. jízda" suffix for BR2 race', () => {
      const data: C123ResultsData = {
        raceId: 'C1Z_ST_BR2_6',
        classId: 'C1Z_ST',
        isCurrent: true,
        mainTitle: 'C1ž - střední trať',
        subTitle: '',
        rows: [],
      }

      const result = mapResults(data)

      expect(result.raceName).toBe('C1ž - střední trať - 2. jízda')
    })

    it('handles raceId without BR suffix', () => {
      const data: C123ResultsData = {
        raceId: 'K1M_ST_FINAL_6',
        classId: 'K1M_ST',
        isCurrent: true,
        mainTitle: 'K1m - střední trať',
        subTitle: '',
        rows: [],
      }

      const result = mapResults(data)

      // No BR suffix, so no jízda suffix added
      expect(result.raceName).toBe('K1m - střední trať')
    })

    it('falls back to raceId when mainTitle is empty', () => {
      const data: C123ResultsData = {
        raceId: 'K1M_ST_BR1_6',
        classId: 'K1M_ST',
        isCurrent: true,
        mainTitle: '',
        subTitle: '',
        rows: [],
      }

      const result = mapResults(data)

      // Falls back to raceId when mainTitle is empty
      expect(result.raceName).toBe('K1M_ST_BR1_6')
    })
  })

  describe('race status mapping', () => {
    it('maps isCurrent: true to "In Progress"', () => {
      const data: C123ResultsData = {
        raceId: 'K1M_ST_BR1_6',
        classId: 'K1M_ST',
        isCurrent: true,
        mainTitle: 'K1m',
        subTitle: '',
        rows: [],
      }

      const result = mapResults(data)

      expect(result.raceStatus).toBe('In Progress')
    })

    it('maps isCurrent: false to "Unofficial"', () => {
      const data: C123ResultsData = {
        raceId: 'K1M_ST_BR1_6',
        classId: 'K1M_ST',
        isCurrent: false,
        mainTitle: 'K1m',
        subTitle: '',
        rows: [],
      }

      const result = mapResults(data)

      expect(result.raceStatus).toBe('Unofficial')
    })
  })

  // =========================================================================
  // DNS/DNF/DSQ Status Mapping (12.2)
  // =========================================================================
  describe('DNS/DNF/DSQ status mapping', () => {
    it('shows status only when no valid total time', () => {
      const row = createResultRow({
        total: '', // No valid time
        status: 'DNS',
      })
      const data: C123ResultsData = {
        raceId: 'K1M_ST_BR1_6',
        classId: 'K1M_ST',
        isCurrent: true,
        mainTitle: 'K1m',
        subTitle: '',
        rows: [row],
      }

      const result = mapResults(data)

      expect(result.results[0].status).toBe('DNS')
    })

    it('ignores status when valid total time exists', () => {
      // C123 sends total from better run, so if total exists, show time not status
      const row = createResultRow({
        total: '78.99', // Valid time
        status: 'DNF', // Status should be ignored
      })
      const data: C123ResultsData = {
        raceId: 'K1M_ST_BR1_6',
        classId: 'K1M_ST',
        isCurrent: true,
        mainTitle: 'K1m',
        subTitle: '',
        rows: [row],
      }

      const result = mapResults(data)

      expect(result.results[0].status).toBe('')
      expect(result.results[0].total).toBe('78.99')
    })

    it('maps DNF status correctly', () => {
      const row = createResultRow({
        total: '',
        status: 'DNF',
      })
      const data: C123ResultsData = {
        raceId: 'K1M_ST_BR1_6',
        classId: 'K1M_ST',
        isCurrent: true,
        mainTitle: 'K1m',
        subTitle: '',
        rows: [row],
      }

      const result = mapResults(data)

      expect(result.results[0].status).toBe('DNF')
    })

    it('maps DSQ status correctly', () => {
      const row = createResultRow({
        total: '0',
        status: 'DSQ',
      })
      const data: C123ResultsData = {
        raceId: 'K1M_ST_BR1_6',
        classId: 'K1M_ST',
        isCurrent: true,
        mainTitle: 'K1m',
        subTitle: '',
        rows: [row],
      }

      const result = mapResults(data)

      expect(result.results[0].status).toBe('DSQ')
    })

    it('treats total "0" as no valid time', () => {
      const row = createResultRow({
        total: '0',
        status: 'DNS',
      })
      const data: C123ResultsData = {
        raceId: 'K1M_ST_BR1_6',
        classId: 'K1M_ST',
        isCurrent: true,
        mainTitle: 'K1m',
        subTitle: '',
        rows: [row],
      }

      const result = mapResults(data)

      expect(result.results[0].status).toBe('DNS')
    })

    it('treats total "0.00" as no valid time', () => {
      const row = createResultRow({
        total: '0.00',
        status: 'DNF',
      })
      const data: C123ResultsData = {
        raceId: 'K1M_ST_BR1_6',
        classId: 'K1M_ST',
        isCurrent: true,
        mainTitle: 'K1m',
        subTitle: '',
        rows: [row],
      }

      const result = mapResults(data)

      expect(result.results[0].status).toBe('DNF')
    })

    it('normalizes lowercase status to uppercase', () => {
      const row = createResultRow({
        total: '',
        status: 'dns', // lowercase
      })
      const data: C123ResultsData = {
        raceId: 'K1M_ST_BR1_6',
        classId: 'K1M_ST',
        isCurrent: true,
        mainTitle: 'K1m',
        subTitle: '',
        rows: [row],
      }

      const result = mapResults(data)

      expect(result.results[0].status).toBe('DNS')
    })

    it('returns empty status for unknown status values', () => {
      const row = createResultRow({
        total: '',
        status: 'INVALID',
      })
      const data: C123ResultsData = {
        raceId: 'K1M_ST_BR1_6',
        classId: 'K1M_ST',
        isCurrent: true,
        mainTitle: 'K1m',
        subTitle: '',
        rows: [row],
      }

      const result = mapResults(data)

      expect(result.results[0].status).toBe('')
    })

    it('returns empty status when no status field and no valid time', () => {
      const row = createResultRow({
        total: '',
        // no status field
      })
      const data: C123ResultsData = {
        raceId: 'K1M_ST_BR1_6',
        classId: 'K1M_ST',
        isCurrent: true,
        mainTitle: 'K1m',
        subTitle: '',
        rows: [row],
      }

      const result = mapResults(data)

      // No inference - just show "---" in UI (handled by component)
      expect(result.results[0].status).toBe('')
    })
  })

  it('always sets highlightBib to null', () => {
    const data: C123ResultsData = {
      raceId: 'K1M_ST_BR1_6',
      classId: 'K1M_ST',
      isCurrent: true,
      mainTitle: 'K1m',
      subTitle: '',
      rows: [createResultRow()],
    }

    const result = mapResults(data)

    // C123 Server doesn't provide highlightBib - finish detection uses dtFinish
    expect(result.highlightBib).toBeNull()
  })
})

// =============================================================================
// mapTimeOfDay Tests
// =============================================================================

describe('mapTimeOfDay', () => {
  it('maps time correctly', () => {
    const data: C123TimeOfDayData = {
      time: '19:04:20',
    }

    const result = mapTimeOfDay(data)

    expect(result.dayTime).toBe('19:04:20')
    // title and infoText are not included to prevent overwriting
    expect(result.title).toBeUndefined()
    expect(result.infoText).toBeUndefined()
  })

  it('handles different time formats', () => {
    const data: C123TimeOfDayData = {
      time: '08:00:00',
    }

    const result = mapTimeOfDay(data)

    expect(result.dayTime).toBe('08:00:00')
  })
})

// =============================================================================
// mapRaceConfig Tests
// =============================================================================

describe('mapRaceConfig', () => {
  it('maps gate count correctly', () => {
    const data: C123RaceConfigData = {
      nrSplits: 3,
      nrGates: 24,
      gateConfig: 'NNRNNRNRNNNRNNRNRNNRNNRN',
      gateCaptions: '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24',
    }

    const result = mapRaceConfig(data, 'K1m - střední trať', true)

    expect(result.gateCount).toBe(24)
    expect(result.raceName).toBe('K1m - střední trať')
    expect(result.raceStatus).toBe('In Progress')
  })

  it('maps race status based on isCurrent parameter', () => {
    const data: C123RaceConfigData = {
      nrSplits: 2,
      nrGates: 18,
      gateConfig: 'NNRNNNRNRNNRNNNRNR',
      gateCaptions: '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18',
    }

    const resultRunning = mapRaceConfig(data, 'C1ž', true)
    expect(resultRunning.raceStatus).toBe('In Progress')

    const resultFinished = mapRaceConfig(data, 'C1ž', false)
    expect(resultFinished.raceStatus).toBe('Unofficial')
  })

  it('uses default values when optional parameters not provided', () => {
    const data: C123RaceConfigData = {
      nrSplits: 2,
      nrGates: 20,
      gateConfig: 'NNRNNNRNRNNRNNNRNRNN',
      gateCaptions: '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20',
    }

    const result = mapRaceConfig(data)

    expect(result.raceName).toBe('')
    expect(result.raceStatus).toBe('In Progress') // default isCurrent = true
    expect(result.gateCount).toBe(20)
  })
})
