import { Component, type ReactNode, type ErrorInfo } from 'react'
import styles from './ErrorBoundary.module.css'

/**
 * Props for ErrorBoundary component
 */
interface ErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode
  /** Optional fallback UI to show on error */
  fallback?: ReactNode
  /** Optional callback when error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  /** Component name for logging/display */
  componentName?: string
}

/**
 * State for ErrorBoundary component
 */
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary component for catching and handling React errors
 *
 * Wraps child components and displays a fallback UI if an error occurs,
 * preventing the entire application from crashing.
 *
 * @example
 * ```tsx
 * <ErrorBoundary componentName="ResultsList">
 *   <ResultsList results={results} />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details
    console.error(
      `[ErrorBoundary${this.props.componentName ? `: ${this.props.componentName}` : ''}]`,
      error,
      errorInfo.componentStack
    )

    // Call optional error callback
    this.props.onError?.(error, errorInfo)
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className={styles.errorContainer} data-testid="error-boundary">
          <div className={styles.errorContent}>
            <div className={styles.errorIcon}>⚠️</div>
            <h2 className={styles.errorTitle}>
              {this.props.componentName
                ? `Chyba v ${this.props.componentName}`
                : 'Nastala chyba'}
            </h2>
            <p className={styles.errorMessage}>
              {this.state.error?.message ?? 'Neznámá chyba'}
            </p>
            <button
              className={styles.retryButton}
              onClick={this.handleRetry}
              data-testid="error-boundary-retry"
            >
              Zkusit znovu
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Higher-order component to wrap a component with ErrorBoundary
 *
 * @example
 * ```tsx
 * const SafeResultsList = withErrorBoundary(ResultsList, 'ResultsList')
 * ```
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
): React.FC<P> {
  const WithErrorBoundary: React.FC<P> = (props: P) => (
    <ErrorBoundary componentName={componentName}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )

  WithErrorBoundary.displayName = `WithErrorBoundary(${componentName ?? WrappedComponent.displayName ?? WrappedComponent.name ?? 'Component'})`

  return WithErrorBoundary
}

export default ErrorBoundary
