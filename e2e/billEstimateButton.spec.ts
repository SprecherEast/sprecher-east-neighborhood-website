import type { Locator } from '@playwright/test'

import { BILL_POST_PATH as POST, BILL_WIDTHS as WIDTHS } from './support/billRows'
import { expect, test } from './support/test'

// The Estimate button on each panel of the whole bill (#1417): the only thing that opens a toast,
// one tag per panel, and the three panel titles in one header style.

/** A locator's box, or a failure that says it is not on the page */
const boxOf = async (locator: Locator) => {
  const found = await locator.boundingBox()
  if (!found) throw new Error('The element is not on the page')
  return found
}

for (const width of WIDTHS) {
  test(`no toast opens by itself: not on load, on scrolling, on an estimate or on a year switch, at ${width}px (#1417)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(POST)
    const accept = page.getByRole('button', { name: 'Got it' })
    await page.locator('[data-city]').scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)
    await expect(accept).toHaveCount(0)
    const value = page.getByRole('textbox', { name: 'Enter your assessed value' })
    await value.fill('$750,000')
    await page.getByRole('button', { name: 'Estimate', exact: true }).click()
    await page.getByRole('button', { name: '2026', exact: true }).click()
    await page.getByRole('button', { name: '2027', exact: true }).click()
    await page.waitForTimeout(1500)
    await expect(accept).toHaveCount(0)
  })

  test(`each panel's Estimate button opens its own toast, as often as it is pressed, at ${width}px (#1417)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(POST)
    const panels = [
      page.getByRole('region', { name: 'Your City tax' }),
      page.getByRole('region', { name: /^\d{4} (city rate|rates)$/ }),
      page.getByRole('region', { name: 'Your whole property tax bill' }),
    ]
    for (const panel of panels) {
      await panel.scrollIntoViewIfNeeded()
      for (let times = 0; times < 3; times += 1) {
        await panel.getByRole('button', { name: /what this means$/ }).click()
        await expect(panel.getByRole('button', { name: 'Got it' })).toBeVisible()
        await panel.getByRole('button', { name: 'Got it' }).click()
        await expect(panel.getByRole('button', { name: 'Got it' })).toHaveCount(0)
      }
    }
    // One tag on each panel: the breakdown row under the City adds none
    await expect(page.getByRole('button', { name: /what this means$/ })).toHaveCount(3)
  })

  test(`the three panel titles are one size and weight at ${width}px (#1417)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(POST)
    const looks = await Promise.all(
      [
        page.getByText(/^City tax on (an average|your) home$/),
        page.getByRole('region', { name: /^\d{4} (city rate|rates)$/ }).getByRole('heading'),
        page.getByText('Your whole bill', { exact: true }),
      ].map((title) =>
        title.evaluate((el) => {
          const style = getComputedStyle(el)
          return `${style.fontSize} ${style.fontWeight}`
        }),
      ),
    )
    expect(new Set(looks).size).toBe(1)
  })

  test(`the Estimate button sits on the rates panel's title line and says why, at ${width}px (#1417)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(POST)
    const panel = page.getByRole('region', { name: /^\d{4} (city rate|rates)$/ })
    await panel.scrollIntoViewIfNeeded()
    const accept = panel.getByRole('button', { name: 'Got it' })
    await expect(accept).toHaveCount(0)
    const heading = panel.getByRole('heading')
    const button = panel.getByRole('button', { name: /what this means$/ })
    const [h, b, p] = [await boxOf(heading), await boxOf(button), await boxOf(panel)]
    // On the title's line at its end where they fit, else the badge follows under the title, at its start
    const beside = b.x > h.x + h.width - 1
    if (beside) {
      expect(
        Math.abs(b.y + b.height / 2 - (h.y + h.height / 2)),
        'level with the title',
      ).toBeLessThan(b.height)
    } else {
      expect(b.y, 'under the title').toBeGreaterThan(h.y + h.height - 1)
      expect(Math.abs(b.x - h.x), 'at the title’s start').toBeLessThan(2)
    }
    expect(b.x + b.width, 'inside the panel').toBeLessThanOrEqual(p.x + p.width + 1)
    await button.click()
    await expect(panel.getByRole('button', { name: 'Got it' })).toBeVisible()
    await expect(panel.getByText(/using 2026’s/)).toBeVisible()
    await panel.getByRole('button', { name: 'Got it' }).click()
    await expect(accept).toHaveCount(0)
  })

  test(`a year with the City's own final rates drops the rates panel's Estimate tag only, at ${width}px (#1417)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(POST)
    const tags = page.getByRole('button', { name: /what this means$/ })
    await expect(tags).toHaveCount(3)
    await page.getByRole('button', { name: '2026', exact: true }).click()
    // The City tax card and the whole bill only know the average home, so they keep theirs
    await expect(tags).toHaveCount(2)
    await expect(page.getByRole('region', { name: '2026 rates' }).getByRole('button')).toHaveCount(
      0,
    )
    await page.getByRole('button', { name: '2027', exact: true }).click()
    await expect(tags).toHaveCount(3)
  })

  test(`the answer card and the whole bill keep their height when the year changes, at ${width}px (#1417)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(POST)
    const cards = [
      page.getByRole('region', { name: 'Your City tax' }),
      page.getByRole('region', { name: 'Your whole property tax bill' }),
    ]
    const heights = async () => Promise.all(cards.map(async (card) => (await boxOf(card)).height))
    const [laterAnswer, laterBill] = await heights()
    await page.getByRole('button', { name: '2026', exact: true }).click()
    await page.waitForTimeout(800)
    const [earlierAnswer, earlierBill] = await heights()
    expect(earlierAnswer, 'the answer card keeps its height').toBeCloseTo(laterAnswer ?? 0, 0)
    expect(earlierBill, 'the whole bill keeps its height').toBeCloseTo(laterBill ?? 0, 0)
  })
}
