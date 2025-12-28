import type React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary, withErrorBoundary } from '../ErrorBoundary'

/**
 * Component that throws an error for testing
 */
function ThrowingComponent({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div data-testid="child-content">Child content</div>
}

/**
 * Component that throws with custom message
 */
function ThrowingWithMessage({ message }: { message: string }): React.ReactNode {
  throw new Error(message)
}

describe('ErrorBoundary', () => {
  // Suppress console.error during tests since we expect errors
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = vi.fn()
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  describe('normal rendering', () => {
    it('renders children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>
      )

      expect(screen.getByTestId('child-content')).toBeInTheDocument()
      expect(screen.getByText('Child content')).toBeInTheDocument()
    })

    it('renders multiple children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div data-testid="first">First</div>
          <div data-testid="second">Second</div>
        </ErrorBoundary>
      )

      expect(screen.getByTestId('first')).toBeInTheDocument()
      expect(screen.getByTestId('second')).toBeInTheDocument()
    })
  })

  describe('error handling', () => {
    it('renders error UI when child throws', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
      expect(screen.queryByTestId('child-content')).not.toBeInTheDocument()
    })

    it('displays error message from thrown error', () => {
      render(
        <ErrorBoundary>
          <ThrowingWithMessage message="Custom error message" />
        </ErrorBoundary>
      )

      expect(screen.getByText('Custom error message')).toBeInTheDocument()
    })

    it('displays default title when no componentName provided', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Nastala chyba')).toBeInTheDocument()
    })

    it('displays component name in title when provided', () => {
      render(
        <ErrorBoundary componentName="ResultsList">
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Chyba v ResultsList')).toBeInTheDocument()
    })

    it('calls onError callback when error occurs', () => {
      const onError = vi.fn()

      render(
        <ErrorBoundary onError={onError}>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      )
    })

    it('logs error to console with component name', () => {
      render(
        <ErrorBoundary componentName="TestComponent">
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(console.error).toHaveBeenCalledWith(
        '[ErrorBoundary: TestComponent]',
        expect.any(Error),
        expect.any(String)
      )
    })

    it('logs error to console without component name', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(console.error).toHaveBeenCalledWith(
        '[ErrorBoundary]',
        expect.any(Error),
        expect.any(String)
      )
    })
  })

  describe('custom fallback', () => {
    it('renders custom fallback when provided', () => {
      render(
        <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom fallback</div>}>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
      expect(screen.getByText('Custom fallback')).toBeInTheDocument()
      expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument()
    })

    it('does not show default error UI when custom fallback provided', () => {
      render(
        <ErrorBoundary fallback={<span>Fallback</span>}>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.queryByText('Nastala chyba')).not.toBeInTheDocument()
      expect(screen.queryByTestId('error-boundary-retry')).not.toBeInTheDocument()
    })
  })

  describe('retry functionality', () => {
    it('renders retry button in default error UI', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
      expect(screen.getByText('Zkusit znovu')).toBeInTheDocument()
    })

    it('resets error state when retry is clicked', () => {
      let shouldThrow = true

      function ConditionalThrow() {
        if (shouldThrow) {
          throw new Error('Error')
        }
        return <div data-testid="recovered">Recovered content</div>
      }

      const { rerender } = render(
        <ErrorBoundary>
          <ConditionalThrow />
        </ErrorBoundary>
      )

      // Error state
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument()

      // Fix the error and click retry
      shouldThrow = false
      fireEvent.click(screen.getByTestId('error-boundary-retry'))

      // Re-render to reflect state change
      rerender(
        <ErrorBoundary>
          <ConditionalThrow />
        </ErrorBoundary>
      )

      // Should now show recovered content
      expect(screen.getByTestId('recovered')).toBeInTheDocument()
      expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument()
    })
  })

  describe('error boundary isolation', () => {
    it('does not affect sibling components', () => {
      render(
        <div>
          <ErrorBoundary>
            <ThrowingComponent />
          </ErrorBoundary>
          <div data-testid="sibling">Sibling content</div>
        </div>
      )

      expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
      expect(screen.getByTestId('sibling')).toBeInTheDocument()
      expect(screen.getByText('Sibling content')).toBeInTheDocument()
    })

    it('isolates errors in nested boundaries', () => {
      render(
        <ErrorBoundary componentName="Outer">
          <div data-testid="outer-content">Outer works</div>
          <ErrorBoundary componentName="Inner">
            <ThrowingComponent />
          </ErrorBoundary>
        </ErrorBoundary>
      )

      expect(screen.getByTestId('outer-content')).toBeInTheDocument()
      expect(screen.getByText('Chyba v Inner')).toBeInTheDocument()
      expect(screen.queryByText('Chyba v Outer')).not.toBeInTheDocument()
    })
  })
})

describe('withErrorBoundary HOC', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = vi.fn()
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  it('wraps component with error boundary', () => {
    function MyComponent(): React.ReactNode {
      throw new Error('Test error')
    }

    const WrappedComponent = withErrorBoundary(MyComponent, 'MyComponent')
    render(<WrappedComponent />)

    expect(screen.getByText('Chyba v MyComponent')).toBeInTheDocument()
  })

  it('passes props to wrapped component', () => {
    function MyComponent({ message }: { message: string }) {
      return <div data-testid="message">{message}</div>
    }

    const WrappedComponent = withErrorBoundary(MyComponent, 'MyComponent')
    render(<WrappedComponent message="Hello" />)

    expect(screen.getByTestId('message')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('sets displayName on wrapped component', () => {
    function MyComponent() {
      return <div>Content</div>
    }
    MyComponent.displayName = 'MyComponent'

    const WrappedComponent = withErrorBoundary(MyComponent, 'MyComponent')

    expect(WrappedComponent.displayName).toBe('WithErrorBoundary(MyComponent)')
  })

  it('uses component name for displayName when no displayName', () => {
    function SomeComponent() {
      return <div>Content</div>
    }

    const WrappedComponent = withErrorBoundary(SomeComponent)

    expect(WrappedComponent.displayName).toBe('WithErrorBoundary(SomeComponent)')
  })

  it('catches errors from wrapped component', () => {
    function UnstableComponent({ fail }: { fail: boolean }) {
      if (fail) {
        throw new Error('Component failed')
      }
      return <div data-testid="stable">Stable</div>
    }

    const SafeComponent = withErrorBoundary(UnstableComponent, 'UnstableComponent')

    // First render without error
    const { rerender } = render(<SafeComponent fail={false} />)
    expect(screen.getByTestId('stable')).toBeInTheDocument()

    // Trigger error
    rerender(<SafeComponent fail={true} />)
    expect(screen.getByText('Chyba v UnstableComponent')).toBeInTheDocument()
  })
})
