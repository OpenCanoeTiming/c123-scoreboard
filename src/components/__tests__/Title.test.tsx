import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Title } from '../EventInfo/Title'

// Mock useLayout hook
vi.mock('@/hooks', () => ({
  useLayout: () => ({ layoutMode: 'normal' }),
}))

// =============================================================================
// Title Component Tests (12.4)
// =============================================================================

describe('Title component', () => {
  describe('title and race identification display', () => {
    it('displays "Title CATEGORY/RUN." when all props provided', () => {
      render(<Title title="Jarní slalomy" raceName="K1m - střední trať" raceId="K1M_ST_BR1_6" />)

      const titleEl = screen.getByTestId('title')
      expect(titleEl).toHaveTextContent('Jarní slalomy K1M/1.')
    })

    it('displays "Title CATEGORY/2." for BR2 races', () => {
      render(<Title title="Jarní slalomy" raceName="K1m - střední trať" raceId="K1M_ST_BR2_6" />)

      const titleEl = screen.getByTestId('title')
      expect(titleEl).toHaveTextContent('Jarní slalomy K1M/2.')
    })

    it('displays "Title CATEGORY" when no raceId (no run number)', () => {
      render(<Title title="World Cup 2025" raceName="K1m - střední trať" />)

      const titleEl = screen.getByTestId('title')
      expect(titleEl).toHaveTextContent('World Cup 2025 K1M')
    })

    it('displays just title when no raceName', () => {
      render(<Title title="World Cup 2025" raceName="" />)

      const titleEl = screen.getByTestId('title')
      expect(titleEl).toHaveTextContent('World Cup 2025')
    })

    it('displays just category with run when no title (fallback)', () => {
      render(<Title title="" raceName="K1m - střední trať" raceId="K1M_ST_BR1_6" />)

      const titleEl = screen.getByTestId('title')
      expect(titleEl).toHaveTextContent('K1M/1.')
    })

    it('displays just category when no title and no raceId', () => {
      render(<Title title="" raceName="K1m - střední trať" />)

      const titleEl = screen.getByTestId('title')
      expect(titleEl).toHaveTextContent('K1M')
    })

    it('returns null when neither title nor category', () => {
      const { container } = render(<Title title="" raceName="" />)

      expect(container.firstChild).toBeNull()
    })

    it('returns null when not visible', () => {
      const { container } = render(
        <Title title="World Cup" raceName="K1m" visible={false} />
      )

      expect(container.firstChild).toBeNull()
    })
  })

  describe('category extraction from raceName', () => {
    it('extracts category from standard format', () => {
      render(<Title title="" raceName="K1m - střední trať - 2. jízda" />)

      expect(screen.getByTestId('title')).toHaveTextContent('K1M')
    })

    it('extracts category from C1ž race', () => {
      render(<Title title="" raceName="C1ž - horní trať - 1. jízda" />)

      expect(screen.getByTestId('title')).toHaveTextContent('C1Ž')
    })

    it('extracts category from C2m race', () => {
      render(<Title title="" raceName="C2m - dolní trať" />)

      expect(screen.getByTestId('title')).toHaveTextContent('C2M')
    })

    it('handles raceName without dashes', () => {
      render(<Title title="" raceName="K1M" />)

      expect(screen.getByTestId('title')).toHaveTextContent('K1M')
    })

    it('handles empty category part after split', () => {
      // Edge case: " - something" would result in empty first part
      render(<Title title="" raceName=" - střední trať" />)

      // Should return null since category is empty after trim
      const { container } = render(<Title title="" raceName=" - střední trať" />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('run number extraction from raceId', () => {
    it('extracts run 1 from BR1 raceId', () => {
      render(<Title title="" raceName="K1m - střední" raceId="K1M_ST_BR1_6" />)

      expect(screen.getByTestId('title')).toHaveTextContent('K1M/1.')
    })

    it('extracts run 2 from BR2 raceId', () => {
      render(<Title title="" raceName="K1m - střední" raceId="K1M_ST_BR2_6" />)

      expect(screen.getByTestId('title')).toHaveTextContent('K1M/2.')
    })

    it('shows no run number for non-BR raceId', () => {
      render(<Title title="" raceName="K1m - střední" raceId="K1M_ST_XF_6" />)

      expect(screen.getByTestId('title')).toHaveTextContent('K1M')
    })

    it('shows no run number when raceId is empty', () => {
      render(<Title title="" raceName="K1m - střední" raceId="" />)

      expect(screen.getByTestId('title')).toHaveTextContent('K1M')
    })
  })

  describe('title preservation (no uppercase conversion)', () => {
    it('preserves title case as provided', () => {
      render(<Title title="Jarní Slalomy" raceName="" />)

      expect(screen.getByTestId('title')).toHaveTextContent('Jarní Slalomy')
    })

    it('preserves lowercase title', () => {
      render(<Title title="world cup" raceName="" />)

      expect(screen.getByTestId('title')).toHaveTextContent('world cup')
    })

    it('converts category to uppercase', () => {
      render(<Title title="" raceName="k1m - střední trať" />)

      expect(screen.getByTestId('title')).toHaveTextContent('K1M')
    })
  })

  describe('edge cases', () => {
    it('handles undefined raceName gracefully', () => {
      render(<Title title="World Cup" />)

      expect(screen.getByTestId('title')).toHaveTextContent('World Cup')
    })

    it('handles special characters in title', () => {
      render(<Title title="Závod 2025 - Praha" raceName="" />)

      expect(screen.getByTestId('title')).toHaveTextContent('Závod 2025 - Praha')
    })

    it('handles special characters in category', () => {
      render(<Title title="" raceName="C1ž-spec - trať" />)

      expect(screen.getByTestId('title')).toHaveTextContent('C1Ž-SPEC')
    })

    it('combines title and race identification with space', () => {
      render(<Title title="Event" raceName="K1m - trať" raceId="K1M_ST_BR1_1" />)

      expect(screen.getByTestId('title').textContent).toBe('Event K1M/1.')
    })
  })
})
