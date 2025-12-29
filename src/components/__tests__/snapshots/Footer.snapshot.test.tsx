import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Footer } from '../../Footer/Footer'

describe('Footer snapshots', () => {
  it('should match snapshot when visible', () => {
    const { container } = render(<Footer visible={true} />)
    expect(container).toMatchSnapshot()
  })

  it('should match snapshot when hidden', () => {
    const { container } = render(<Footer visible={false} />)
    expect(container).toMatchSnapshot()
  })

  it('should match snapshot with default props', () => {
    const { container } = render(<Footer />)
    expect(container).toMatchSnapshot()
  })
})
