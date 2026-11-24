#!/usr/bin/env node
/**
 * Tier-4 check (local, not CI): the built board against a c123-server on-site process that replays a recording.
 *
 *   npm run build
 *   (c123-server) npm run dev:env -- --recording <id> --speed 10 --state-dir <dir>
 *   npm run check:race -- --server 127.0.0.1:<serverPort> [--control 127.0.0.1:<controlPort>]
 *
 * It serves `dist/` (required: this script does not build; it stops with a hint when `dist/` is missing),
 * waits for the replay to end, opens one board per class in both layouts (vertical, `?type=ledwall`),
 * reads every result row from the DOM and compares it with `/api/classes/{classId}/standings`.
 * Exit code 0 only when every board matches; any missing row, extra row, different order or different
 * cell is printed and fails the run.
 *
 * Settled here (the contract names no current race, so the script states its own rule):
 * - Which standing: the Phase of the class's most recently changed whole-class Standing (`asOf`; a pair's
 *   Standing belongs to its second Phase), and within that Phase the pair Standing if one exists, else the
 *   Phase's own. The board must show the same Phase: the title's run label is compared with the label of
 *   the Phase's `format` token (BR1 -> 1, BR2 -> 2, else the token verbatim). A different Phase fails.
 * - Replay ended: with `--control` the player reports `state: stopped` after it played (`position > 0`); always,
 *   every class's standings must then stay unchanged for `--quiet` ms (default 30000). Without `--control`
 *   only the quiet period decides, so give it room.
 * - Live path: one board (vertical, the class with most entries) is opened before the wait and read at the
 *   end with the others, so the push path is compared as well as hydration. The other boards open after the
 *   end (hydration only), a few at a time.
 * - All rows: `disableScroll=true`; rows are read from the DOM whether visible or not, and the row count
 *   must equal the REST entry count (nothing virtualised away) before cells are compared.
 * - Cells are formatted by this script, not by the view-model: time and total with two decimals, penalty
 *   in whole seconds beside a time, a no-result mark in upper case, `-` for a run without a time yet,
 *   nothing for an untimed row, `*` before the time of an under-review result, behind as `+x.xx`, rank as
 *   `n.`. Vertical shows rank, bib, name, run cell(s), behind; a second run of a pair shows both runs
 *   (run 1 from the first Phase's Attempt). Ledwall shows rank, bib, name and one time (the pair total
 *   for a second run), no penalty, no behind. Names are not compared.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function parseArgs(argv) {
  const o = { quietMs: 30_000, timeoutMin: 30, concurrency: 3, classes: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i] ?? usage(`${a} needs a value`)
    if (a === '--server') o.server = next()
    else if (a === '--control') o.control = next()
    else if (a === '--quiet') o.quietMs = Number(next())
    else if (a === '--timeout') o.timeoutMin = Number(next())
    else if (a === '--concurrency') o.concurrency = Number(next())
    else if (a === '--classes') o.classes = next().split(',')
    else usage(`unknown argument ${a}`)
  }
  if (!o.server) usage('--server host:port is required')
  return o
}

function usage(msg) {
  console.error(`race-check: ${msg}\nusage: npm run check:race -- --server host:port [--control host:port] [--quiet ms] [--timeout min] [--concurrency n] [--classes id,id]`)
  process.exit(2)
}

const opts = parseArgs(process.argv.slice(2))
const base = `http://${opts.server}`
const getJson = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.json()
}
const known = (f) => (f && f.state === 'known' ? f.value : null)

// ---- static server for dist/ --------------------------------------------------------------------------------

function serveDist() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('race-check: dist/ is missing; run `npm run build` first')
    process.exit(2)
  }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    let file = path.join(DIST, rel)
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })))
}

// ---- waiting for the replay ---------------------------------------------------------------------------------

async function standingsSnapshot(classIds) {
  const all = {}
  for (const id of classIds) {
    const { standings } = await getJson(`${base}/api/classes/${id}/standings`)
    all[id] = standings
  }
  return JSON.stringify(all)
}

async function waitForEnd(classIds) {
  const deadline = Date.now() + opts.timeoutMin * 60_000
  if (opts.control) {
    for (;;) {
      const s = await getJson(`http://${opts.control}/status`)
      if (s.state === 'stopped' && s.position > 0) break
      if (Date.now() > deadline) throw new Error('timeout waiting for the replay to end')
      process.stderr.write(`\rrace-check: replay ${s.state} ${s.position}/${s.duration} ms   `)
      await sleep(5000)
    }
    process.stderr.write('\n')
  }
  let last = await standingsSnapshot(classIds)
  let since = Date.now()
  while (Date.now() - since < opts.quietMs) {
    if (Date.now() > deadline) throw new Error('timeout waiting for the standings to settle')
    await sleep(2000)
    const now = await standingsSnapshot(classIds)
    if (now !== last) {
      last = now
      since = Date.now()
    }
  }
}

// ---- the expectation, from REST ------------------------------------------------------------------------------

const runLabel = (format) => ({ BR1: '1', BR2: '2' })[format] ?? format
const fix = (n) => n.toFixed(2)

/** The Phase and Standing a board of this class should show, plus what the cells need. */
async function expectationFor(classId, klass) {
  const [{ standings }, { phases }] = await Promise.all([
    getJson(`${base}/api/classes/${classId}/standings`),
    getJson(`${base}/api/classes/${classId}/phases`),
  ])
  const byId = Object.fromEntries(phases.map((p) => [p.phaseId, p]))
  const phaseOf = (s) => (s.scope.kind === 'pair' ? s.scope.secondPhaseId : s.scope.phaseId)
  const whole = standings.filter((s) => s.ageCategoryId === null && (s.scope.kind === 'phase' || s.scope.kind === 'pair'))
  if (whole.length === 0) return { classId, code: klass.code, phase: null, rows: [] }
  const latest = whole.reduce((a, b) => (Date.parse(b.asOf) > Date.parse(a.asOf) ? b : a))
  const phase = byId[phaseOf(latest)]
  const second = phase.pair?.role === 'second'
  const pairStanding = whole.find((s) => s.scope.kind === 'pair' && s.scope.secondPhaseId === phase.phaseId)
  const standing = (second && pairStanding) || whole.find((s) => s.scope.kind === 'phase' && s.scope.phaseId === phase.phaseId)
  const attemptsByEntry = async (phaseId) => {
    const m = new Map()
    if (!phaseId) return m
    const { attempts } = await getJson(`${base}/api/phases/${phaseId}/attempts`)
    for (const a of attempts) {
      const e = known(a.entry)
      if (e) m.set(e.entryId, a)
    }
    return m
  }
  const firstRun = second ? await attemptsByEntry(pairStanding?.scope.firstPhaseId ?? phase.pair.siblingPhaseId) : new Map()
  const secondRun = second ? await attemptsByEntry(phase.phaseId) : new Map()

  // A run's cell: [time text, penalty text or null]. A star leads the time of a result under review.
  const cell = (outcome, review) => {
    if (outcome === null) return ['', null]
    if (outcome.kind === 'duration') return [(review ? '*' : '') + fix(outcome.totalSeconds), String(outcome.penaltySeconds)]
    if (outcome.kind === 'no-result') return [outcome.status.toUpperCase(), null]
    if (outcome.kind === 'pending' || outcome.kind === 'running') return ['-', null]
    return ['', null]
  }
  const rows = standing.entries.map((e) => {
    const rank = e.rank === null ? '' : `${e.rank}.`
    const behind = e.behindSeconds ? `+${fix(e.behindSeconds)}` : ''
    const own = cell(e.result, e.underReview)
    let ledwallTime = own[0]
    let vertical = [own]
    if (second) {
      const run1 = firstRun.get(e.entryId)
      const total = e.pairTotalSeconds ?? known(secondRun.get(e.entryId)?.pairTotal) ?? null
      if (total !== null) ledwallTime = (e.underReview ? '*' : '') + fix(total)
      vertical = [run1 ? cell(known(run1.outcome), known(run1.underReview) ?? false) : ['', null], own]
    }
    return { bib: e.bib, rank, behind, vertical, ledwallTime }
  })
  return { classId, code: klass.code, phase, label: runLabel(phase.format), second, rows }
}

// ---- reading a board ----------------------------------------------------------------------------------------

async function readBoard(page) {
  return page.evaluate(() => {
    const own = (el) => {
      const clone = el.cloneNode(true)
      clone.querySelectorAll('sup').forEach((s) => s.remove())
      return clone.textContent.trim()
    }
    const cellOf = (el) => {
      const star = !!el.querySelector('sup')
      const spans = el.querySelectorAll(':scope > span')
      if (spans.length) return { text: (star ? '*' : '') + own(spans[0]), pen: spans[1] ? spans[1].textContent.trim() : null }
      return { text: (star ? '*' : '') + own(el), pen: null }
    }
    const title = document.querySelector('[data-testid="title"]')
    const rows = [...document.querySelectorAll('[data-testid="results-list"] > [data-bib]')].map((row) => ({
      bib: row.getAttribute('data-bib'),
      cells: [...row.children].map(cellOf),
    }))
    return {
      titleText: title ? title.textContent.trim() : null,
      titleRun: title?.querySelector('sub')?.textContent.trim() ?? null,
      rows,
    }
  })
}

async function settledBoard(page) {
  let last = null
  let since = Date.now()
  const deadline = Date.now() + 60_000
  for (;;) {
    const now = JSON.stringify(await readBoard(page))
    if (now !== last) {
      last = now
      since = Date.now()
    } else if (Date.now() - since >= 4000) return JSON.parse(now)
    if (Date.now() > deadline) throw new Error('the board did not settle in 60 s')
    await sleep(500)
  }
}

// ---- comparing ----------------------------------------------------------------------------------------------

function compare(exp, board, layout) {
  const diffs = []
  if (exp.phase === null) {
    if (board.rows.length) diffs.push(`board shows ${board.rows.length} rows, REST has no standing`)
    return diffs
  }
  if (board.titleText === null || !board.titleText.includes(exp.code)) diffs.push(`title "${board.titleText}" does not name class ${exp.code}`)
  if (board.titleRun !== `/${exp.label}.`) diffs.push(`board shows run ${board.titleRun}, compared Phase ${exp.phase.phaseId} (format ${exp.phase.format}) is /${exp.label}.`)
  const want = exp.rows.map((r) => r.bib)
  const have = board.rows.map((r) => r.bib)
  for (const b of want) if (!have.includes(b)) diffs.push(`missing row: bib ${b}`)
  for (const b of have) if (!want.includes(b)) diffs.push(`extra row: bib ${b}`)
  if (have.length !== want.length) diffs.push(`row count: board ${have.length}, REST ${want.length}`)
  if (want.filter((b) => have.includes(b)).join() !== have.filter((b) => want.includes(b)).join()) diffs.push(`order differs: board [${have.join(' ')}] REST [${want.join(' ')}]`)
  if (diffs.length) return diffs
  const n = layout === 'ledwall' ? 4 : exp.second ? 6 : 5
  exp.rows.forEach((r, i) => {
    const b = board.rows[i]
    const where = `bib ${r.bib} (row ${i + 1})`
    if (b.cells.length !== n) return diffs.push(`${where}: ${b.cells.length} cells, expected ${n}`)
    const check = (name, got, wantV) => got !== wantV && diffs.push(`${where} ${name}: board ${JSON.stringify(got)}, REST ${JSON.stringify(wantV)}`)
    check('rank', b.cells[0].text, r.rank)
    check('bib', b.cells[1].text, r.bib)
    if (layout === 'ledwall') return check('time', b.cells[3].text, r.ledwallTime)
    r.vertical.forEach(([time, pen], k) => {
      check(`run${r.vertical.length === 2 ? k + 1 : ''} time`, b.cells[3 + k].text, time)
      check(`run${r.vertical.length === 2 ? k + 1 : ''} penalty`, b.cells[3 + k].pen, pen)
    })
    check('behind', b.cells[n - 1].text, r.behind)
  })
  return diffs
}

// ---- main ---------------------------------------------------------------------------------------------------

const { classes } = await getJson(`${base}/api/events/current`)
const wanted = classes.filter((c) => !opts.classes || opts.classes.includes(c.classId))
if (wanted.length === 0) usage('the server holds no class')
const classIds = wanted.map((c) => c.classId)
const dist = await serveDist()
const browser = await chromium.launch({ args: ['--force-prefers-reduced-motion'] })

const urlFor = (classId, layout) =>
  `${dist.url}/?server=${encodeURIComponent(opts.server)}&category=${encodeURIComponent(classId)}&disableScroll=true${layout === 'ledwall' ? '&type=ledwall' : ''}`
const open = async (classId, layout) => {
  const ctx = await browser.newContext({ viewport: layout === 'ledwall' ? { width: 768, height: 384 } : { width: 1080, height: 1920 } })
  const page = await ctx.newPage()
  await page.goto(urlFor(classId, layout))
  return { page, ctx }
}

// The live board: the class with most entries, opened before the replay has ended.
let liveClass = classIds[0]
{
  let most = -1
  for (const id of classIds) {
    const { entries } = await getJson(`${base}/api/classes/${id}/entries`)
    if (entries.length > most) [most, liveClass] = [entries.length, id]
  }
}
const live = await open(liveClass, 'vertical')

await waitForEnd(classIds)

const results = []
let rowsCompared = 0
const jobs = []
for (const klass of wanted) for (const layout of ['vertical', 'ledwall']) jobs.push({ klass, layout })
const run = async (klass, layout, handle, label) => {
  const own = handle ?? (await open(klass.classId, layout))
  const exp = await expectationFor(klass.classId, klass)
  const board = await settledBoard(own.page)
  const diffs = compare(exp, board, layout)
  rowsCompared += exp.rows.length
  results.push({ name: `${klass.classId} ${layout}${label}`, rows: exp.rows.length, diffs })
  if (!handle) await own.ctx.close()
}
await run(wanted.find((c) => c.classId === liveClass), 'vertical', live, ' (live)')
const queue = jobs.slice()
await Promise.all(
  Array.from({ length: opts.concurrency }, async () => {
    for (let job; (job = queue.shift()); ) await run(job.klass, job.layout, null, '')
  })
)
await browser.close()
dist.server.close()

let failed = 0
for (const r of results.sort((a, b) => a.name.localeCompare(b.name))) {
  if (r.diffs.length) {
    failed++
    console.log(`FAIL ${r.name}`)
    for (const d of r.diffs) console.log(`  ${d}`)
  }
}
console.log(`race-check: ${results.length} boards (${wanted.length} classes x 2 layouts + 1 live), ${rowsCompared} rows compared, ${failed} boards differ -> ${failed ? 'FAIL' : 'PASS'}`)
process.exit(failed ? 1 : 0)
