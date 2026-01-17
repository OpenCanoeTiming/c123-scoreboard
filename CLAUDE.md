# Claude Code Instructions - C123 Scoreboard

## Project

Real-time scoreboard for canoe slalom races. Works with data from C123 server.

**GitHub:** OpenCanoeTiming/c123-scoreboard | **License:** MIT

---

## Paths and Documentation

| Purpose | Path |
|---------|------|
| **This project** | `/workspace/timing/c123-scoreboard/` |
| **Implementation plan** | `./PLAN.md` |
| **Documentation** | `./docs/` |
| **C123 Server** | `../c123-server/` |
| **Protocol docs** | `../c123-protocol-docs/` |
| **Design system** | `../timing-design-system/` |
| **Legacy V1** | `/workspace/personal/canoe-scoreboard-original/` (archive) |

### Project Documentation

| Document | Description |
|----------|-------------|
| [docs/architecture.md](docs/architecture.md) | Architecture, data flow, key files |
| [docs/timing.md](docs/timing.md) | Timing constants and flow diagrams |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Common problem solutions |
| [docs/testing.md](docs/testing.md) | Testing commands and coverage |
| [docs/DEVLOG.md](docs/DEVLOG.md) | Development log |

### External References

- **`../c123-server/docs`** - C123 WebSocket API documentation
- **`../c123-protocol-docs`** - C123 protocol and XML format documentation
- **`../c123-protocol-docs/samples/`** - Static XML samples for reference
- **`../c123-protocol-docs/recordings/`** - JSONL recordings for development and testing

---

## Language

- User communication: **Czech**
- Documentation (README, docs): **English**
- Code, comments, commit messages: **English**

---

## Architecture (Summary)

Scoreboard uses abstract `DataProvider` interface:
- **C123ServerProvider** - primary (WebSocket to C123 Server)
- **CLIProvider** - fallback (legacy CLI protocol)

Details in [docs/architecture.md](docs/architecture.md).

---

## Development and Testing

**Process:**
1. Update documentation as plan and intent
2. Add steps to `PLAN.md`
3. Implement in blocks (~70% context per block)
4. Commit at the latest after each block
5. Don't do more than one block before clear/compact

**Testing:**
- Always test V3 against V2 on the same input data
- Content, behavior, and logic must be COMPLETELY IDENTICAL (except BR1/BR2 merge)
- Commands in [docs/testing.md](docs/testing.md)

**Recording for development:**
```bash
../c123-protocol-docs/recordings/rec-2025-12-28T09-34-10.jsonl
```

**Development log:** Write progress to [docs/DEVLOG.md](docs/DEVLOG.md).

---

## Key Qualities

1. **Race flow tracking** - display results for the currently running category
2. **Architecture and appearance preservation** - V2 is polished, changes are rare
3. **XML as live database** - content changes continuously, react via API
4. **Keep CLI** - as secondary interface for backward compatibility

---

## Commit Message Format

```
feat: add TcpSource with reconnect logic
fix: correct XML parsing for Results
test: add unit tests for FinishDetector
```

---

*Detailed implementation plan → see `./PLAN.md`*
