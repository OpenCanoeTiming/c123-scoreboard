import { test, expect } from '@playwright/test'

/**
 * Walking skeleton (#158): `?source=fixture&fixture=<id>` plays a synthetic fixture through the store and
 * the view-model, and the same components render it, in both layouts. After hydration the board shows
 * the title and the Standing's rows in delivered order.
 */

const layouts = [
  { type: 'vertical', width: 1080, height: 1920 },
  { type: 'ledwall', width: 768, height: 384 },
] as const

for (const layout of layouts) {
  test(`fixture source renders a populated board (${layout.type})`, async ({ page }) => {
    await page.setViewportSize({ width: layout.width, height: layout.height })
    await page.goto(`/?source=fixture&fixture=slalom-k1m-one-run&type=${layout.type}&disableScroll=true`)

    const title = page.getByTestId('title')
    await expect(title).toContainText('Autumn Slalom')
    await expect(title).toContainText('K1M')

    const rows = page.getByTestId('results-list').locator('[data-bib]')
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0)).toHaveAttribute('data-bib', '1')
    await expect(rows.nth(0)).toContainText('NOVAK Jan')
    await expect(rows.nth(0)).toContainText('90.00')
    await expect(rows.nth(1)).toHaveAttribute('data-bib', '2')
    await expect(rows.nth(2)).toHaveAttribute('data-bib', '3')
  })
}

// #163 / CLIENT-OBLIGATIONS L170: under prefers-reduced-motion the list is settled without animation.
test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('the results list scrolls instantly and nothing animates', async ({ page }) => {
    await page.goto('/?source=fixture&fixture=slalom-k1m-one-run&type=vertical')

    const list = page.getByTestId('results-list')
    await expect(list.locator('[data-bib]')).toHaveCount(3)

    await expect(list).toHaveCSS('scroll-behavior', 'auto')
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)
    expect(running).toBe(0)
  })
})
