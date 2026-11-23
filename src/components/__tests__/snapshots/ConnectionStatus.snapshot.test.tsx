import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ConnectionStatus as ConnectionStatusComponent } from '../../ConnectionStatus/ConnectionStatus'
import { toConnectionView } from '@/view/legacyAdapter'

// Renders the legacy connection fields through the legacy adapter, as the board does
function ConnectionStatus({
  status,
  initialDataReceived,
}: {
  status: Parameters<typeof toConnectionView>[0]
  initialDataReceived: boolean
}) {
  return <ConnectionStatusComponent connection={toConnectionView(status, initialDataReceived)} />
}

describe('ConnectionStatus snapshots', () => {
  describe('connection states', () => {
    it('should match snapshot - connecting', () => {
      const { container } = render(
        <ConnectionStatus
          status="connecting"
          initialDataReceived={false}
        />
      )
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - connected waiting for data', () => {
      const { container } = render(
        <ConnectionStatus
          status="connected"
          initialDataReceived={false}
        />
      )
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - connected with data', () => {
      const { container } = render(
        <ConnectionStatus
          status="connected"
          initialDataReceived={true}
        />
      )
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - reconnecting', () => {
      const { container } = render(
        <ConnectionStatus
          status="reconnecting"
          initialDataReceived={false}
        />
      )
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - disconnected', () => {
      const { container } = render(
        <ConnectionStatus
          status="disconnected"
          initialDataReceived={false}
        />
      )
      expect(container).toMatchSnapshot()
    })

    it('should match snapshot - error', () => {
      const { container } = render(
        <ConnectionStatus
          status="error"
          initialDataReceived={false}
        />
      )
      expect(container).toMatchSnapshot()
    })
  })
})
