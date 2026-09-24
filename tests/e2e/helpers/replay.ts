import { expect, Page } from '@playwright/test'

/**
 * Open the scoreboard in replay mode and bring it to a deterministic, settled state.
 *
 * Replay playback and all transient UI states (highlight, departing competitor,
 * finished grace period — see docs/timing.md) are driven by wall-clock time, so a
 * screenshot taken after a fixed real-time wait depends on machine speed. This
 * helper freezes the page clock and advances it explicitly instead:
 *
 * 1. run the clock until result rows appear (recording fetched, playback started)
 * 2. run past `pauseAfter` (500 messages take ~0.7 s of replay time at speed=100)
 * 3. run long enough for every transient state to expire
 *
 * Use for screenshot tests only; functional tests keep the real clock.
 */
const pagesWithClock = new WeakSet<Page>()

export async function openSettledReplay(page: Page, query: string): Promise<void> {
  // A page's clock can be installed only once (tests may reload via this helper)
  if (!pagesWithClock.has(page)) {
    await page.clock.install({ time: new Date('2025-12-28T10:00:00Z') })
    pagesWithClock.add(page)
  }
  await page.goto(`/?source=replay&${query}`)
  await page.evaluate(() => document.fonts.ready)

  await expect
    .poll(
      async () => {
        await page.clock.runFor(500)
        return page.evaluate(
          () => document.querySelectorAll('[data-testid="results-list"] [data-bib]').length
        )
      },
      { timeout: 30000 }
    )
    .toBeGreaterThan(1)

  await page.clock.runFor(5000)
  // Let React commit the final playback state before expiring transient timers
  await page.waitForTimeout(500)
  await page.clock.runFor(20000)
  await page.waitForTimeout(500)
}
