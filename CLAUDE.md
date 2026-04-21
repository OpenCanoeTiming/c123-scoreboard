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
# Fetch a recording and start the player (in c123-protocol-docs)
cd ../c123-protocol-docs
node tools/recordings-cli.js fetch 2026-04-19-jarni-ne-odp
node tools/player.js \
  "$(node tools/recordings-cli.js path 2026-04-19-jarni-ne-odp)" \
  --autoplay --xml-out /tmp/c123-replay.xml

# In another terminal — start c123-server pointing at the player
cd ../c123-server && npm start -- --host 127.0.0.1 --xml /tmp/c123-replay.xml --no-discovery

# Scoreboard connects to ws://localhost:27123/ws
```

Available recordings: `node tools/recordings-cli.js list`. Full player
documentation, Control API for scripted seek/speed, and additional recipes:
[`../c123-protocol-docs/recordings/README.md`](../c123-protocol-docs/recordings/README.md#quick-start).

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

---

## Versioning & Releases

This project uses **Release Please** (commit-based) for automatic versioning. **Never manually bump `package.json` version or edit `CHANGELOG.md`** — Release Please owns both via its rolling release PR.

### How it works

1. Every push to `main` runs `.github/workflows/release-please.yml`.
2. Release Please keeps a rolling **release PR** open (label `autorelease: pending`) that aggregates pending changes and proposes the next version.
3. Merging the release PR creates a commit `chore(main): release X.Y.Z`, tag `vX.Y.Z`, and a GitHub Release with generated CHANGELOG.
4. Scoreboard is a browser app, not an npm package — there is no `publish.yml`. The GitHub Release is the release artifact.

### Commit types and bump rules

| Commit type | Bump | Shown in CHANGELOG |
|---|---|---|
| `feat:` | **minor** | ✓ Features |
| `fix:` / `perf:` | **patch** | ✓ Bug Fixes / Performance |
| `feat!:` or `BREAKING CHANGE:` | **major** | ✓ Features |
| `revert:` / `docs:` | none | ✓ Reverts / Documentation |
| `chore:` / `ci:` / `test:` / `style:` / `refactor:` / `build:` | **none** | hidden |
| `chore(deps):` / `chore(deps-dev):` (dependabot) | **none** | hidden |

### Rules for agents preparing PRs

1. **Always use conventional commits** (`feat:`, `fix:`, `chore:`...). Release Please reads commit prefixes to decide bumps.
2. **Don't edit `package.json` version or `CHANGELOG.md`** in regular PRs — Release Please owns those.
3. **Don't merge the release PR together with feature PRs** — it must be the last to merge in a release cycle.
4. **PR title should keep the commit prefix** (squash merges — ensure the final merged commit stays conventional).
5. **Never commit skill state** — `.superpowers/` and `.claude/` are local per-session tool state. Prefer `git add <file>` over `git add -A`.

### Forcing a specific version

To force a release to a specific version, add this footer to a commit in the next release cycle:

```
Release-As: 4.0.0
```
