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
  describe('title and category display', () => {
    it('displays "TITLE: CATEGORY" when both title and raceName provided', () => {
      render(<Title title="World Cup 2025" raceName="K1m - střední trať - 2. jízda" />)

      const titleEl = screen.getByTestId('title')
      expect(titleEl).toHaveTextContent('WORLD CUP 2025: K1M')
    })

    it('displays just title when no raceName', () => {
      render(<Title title="World Cup 2025" raceName="" />)

      const titleEl = screen.getByTestId('title')
      expect(titleEl).toHaveTextContent('WORLD CUP 2025')
    })

    it('displays just category when no title (fallback)', () => {
      render(<Title title="" raceName="K1m - střední trať - 2. jízda" />)

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

  describe('uppercase conversion', () => {
    it('converts lowercase title to uppercase', () => {
      render(<Title title="world cup" raceName="" />)

      expect(screen.getByTestId('title')).toHaveTextContent('WORLD CUP')
    })

    it('converts lowercase category to uppercase', () => {
      render(<Title title="" raceName="k1m - střední trať" />)

      expect(screen.getByTestId('title')).toHaveTextContent('K1M')
    })

    it('preserves already uppercase text', () => {
      render(<Title title="WORLD CUP" raceName="K1M - střední trať" />)

      expect(screen.getByTestId('title')).toHaveTextContent('WORLD CUP: K1M')
    })
  })

  describe('edge cases', () => {
    it('handles undefined raceName gracefully', () => {
      render(<Title title="World Cup" />)

      expect(screen.getByTestId('title')).toHaveTextContent('WORLD CUP')
    })

    it('handles special characters in title', () => {
      render(<Title title="Závod 2025 - Praha" raceName="" />)

      expect(screen.getByTestId('title')).toHaveTextContent('ZÁVOD 2025 - PRAHA')
    })

    it('handles special characters in category', () => {
      render(<Title title="" raceName="C1ž-spec - trať" />)

      expect(screen.getByTestId('title')).toHaveTextContent('C1Ž-SPEC')
    })
  })
})
