import { describe, it, expect } from 'vitest'
import {
  transformTopMessage,
  transformCompMessage,
  transformOnCourseMessage,
  transformControlMessage,
  transformTitleMessage,
  transformInfoTextMessage,
  transformDayTimeMessage,
} from '../messageHandlers'

describe('messageHandlers', () => {
  describe('transformTopMessage', () => {
    it('should transform top payload to ResultsData', () => {
      const payload = {
        RaceName: 'K1 Men',
        RaceStatus: 'Final',
        HighlightBib: '42',
        list: [
          { Bib: '1', Name: 'Athlete One', Total: '95.32', Rank: 1 },
          { Bib: '2', Name: 'Athlete Two', Total: '96.45', Rank: 2 },
        ],
      }

      const result = transformTopMessage(payload, { skipValidation: true })

      expect(result.raceName).toBe('K1 Men')
      expect(result.raceStatus).toBe('Final')
      expect(result.highlightBib).toBe('42')
      expect(result.results.length).toBe(2)
      expect(result.results[0].bib).toBe('1')
    })

    it('should handle missing optional fields', () => {
      const payload = {
        RaceName: 'Test Race',
        RaceStatus: '',
      }

      const result = transformTopMessage(payload)

      expect(result.raceName).toBe('Test Race')
      expect(result.raceStatus).toBe('')
      expect(result.highlightBib).toBeNull()
    })

    it('should pass skipValidation option', () => {
      const payload = {
        RaceName: 'Quick Race',
        Row1: { Bib: '1', Name: 'Test', Time: '100.00', Rank: '1' },
      }

      // Should not throw with skipValidation
      const result = transformTopMessage(payload, { skipValidation: true })
      expect(result.raceName).toBe('Quick Race')
    })
  })

  describe('transformCompMessage', () => {
    it('should transform comp payload to OnCourseData', () => {
      const payload = {
        Bib: '15',
        Name: 'John Doe',
        Category: 'K1M',
        Time: '45.67',
      }

      const result = transformCompMessage(payload)

      expect(result.current).not.toBeNull()
      expect(result.current?.bib).toBe('15')
      expect(result.onCourse).toHaveLength(1)
    })

    it('should handle empty competitor', () => {
      const payload = {
        Bib: '',
        Name: '',
      }

      const result = transformCompMessage(payload)

      expect(result.current).toBeNull()
      expect(result.onCourse).toHaveLength(0)
    })
  })

  describe('transformOnCourseMessage', () => {
    it('should transform array of competitors', () => {
      const competitors = [
        { Bib: '1', Name: 'First', Category: 'K1M' },
        { Bib: '2', Name: 'Second', Category: 'K1M' },
      ]

      const result = transformOnCourseMessage(competitors)

      expect(result.onCourse).toHaveLength(2)
      expect(result.current?.bib).toBe('1')
    })

    it('should filter out invalid competitors', () => {
      const competitors = [
        { Bib: '1', Name: 'Valid' },
        null,
        'not-an-object',
        { Bib: '', Name: '' }, // empty = filtered
      ]

      const result = transformOnCourseMessage(competitors)

      expect(result.onCourse).toHaveLength(1)
    })

    it('should handle empty array', () => {
      const result = transformOnCourseMessage([])

      expect(result.onCourse).toHaveLength(0)
      expect(result.current).toBeNull()
    })
  })

  describe('transformControlMessage', () => {
    it('should transform control payload to VisibilityState', () => {
      const payload = {
        displayCurrent: '1',
        displayTop: '1',
        displayTitle: '0',
        displayTopBar: '1',
        displayFooter: '0',
        displayDayTime: '1',
        displayOnCourse: '0',
      }

      const result = transformControlMessage(payload)

      expect(result.displayCurrent).toBe(true)
      expect(result.displayTop).toBe(true)
      expect(result.displayTitle).toBe(false)
      expect(result.displayTopBar).toBe(true)
      expect(result.displayFooter).toBe(false)
      expect(result.displayDayTime).toBe(true)
      expect(result.displayOnCourse).toBe(false)
    })

    it('should handle missing fields as false', () => {
      const payload = {}

      const result = transformControlMessage(payload)

      expect(result.displayCurrent).toBe(false)
      expect(result.displayTop).toBe(false)
    })
  })

  describe('transformTitleMessage', () => {
    it('should transform title payload to EventInfoData', () => {
      const payload = { text: 'Race Title 2025' }

      const result = transformTitleMessage(payload)

      expect(result.title).toBe('Race Title 2025')
      expect(result.infoText).toBe('')
      expect(result.dayTime).toBe('')
    })

    it('should handle missing text', () => {
      const result = transformTitleMessage({})

      expect(result.title).toBe('')
    })
  })

  describe('transformInfoTextMessage', () => {
    it('should transform infotext payload to EventInfoData', () => {
      const payload = { text: 'Heat 1 of 3' }

      const result = transformInfoTextMessage(payload)

      expect(result.title).toBe('')
      expect(result.infoText).toBe('Heat 1 of 3')
      expect(result.dayTime).toBe('')
    })
  })

  describe('transformDayTimeMessage', () => {
    it('should transform daytime payload to EventInfoData', () => {
      const payload = { time: '14:30:45' }

      const result = transformDayTimeMessage(payload)

      expect(result.title).toBe('')
      expect(result.infoText).toBe('')
      expect(result.dayTime).toBe('14:30:45')
    })

    it('should handle missing time', () => {
      const result = transformDayTimeMessage({})

      expect(result.dayTime).toBe('')
    })
  })
})
