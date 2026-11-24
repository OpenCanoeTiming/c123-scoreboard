import { test, expect } from '@playwright/test'
import { openSettledReplay } from './helpers/replay'

/**
 * Scaled ledwall (?type=ledwall&displayRows=N): the whole board must fit the
 * viewport. The last of the N result rows ends inside the viewport and the
 * page does not scroll (issue #131).
 */
const viewports = [
  { name: 'ledwall viewport', width: 768, height: 384 },
  { name: 'LED panel', width: 576, height: 960 },
]

for (const vp of viewports) {
  for (const rows of [3, 5, 8, 12, 20]) {
    test(`displayRows=${rows} fits ${vp.name} ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await openSettledReplay(
        page,
        `type=ledwall&displayRows=${rows}&speed=100&pauseAfter=500&disableScroll=true`
      )

      const m = await page.evaluate((n) => {
        const bibs = document.querySelectorAll('[data-testid="results-list"] [data-bib]')
        const last = bibs[Math.min(n, bibs.length) - 1]
        const r = last.getBoundingClientRect()
        const root = document.documentElement
        return {
          rowCount: bibs.length,
          lastBottom: r.bottom,
          listBottom: document.querySelector('[data-testid="results-list"]')!.getBoundingClientRect().bottom,
          innerHeight: window.innerHeight,
          innerWidth: window.innerWidth,
          lastRight: r.right,
          scrollH: root.scrollHeight,
          clientH: root.clientHeight,
          scrollW: root.scrollWidth,
          clientW: root.clientWidth,
        }
      }, rows)

      expect(m.rowCount).toBeGreaterThanOrEqual(rows)
      expect(m.lastBottom).toBeLessThanOrEqual(m.innerHeight + 0.5)
      expect(m.listBottom).toBeLessThanOrEqual(m.innerHeight + 0.5)
      expect(m.lastRight).toBeLessThanOrEqual(m.innerWidth + 0.5)
      expect(m.scrollH).toBeLessThanOrEqual(m.clientH)
      expect(m.scrollW).toBeLessThanOrEqual(m.clientW)
    })
  }
}
