# Canoe Scoreboard V3

## Project Status

| Phase | Description | Status |
|-------|-------------|--------|
| A-E | Basic functionality, tests, fixes | ✅ |
| F | C123 integration (ConfigPush, assets, ForceRefresh) | ✅ |
| G | BR1/BR2 merge display | ✅ |
| H | OnCourse improvements, scrollToFinished | ✅ |
| I | Server-assigned clientId persistence | ✅ |
| J | Complete documentation | ✅ |
| K | Documentation maintenance | ✅ |
| L | React Best Practices refactoring | ✅ |
| M | E2E tests - infrastructure fixes | 🔄 Partial |
| N | Visual facelift (typography, BR2 layout) | ✅ |

---

## Implemented Features

### Phase F - C123 Integration

- ConfigPush (type, displayRows, customTitle, scrollToFinished)
- Asset management (logoUrl, partnerLogoUrl, footerImageUrl)
- ForceRefresh handler
- ClientState response with capabilities

### Phase G - BR1/BR2 Merge

- BR2 race detection (`isBR2Race()`, `getClassId()`)
- BR2Manager with REST API cache and merge logic
- Two result columns with `.worseRun` styling
- WebSocket `Total` = best of both runs

### Phase H - OnCourse & Scroll

- Vertical OnCourse displays one competitor
- `?scrollToFinished=false` disables scroll on finish

### Phase I - clientId Persistence

- Server assigns clientId via ConfigPush
- Fallback: URL param → localStorage → IP-based

### Phase L - React Best Practices

- Removed barrel file imports (faster HMR)
- Context splitting analyzed but skipped (reducer coupling)
- Inline styles extracted to CSS modules
- Bundle: JS 440kB, CSS 20kB

### Phase N - Visual Facelift

**Typography:**
- Bebas Neue for display titles (uppercase, high impact)
- Oswald for category headings
- Barlow Condensed for competitor names
- JetBrains Mono for times/numbers
- Header accent line (3px blue border)

**BR2 Layout Refinements:**
- Grid gap doubled (8px → 16px) for breathing room
- Inline flex penalty badges (no absolute positioning)
- Worse run opacity 65% (was 50%) for LED readability
- Badge color variables for consistency
- Font weight 600/400 for better/worse runs
- Penalty badge without + prefix
- Smaller BR2 time size (26px) to balance with Barlow names
- Invisible badge spacer for alignment consistency

---

## Documentation

| Document | Description |
|----------|-------------|
| [README.md](README.md) | User guide |
| [docs/architecture.md](docs/architecture.md) | Architecture, data flow |
| [docs/components.md](docs/components.md) | React components |
| [docs/data-providers.md](docs/data-providers.md) | Provider interface |
| [docs/configuration.md](docs/configuration.md) | Remote configuration |
| [docs/url-parameters.md](docs/url-parameters.md) | URL parameters |
| [docs/development.md](docs/development.md) | Developer guide |
| [docs/testing.md](docs/testing.md) | Testing and CI/CD |
| [docs/timing.md](docs/timing.md) | Timing constants |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Problem solving |
| [docs/SolvingBR1BR2.md](docs/SolvingBR1BR2.md) | BR1/BR2 analysis |
| [docs/DEVLOG.md](docs/DEVLOG.md) | Development log |

---

## External References

| Path | Description |
|------|-------------|
| `../c123-server/docs/` | C123 Server documentation |
| `../c123-protocol-docs/` | C123 protocol documentation |
| `../c123-protocol-docs/recordings/` | Recordings for development |

---

## Phase M - E2E Tests (Partial)

**Status:** 49 passed, 22 skipped, 5 failed

**Fixes performed:**
- Added `source=replay` to all test URLs
- Fixed selectors (`div[class*="row"]` → `[data-bib]`)
- Increased `pauseAfter` to 500
- Added port cleanup for mock servers

**Remaining issues:**
- M.1: cli-vs-c123 mock server infrastructure
- M.2: Layout dynamic resize timing
- M.3: Performance test timeout
- M.4: Scroll tests race conditions
- M.5: displayRows scaling expectations

**Note:** E2E issues are infrastructure-related, not functional. Core functionality is validated by 725 unit tests.

---

## Rollback Tags

| Tag | Description |
|-----|-------------|
| `v3.0.0-pre-refactor` | Before Phase L refactoring |
| `v3.1.0` | After Phase L (React Best Practices) |
| `v3.2.0` | After Phase N (Visual Facelift) |
