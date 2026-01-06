# Data Providers

Scoreboard V3 uses an abstract `DataProvider` interface to decouple the UI from data sources. This document describes the interface and available implementations.

## DataProvider Interface

All providers implement the same interface defined in `src/providers/types.ts`:

```typescript
interface DataProvider {
  // Connection
  connect(): Promise<void>
  disconnect(): void
  readonly status: ConnectionStatus  // 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  readonly connected: boolean

  // Event subscriptions (all return Unsubscribe function)
  onResults(callback: (data: ResultsData) => void): Unsubscribe
  onOnCourse(callback: (data: OnCourseData) => void): Unsubscribe
  onConfig(callback: (config: RaceConfig) => void): Unsubscribe
  onVisibility(callback: (visibility: VisibilityState) => void): Unsubscribe
  onEventInfo(callback: (info: EventInfoData) => void): Unsubscribe
  onConnectionChange(callback: (status: ConnectionStatus) => void): Unsubscribe
  onError(callback: (error: ProviderError) => void): Unsubscribe
}
```

### Data Types

| Type | Description |
|------|-------------|
| `ResultsData` | Results list with raceName, raceStatus, highlightBib, raceId, isBR2 |
| `OnCourseData` | Current competitor and onCourse list |
| `EventInfoData` | title, infoText, dayTime (all optional) |
| `RaceConfig` | Race configuration (gates count, etc.) |
| `VisibilityState` | Which UI sections to show/hide |
| `ProviderError` | Error with code, message, cause, timestamp |

---

## C123ServerProvider (Primary)

**File:** `src/providers/C123ServerProvider.ts`

Primary provider for production use. Connects to C123 Server via WebSocket and receives JSON messages.

### Connection

```typescript
const provider = new C123ServerProvider('http://192.168.1.50:27123', {
  autoReconnect: true,        // default: true
  maxReconnectDelay: 30000,   // default: 30000ms
  initialReconnectDelay: 1000, // default: 1000ms
  apiTimeout: 5000,           // default: 5000ms
  syncOnReconnect: true,      // default: true
  clientId: 'scoreboard-1'    // default: from URL ?clientId param
})

await provider.connect()
```

### WebSocket Protocol

**Endpoint:** `ws://server:27123/ws` (or `ws://server:27123/ws?clientId=xxx`)

**Message format:** JSON with `type` and `data` fields.

| Message Type | Description |
|--------------|-------------|
| `Connected` | Server connection info (version, c123Connected, xmlLoaded) |
| `TimeOfDay` | Current time from timing system |
| `OnCourse` | List of competitors currently on course |
| `Results` | Current race results (mainTitle, raceId, competitors, isCurrent) |
| `RaceConfig` | Race configuration (numberOfGates, courseName) |
| `Schedule` | Race schedule (informational) |
| `XmlChange` | XML data changed notification with checksum |
| `Error` | Server error (code, message) |
| `ForceRefresh` | Command to reload page |
| `ConfigPush` | Remote configuration (type, displayRows, customTitle, assets, clientId) |

### REST API Sync

After reconnection, the provider syncs state via REST API:

- `GET /api/status` - Server status and current race info
- `GET /api/discover` - Server discovery and event name
- `GET /api/xml/races/:id` - Race info for sync
- `GET /api/xml/races/:id/results?merged=true` - BR1+BR2 merged results

### BR2 Mode

C123ServerProvider includes `BR2Manager` for handling BR1/BR2 merge display:

1. Detects BR2 races by race ID suffix `_BR2_`
2. Fetches BR1 results via REST API
3. Merges BR1 times into BR2 results for two-column display
4. Re-emits results when BR1 cache is updated

### Features

- Exponential backoff reconnection (1s -> 2s -> 4s -> ... -> 30s cap)
- REST API sync after reconnect
- ConfigPush handling with URL parameter updates
- ForceRefresh support (page reload)
- clientId persistence to localStorage
- BR1/BR2 result merging

---

## CLIProvider (Fallback)

**File:** `src/providers/CLIProvider.ts`

Legacy provider for backwards compatibility. Connects to CLI tool WebSocket server.

### Connection

```typescript
const provider = new CLIProvider('ws://localhost:8081', {
  autoReconnect: true,        // default: true
  maxReconnectDelay: 30000,   // default: 30000ms
  initialReconnectDelay: 1000  // default: 1000ms
})

await provider.connect()
```

### WebSocket Protocol

**Endpoint:** `ws://host:8081`

**Message format:** JSON with `msg` (or `type`) and `data` fields.

| Message Type | Description |
|--------------|-------------|
| `top` | Results update |
| `comp` | Current competitor update |
| `oncourse` | On-course list update |
| `control` | Visibility control |
| `title` | Event title |
| `infotext` | Info text |
| `daytime` | Current time |

### When to Use

- When C123 Server is not available
- For compatibility with existing CLI-based setups
- Testing with CLI tool replay

### Limitations

- No BR1/BR2 merge support
- No ConfigPush support
- No clientId support
- No REST API sync

---

## ReplayProvider (Development)

**File:** `src/providers/ReplayProvider.ts`

Development provider that replays recorded JSONL sessions.

### Connection

```typescript
// From URL
const provider = new ReplayProvider('/recordings/session.jsonl', {
  speed: 1.0,           // default: 1.0 (realtime)
  sources: ['ws'],      // default: ['ws'] - filter by source
  autoPlay: true,       // default: true
  loop: false,          // default: false
  pauseAfter: null      // default: null (don't pause)
})

await provider.connect()
```

### JSONL Format

Each line is a JSON object:

```json
{"ts": 0, "src": "ws", "type": "top", "data": {...}}
{"ts": 150, "src": "ws", "type": "comp", "data": {...}}
{"ts": 1000, "src": "tcp", "type": "TimeOfDay", "data": "<xml>..."}
```

Fields:
- `ts` - Timestamp in ms from recording start
- `src` - Source: `ws`, `tcp`, `udp27333`, `udp10600`
- `type` - Message type
- `data` - Message payload

### Playback Controls

```typescript
provider.play()       // Start/resume playback
provider.pause()      // Pause playback
provider.resume()     // Resume after pause
provider.stop()       // Stop and reset to beginning
provider.seek(5000)   // Seek to position (ms)
provider.setSpeed(2)  // Change speed multiplier

// Properties
provider.position     // Current position in ms
provider.duration     // Total duration in ms
provider.state        // 'idle' | 'playing' | 'paused' | 'finished'
provider.messageCount // Number of loaded messages
```

### Recording Location

Development recordings are stored in:
```
../analysis/recordings/rec-YYYY-MM-DDTHH-MM-SS.jsonl
```

---

## Auto-Discovery

**File:** `src/providers/utils/discovery-client.ts`

C123 Server can be automatically discovered on the local network.

### Discovery Priority

1. **URL parameter** `?server=host:port` - Explicit configuration
2. **localStorage cache** - Verify if cached server still alive
3. **Subnet scan** - Scan local network for C123 Server

### Usage

```typescript
import { discoverC123Server } from '@/providers/utils/discovery-client'

const serverUrl = await discoverC123Server({
  port: 27123,           // default: 27123
  timeout: 200,          // default: 200ms per probe
  noCache: false,        // default: false
  ignoreUrlParam: false, // default: false
  subnets: ['192.168.1'] // default: auto-detect
})

if (serverUrl) {
  console.log('Found server:', serverUrl)
}
```

### Subnet Scanning

Scans IPs in optimized order:
1. Priority hosts: .1, .2, .10, .100, .50, .150, .200, .254
2. Remaining hosts: .3 to .253

Scans in batches of 20 for performance.

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `C123_PORT` | 27123 | Default server port |
| `DISCOVERY_TIMEOUT` | 200ms | Subnet scan timeout per probe |
| `PROBE_TIMEOUT` | 3000ms | Cached/explicit server timeout |
| `STORAGE_KEY` | `c123-server-url` | localStorage key for cache |
| `CLIENT_ID_STORAGE_KEY` | `c123-clientId` | localStorage key for clientId |

---

## Reconnect Logic

Both C123ServerProvider and CLIProvider implement exponential backoff:

```
Attempt 1: wait 1000ms
Attempt 2: wait 2000ms
Attempt 3: wait 4000ms
Attempt 4: wait 8000ms
Attempt 5: wait 16000ms
Attempt 6+: wait 30000ms (capped)
```

After successful connection, the delay resets to initial value.

### C123ServerProvider Reconnect Flow

1. WebSocket disconnects
2. Set status to `reconnecting`
3. Schedule reconnect with current delay
4. Attempt reconnect
5. On success:
   - Set status to `connected`
   - Reset delay to initial
   - Fetch event name via `/api/discover`
   - Sync state via REST API (if `syncOnReconnect: true`)
6. On failure: schedule next attempt with doubled delay

---

## Provider Selection in App

The provider is selected based on URL parameters in `App.tsx`:

```typescript
// ?source=replay&recording=path.jsonl
if (source === 'replay') {
  provider = new ReplayProvider(recording, { speed, loop, pauseAfter })
}
// ?source=cli&server=host:port
else if (source === 'cli') {
  provider = new CLIProvider(serverUrl)
}
// Default: C123 Server with auto-discovery
else {
  const serverUrl = await discoverC123Server()
  provider = new C123ServerProvider(serverUrl)
}
```

### URL Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `source` | Provider type | `c123`, `cli`, `replay` |
| `server` | Server URL | `192.168.1.50:27123` |
| `recording` | JSONL file path | `/recordings/session.jsonl` |
| `speed` | Replay speed multiplier | `2` |
| `loop` | Loop replay | `true` |
| `pauseAfter` | Pause after N messages | `100` |

---

## Error Handling

Providers emit errors through the `onError` callback:

```typescript
provider.onError((error) => {
  console.error(`[${error.code}] ${error.message}`, error.cause)
})
```

### Error Codes

| Code | Description |
|------|-------------|
| `PARSE_ERROR` | Failed to parse message (invalid JSON, etc.) |
| `VALIDATION_ERROR` | Message validation failed |
| `CONNECTION_ERROR` | Connection-related error |
| `UNKNOWN_ERROR` | Other errors |

---

## Testing Providers

Unit tests are in `src/providers/__tests__/`:

```bash
# Run all provider tests
npm test -- --grep "providers"

# Run specific provider tests
npm test -- src/providers/__tests__/C123ServerProvider.test.ts
npm test -- src/providers/__tests__/CLIProvider.test.ts
npm test -- src/providers/__tests__/ReplayProvider.test.ts
```

### Mock Servers

For integration testing, use mock WebSocket servers:
- `src/test-utils/mockWebSocket.ts` - WebSocket mock
- `src/test/mock-tcp-server.ts` - Mock TCP server
