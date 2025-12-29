import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ConnectionStatus } from '../../ConnectionStatus/ConnectionStatus'

describe('ConnectionStatus snapshots', () => {
  describe('connection states', () => {
    it('should match snapshot - connecting', () => {
      const { container } = render(
        <ConnectionStatus
          status="connecting"
          error={null}
          initialDataReceived={false}
        />
      )
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - connected waiting for data', () => {
      const { container } = render(
        <ConnectionStatus
          status="connected"
          error={null}
          initialDataReceived={false}
        />
      )
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - connected with data (hidden)', () => {
      const { container } = render(
        <ConnectionStatus
          status="connected"
          error={null}
          initialDataReceived={true}
        />
      )
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - reconnecting', () => {
      const { container } = render(
        <ConnectionStatus
          status="reconnecting"
          error={null}
          initialDataReceived={false}
        />
      )
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - disconnected', () => {
      const { container } = render(
        <ConnectionStatus
          status="disconnected"
          error={null}
          initialDataReceived={false}
        />
      )
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - disconnected with retry button', () => {
      const onRetry = vi.fn()
      const { container } = render(
        <ConnectionStatus
          status="disconnected"
          error={null}
          initialDataReceived={false}
          onRetry={onRetry}
        />
      )
      expect(container).toMatchSnapshot()
    })
  })

  describe('error states', () => {
    it('should match snapshot - error without message', () => {
      const { container } = render(
        <ConnectionStatus
          status="error"
          error={null}
          initialDataReceived={false}
        />
      )
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - error with message', () => {
      const { container } = render(
        <ConnectionStatus
          status="error"
          error="WebSocket connection failed: timeout"
          initialDataReceived={false}
        />
      )
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - error with retry button', () => {
      const onRetry = vi.fn()
      const { container } = render(
        <ConnectionStatus
          status="error"
          error="Server unavailable"
          initialDataReceived={false}
          onRetry={onRetry}
        />
      )
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - long error message', () => {
      const { container } = render(
        <ConnectionStatus
          status="error"
          error="Connection failed after 5 retries. The WebSocket server at ws://192.168.68.108:8081 is not responding. Please check the server status and network connectivity."
          initialDataReceived={false}
        />
      )
      expect(container).toMatchSnapshot()
    })
  })
})
