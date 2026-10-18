# Claude Code Instructions - C123 Scoreboard

## Project

Real-time scoreboard for canoe slalom races. On-site display for race officials and spectators. Works with data from c123-server via WebSocket.

**GitHub:** OpenCanoeTiming/c123-scoreboard | **License:** MIT | **Status:** Migration to the on-site contract in M3 (Rebuild 2026/27); venues run `legacy-2026` (v3.5.4)

---

## Rebuild 2026/27 — read first

- **Design (normative):** c123-server `main`, `docs/arch/` — start at `README.md` (reading order, implementation sequence); then `CONTRACTS.md`, `DECISIONS/ADR-*`, `TEST-ARCHITECTURE.md`. Point to it, never restate it. Defaults taken without the maintainer go to `DECISIONS/LOG.md`.
- **Legacy line:** venues run tag `legacy-2026`; branch `legacy/2026` takes `fix:` commits only. `main` is the rebuild, in place: replaced code is deleted, never kept beside the new.
- **Releases:** rebuild code reaches no venue. Release Please PRs on `main` stay unmerged during the rebuild (no 3.x release from rebuild code); the rebuild ships as `Release-As: 4.0.0` when M6 Release 1.0 closes (see "Rebuild versioning" below).
- **Order:** server → scoreboard → penalty-check → live-mini is the implementation order only. Everything, the new live included, is ready for the Jarní slalom (M6), its first real use: no shadow run, the legacy line is the fallback.
- **Work items:** one issue each in project "Rebuild 2026/27" (https://github.com/orgs/OpenCanoeTiming/projects/3), milestones M0 Spike, freeze, merge · M1 Server core · M2 Tooling · M3 Scoreboard · M4 Penalty-check · M5 Live · M6 Release 1.0 (Jarní slalom). Implementation is on hold until the maintainer releases M1.
- **Test-first:** failing tests from the vectors or obligations land before the code that passes them. Tiers and the `Clock` rule: `TEST-ARCHITECTURE.md` §3, §5.
- **Client repos:** definition of done = `CLIENT-OBLIGATIONS.md` Common + "c123-scoreboard". A wrong obligation is fixed in c123-server `docs/arch` (same PR as the cited section, or label `obligations-unchanged`), never by deviating here.
- **Upstream provenance** stays in the private c123-protocol-docs repo; public repos state behaviour only, never how it was established.
- **Git:** conventional commits; Release Please owns versions and CHANGELOG; squash merges; `git add <file>`, never commit `.claude/` or `.superpowers/`. Czech with the maintainer, English in code, commits and docs.

---

## Architecture

Scoreboard uses an abstract `DataProvider` interface (`C123ServerProvider`, `CLIProvider`, `ReplayProvider`). Target (M3): it consumes the on-site contract (CONTRACTS §7) and nothing else; `providers/utils/` loses finish detection, gate parsing, merge and the run-2 merger (CLIENT-OBLIGATIONS "c123-scoreboard"). Legacy details: [docs/architecture.md](docs/architecture.md).

---

## Key References

| Purpose | Path |
|---------|------|
| **Definition of done (M3)** | `../c123-server/docs/arch/CLIENT-OBLIGATIONS.md` → Common + "c123-scoreboard" |
| **Test tiers, Clock rule** | `../c123-server/docs/arch/TEST-ARCHITECTURE.md` §3.3, §5 |
| **Architecture** | `./docs/architecture.md` |
| **Timing constants (legacy; route through the Clock in M3)** | `./docs/timing.md` |
| **Testing (legacy suite)** | `./docs/testing.md` |
| **Troubleshooting** | `./docs/troubleshooting.md` |
| **Server WebSocket API** | legacy: `../c123-server/docs/C123-PROTOCOL.md`; target: `../c123-server/docs/arch/CONTRACTS.md` §7 |
| **Protocol docs** | `../c123-protocol-docs/` |
| **Recordings for testing** | `../c123-protocol-docs/recordings/` |

---

## Important Rules

1. **Phase choice is the board's** — no "current race" comes from the server; choose from `Phase.status`, `stage`, `programmeOrder`, the on-course set and `Standing.asOf`, and cycle or split when several Phases run (CLIENT-OBLIGATIONS, rendering clients).
2. **Rebuild in place** — the migration replaces code on `main`; replaced code is deleted, not kept beside the new. The legacy board is `legacy/2026` (fix-only).
3. **Render, never interpret** — show what the contract delivers (`status`, `placement`, `Standing`, the on-course set); detect no finish, parse no gate string, merge nothing (ADR-002).
4. **No CLI provider** — `CLIProvider` exists only on the legacy line and is removed in M3 (maintainer decision 2026-10-18; ADR-002). Do not extend it.

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

Behaviour tests (M3) are tier 3: domain-state fixtures fed through the DataProvider with a fake `Clock` — the prototype is on branch `spike/s3` (TEST-ARCHITECTURE §3.3, §9). The recipe below is the whole-line check (tier 4) and demo:

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

Rebuild rules: see "Rebuild 2026/27 — read first" above. Every change starts with a GitHub issue.

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
- Include the verification: commands run, exit codes, CI run link; for a migration item, the CLIENT-OBLIGATIONS lines it closes
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
| `revert:` | none | ✓ Reverts |
| `docs:` | none | hidden |
| `chore:` / `ci:` / `test:` / `style:` / `refactor:` / `build:` | **none** | hidden |
| `chore(deps):` / `chore(deps-dev):` (dependabot) | **none** | hidden |

### Rules for agents preparing PRs

1. **Always use conventional commits** (`feat:`, `fix:`, `chore:`...). Release Please reads commit prefixes to decide bumps.
2. **Don't edit `package.json` version or `CHANGELOG.md`** in regular PRs — Release Please owns those.
3. **Don't merge the release PR together with feature PRs** — it must be the last to merge in a release cycle.
4. **PR title should keep the commit prefix** (squash merges — ensure the final merged commit stays conventional).
5. **Never commit skill state** — `.superpowers/` and `.claude/` are local per-session tool state. Prefer `git add <file>` over `git add -A`.

### Rebuild versioning (maintainer decision 2026-10-18)

During the rebuild, the Release Please PR on `main` is left **unmerged**: no 3.x release is cut from rebuild code (any `feat:` on `main` would otherwise propose 3.6.0). When milestone M6 Release 1.0 closes, the rebuild ships as 4.0.0, with this footer on the closing commit:

```
Release-As: 4.0.0
```

Venue fixes in the meantime go to `legacy/2026`.
