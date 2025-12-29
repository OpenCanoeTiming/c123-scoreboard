import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { CurrentCompetitor } from '../../CurrentCompetitor/CurrentCompetitor'
import type { OnCourseCompetitor } from '@/types'

const baseCompetitor: OnCourseCompetitor = {
  bib: '42',
  name: 'NOVAK Jan',
  club: 'SKP Praha',
  time: '95.32',
  pen: 0,
  gates: '0,0,0,0,0',
  ttbDiff: '',
  ttbName: '',
  rank: 1,
  dtStart: Date.now() - 95000,
  dtFinish: null,
}

describe('CurrentCompetitor snapshots', () => {
  describe('basic states', () => {
    it('should match snapshot - running competitor', () => {
      const { container } = render(<CurrentCompetitor competitor={baseCompetitor} />)
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - finished competitor', () => {
      const competitor: OnCourseCompetitor = {
        ...baseCompetitor,
        dtFinish: Date.now(),
      }
      const { container } = render(<CurrentCompetitor competitor={competitor} />)
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - hidden', () => {
      const { container } = render(
        <CurrentCompetitor competitor={baseCompetitor} visible={false} />
      )
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - departing competitor', () => {
      const { container } = render(
        <CurrentCompetitor competitor={baseCompetitor} isDeparting={true} />
      )
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - null competitor', () => {
      const { container } = render(<CurrentCompetitor competitor={null} />)
      expect(container).toMatchSnapshot()
    })
  })

  describe('TTB (Time To Beat) states', () => {
    it('should match snapshot - ahead of leader', () => {
      const competitor: OnCourseCompetitor = {
        ...baseCompetitor,
        ttbDiff: '-1.23',
        ttbName: 'SVOBODA Petr',
        rank: 1,
      }
      const { container } = render(<CurrentCompetitor competitor={competitor} />)
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - behind leader', () => {
      const competitor: OnCourseCompetitor = {
        ...baseCompetitor,
        ttbDiff: '+2.45',
        ttbName: 'SVOBODA Petr',
        rank: 2,
      }
      const { container } = render(<CurrentCompetitor competitor={competitor} />)
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - exactly on pace', () => {
      const competitor: OnCourseCompetitor = {
        ...baseCompetitor,
        ttbDiff: '0.00',
        ttbName: 'SVOBODA Petr',
        rank: 1,
      }
      const { container } = render(<CurrentCompetitor competitor={competitor} />)
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - no TTB info', () => {
      const competitor: OnCourseCompetitor = {
        ...baseCompetitor,
        ttbDiff: '',
        ttbName: '',
        rank: 0,
      }
      const { container } = render(<CurrentCompetitor competitor={competitor} />)
      expect(container).toMatchSnapshot()
    })
  })

  describe('gate penalty states', () => {
    it('should match snapshot - all gates clear', () => {
      const competitor: OnCourseCompetitor = {
        ...baseCompetitor,
        gates: '0,0,0,0,0,0,0,0,0,0',
        pen: 0,
      }
      const { container } = render(<CurrentCompetitor competitor={competitor} />)
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - single touch (2s)', () => {
      const competitor: OnCourseCompetitor = {
        ...baseCompetitor,
        gates: '0,2,0,0,0,0,0,0,0,0',
        pen: 2,
      }
      const { container } = render(<CurrentCompetitor competitor={competitor} />)
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - single miss (50s)', () => {
      const competitor: OnCourseCompetitor = {
        ...baseCompetitor,
        gates: '0,0,50,0,0,0,0,0,0,0',
        pen: 50,
      }
      const { container } = render(<CurrentCompetitor competitor={competitor} />)
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - multiple penalties mixed', () => {
      const competitor: OnCourseCompetitor = {
        ...baseCompetitor,
        gates: '0,2,0,50,2,0,0,0,0,0',
        pen: 54,
      }
      const { container } = render(<CurrentCompetitor competitor={competitor} />)
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - partially completed gates', () => {
      const competitor: OnCourseCompetitor = {
        ...baseCompetitor,
        gates: '0,0,2,,,,,,,,',
        pen: 2,
      }
      const { container } = render(<CurrentCompetitor competitor={competitor} />)
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - no gates (empty string)', () => {
      const competitor: OnCourseCompetitor = {
        ...baseCompetitor,
        gates: '',
        pen: 0,
      }
      const { container } = render(<CurrentCompetitor competitor={competitor} />)
      expect(container).toMatchSnapshot()
    })
  })

  describe('name formatting', () => {
    it('should match snapshot - long name', () => {
      const competitor: OnCourseCompetitor = {
        ...baseCompetitor,
        name: 'ALEXANDROPOULOS-SMITHSON Christina Maria',
        club: 'Kajak Klub Bratislava - Výkonný oddíl',
      }
      const { container } = render(<CurrentCompetitor competitor={competitor} />)
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - short name', () => {
      const competitor: OnCourseCompetitor = {
        ...baseCompetitor,
        name: 'LI Wei',
        club: 'CHN',
      }
      const { container } = render(<CurrentCompetitor competitor={competitor} />)
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - country code as club', () => {
      const competitor: OnCourseCompetitor = {
        ...baseCompetitor,
        name: 'FOX Jessica',
        club: 'AUS',
      }
      const { container } = render(<CurrentCompetitor competitor={competitor} />)
      expect(container).toMatchSnapshot()
    })
  })
})
