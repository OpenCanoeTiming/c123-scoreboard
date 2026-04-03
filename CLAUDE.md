# Claude Code Instructions - C123 Scoreboard

## Project

Real-time scoreboard for canoe slalom races. On-site display for race officials and spectators. Works with data from c123-server via WebSocket.

**GitHub:** OpenCanoeTiming/c123-scoreboard | **License:** MIT | **Status:** Stable

---

## Architecture

Scoreboard uses abstract `DataProvider` interface:
- **C123ServerProvider** — primary (WebSocket to c123-server)
- **CLIProvider** — fallback (legacy CLI protocol)

Details in [docs/architecture.md](docs/architecture.md).

---

## Key References

| Purpose | Path |
|---------|------|
| **Architecture** | `./docs/architecture.md` |
| **Timing constants** | `./docs/timing.md` |
| **Testing** | `./docs/testing.md` |
| **Troubleshooting** | `./docs/troubleshooting.md` |
| **Server WebSocket API** | `../c123-server/docs/C123-PROTOCOL.md` |
| **Protocol docs** | `../c123-protocol-docs/` |
| **Recordings for testing** | `../c123-protocol-docs/recordings/` |
| **Design system** | `../timing-design-system/` |

---

## Important Rules

1. **Race flow tracking** — display results for the currently running category
2. **Architecture preservation** — the scoreboard is polished and stable, changes are rare
3. **XML as live database** — content changes continuously, react via WebSocket
4. **Keep CLI** — as secondary interface for backward compatibility

---

## Development

```bash
# Install
npm install

# Dev server
npm run dev

# Tests
npm test

# Build
npm run build
```

**Testing with recorded data:**
```bash
# Start replay server (in c123-protocol-docs)
cd ../c123-protocol-docs/tools
node player.js ../recordings/rec-2025-12-28T09-34-10.jsonl --autoplay

# In another terminal — start c123-server
cd ../c123-server && npm start -- --host localhost

# Scoreboard connects to ws://localhost:27123/ws
```

---

## Workflow

Issue-driven development. Every change starts with a GitHub issue.

### 1. Rozbor (Analysis)
- Comment on issue: restate problem, challenge the idea, define scope, identify risks
- Use `/second-opinion` for non-trivial architectural decisions

### 2. Plan
- Use Claude Code plan mode to design implementation
- Post plan summary to issue: key decisions, files to change, approach
- Get user confirmation before implementation

### 3. Implement
- Branch from main: `feat/{N}-{slug}` or `fix-{N}-{slug}`
- Commit incrementally, push regularly
- Comment on issue with progress updates

### 4. PR & Review
- Every issue → PR with `Closes #N`
- Include test plan in PR description
- Summarize what changed and why

---

## DEVLOG.md

Append-only record of dead ends, surprising problems, and solutions. Never edit existing entries.

```markdown
## YYYY-MM-DD — Short description

**Problem:** What went wrong or didn't work
**Attempted:** What was tried
**Solution:** What actually worked (or: still open)
**Lesson:** What to remember next time
```

---

## Language

- User communication: **Czech**
- Documentation (README, docs): **English**
- Code, comments, commit messages: **English**

---

## Commit Message Format

```
feat: add TcpSource with reconnect logic
fix: correct XML parsing for Results
test: add unit tests for FinishDetector
```
