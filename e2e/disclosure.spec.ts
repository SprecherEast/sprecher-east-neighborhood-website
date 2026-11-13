import type { Locator, Page } from '@playwright/test'

import { BILL_POST_SLUG } from './support/alignmentSlug'
import { expect, test } from './support/test'

// An open-and-close box a reader opens is scrolled into view (#1152), on the page that has the
// most of them: the rows under the whole bill, and the link under the chart inside the first row.
// The box's end shows, or its top when it is taller than the screen; nothing above it moves on the
// page (#1118), and closing never scrolls.

const POST = `/posts/${BILL_POST_SLUG}`
const WIDTHS = [320, 390, 768, 1280]
const ROW_TITLES = ['Your City tax breakdown', 'How we estimate this', 'Sources']

const summary = (page: Page, title: string) =>
  page.locator('summary', { hasText: new RegExp(`^${title}$`) })
/** How far down the page a locator starts, whatever the scroll */
const onPage = (locator: Locator) =>
  locator.evaluate((el) => Math.round(el.getBoundingClientRect().top + scrollY))
/** Waits until the page has stopped scrolling (opening a box scrolls smoothly) */
const settle = async (page: Page) => {
  let last = Number.NaN
  await expect
    .poll(
      async () => {
        const now = await page.evaluate(() => scrollY)
        const still = now === last
        last = now
        return still
      },
      { intervals: [200] },
    )
    .toBe(true)
}
/**
 * An opened box is in view (#1152): its end shows with its gap under it, or, when it is taller than
 * the screen, its top sits where its scroll margin stops it; the sticky header never covers its top.
 */
const expectInView = async (details: Locator, name: string) => {
  const box = await details.evaluate((el) => {
    const { top, bottom } = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    return {
      top,
      bottom,
      screen: innerHeight,
      above: parseFloat(style.scrollMarginTop),
      below: parseFloat(style.scrollMarginBottom),
    }
  })
  expect(box.above, `${name}: the box clears the sticky header`).toBeGreaterThan(0)
  expect(box.top, `${name}: its top is not under the header`).toBeGreaterThanOrEqual(box.above - 1)
  const endShows = box.bottom <= box.screen - box.below + 1
  const topWins = Math.abs(box.top - box.above) <= 1
  expect(endShows || topWins, `${name}: its end shows, or its top when it is too tall`).toBe(true)
}

for (const width of WIDTHS) {
  test(`an opened row comes into view, and nothing above it moves on the page at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(POST)
    for (const title of ROW_TITLES) {
      const row = summary(page, title)
      const details = row.locator('xpath=..')
      if (await details.evaluate((el) => (el as HTMLDetailsElement).open)) await row.click()
      await expect(details).toHaveJSProperty('open', false)
      // Put the closed row at the foot of the screen, so what it opens starts out of view
      await row.evaluate((el) =>
        window.scrollBy({
          top: el.getBoundingClientRect().bottom - innerHeight + 4,
          behavior: 'instant',
        }),
      )
      await settle(page)
      const onPageBefore = await onPage(row)

      await row.click()
      await expect(details).toHaveJSProperty('open', true)
      await settle(page)
      await expectInView(details, title)
      // The page scrolled; the row itself is where it was on the page (#1118)
      expect(await onPage(row), `${title}: nothing above the row moved`).toBeCloseTo(
        onPageBefore,
        0,
      )

      // Opening it again when it is already in view moves nothing, and closing never scrolls
      const scrolled = await page.evaluate(() => Math.round(scrollY))
      await row.click()
      await expect(details).toHaveJSProperty('open', false)
      await settle(page)
      const afterClose = await page.evaluate(() => ({
        y: Math.round(scrollY),
        end: Math.round(document.documentElement.scrollHeight - innerHeight),
      }))
      // A shorter page can leave less to scroll: only then may the view move, to the page's end
      if (afterClose.y !== scrolled) expect(afterClose.y, `${title}: closing`).toBe(afterClose.end)
      await row.click()
      await expect(details).toHaveJSProperty('open', true)
      await settle(page)
      await expectInView(details, title)
    }
  })

  test(`the list under a chart's link comes into view when it opens at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(POST)
    const row = page.locator('summary:visible', { hasText: /^See the smaller pieces$/ }).first()
    const details = row.locator('xpath=..')
    await row.evaluate((el) =>
      window.scrollBy({
        top: el.getBoundingClientRect().bottom - innerHeight + 4,
        behavior: 'instant',
      }),
    )
    await settle(page)

    await row.click()
    await expect(details).toHaveJSProperty('open', true)
    await settle(page)
    await expectInView(details, 'See the smaller pieces')
  })
}
