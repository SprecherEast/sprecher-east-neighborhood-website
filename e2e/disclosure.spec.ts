import type { Locator, Page } from '@playwright/test'

import {
  BILL_POST_PATH as POST,
  BILL_ROW_TITLES as ROW_TITLES,
  BILL_WIDTHS as WIDTHS,
  summaryRow as summary,
} from './support/billRows'
import { expect, test } from './support/test'

// An open-and-close box a reader opens is scrolled into view (#1152), on the page that has the
// most of them: the rows under the whole bill, and the link under the chart inside the first row.
// The box's end shows, or its top when it is taller than the screen; nothing above it moves on the
// page (#1118); a box already in view, a box open on load and a closing box never scroll. A box
// with another directly under it also shows that one's summary row (#1154).

const scrolledTo = (page: Page) => page.evaluate(() => Math.round(scrollY))
const boxOfRow = (row: Locator) => row.locator('xpath=..')
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
 * With another box directly under it, that one's summary row shows whole too, and the room kept
 * under the opened box is more than that row (#1154); with none, only the small gap is kept.
 */
const expectInView = async (details: Locator, name: string) => {
  const box = await details.evaluate((el) => {
    const { top, bottom } = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    const next = el.nextElementSibling
    const nextRow =
      next instanceof HTMLDetailsElement ? next.querySelector(':scope > summary') : null
    return {
      top,
      bottom,
      screen: innerHeight,
      above: parseFloat(style.scrollMarginTop),
      below: parseFloat(style.scrollMarginBottom),
      gap: parseFloat(getComputedStyle(document.documentElement).fontSize),
      nextRow: nextRow ? nextRow.getBoundingClientRect().toJSON() : null,
    }
  })
  expect(box.above, `${name}: the box clears the sticky header`).toBeGreaterThan(0)
  expect(box.top, `${name}: its top is not under the header`).toBeGreaterThanOrEqual(box.above - 1)
  const endShows = box.bottom <= box.screen - box.below + 1
  const topWins = Math.abs(box.top - box.above) <= 1
  expect(endShows || topWins, `${name}: its end shows, or its top when it is too tall`).toBe(true)
  if (!box.nextRow) {
    expect(box.below, `${name}: nothing under it, so only the gap is kept`).toBeCloseTo(box.gap, 0)
    return
  }
  expect(box.below, `${name}: room for the next row and a little more`).toBeGreaterThan(
    box.gap + box.nextRow.height,
  )
  if (endShows)
    expect(box.nextRow.bottom, `${name}: the next row shows whole`).toBeLessThanOrEqual(box.screen)
}
/** Puts a closed row at the foot of the screen, so what it opens starts out of view */
const toFoot = async (page: Page, row: Locator) => {
  await row.evaluate((el) =>
    window.scrollBy({
      top: el.getBoundingClientRect().bottom - innerHeight + 4,
      behavior: 'instant',
    }),
  )
  await settle(page)
}
/** Clicks the row and waits for its box to be open or closed, and for the page to stop */
const toggle = async (page: Page, row: Locator, open: boolean) => {
  await row.click()
  await expect(boxOfRow(row)).toHaveJSProperty('open', open)
  await settle(page)
}

for (const width of WIDTHS) {
  test(`an opened row comes into view, and nothing above it moves on the page at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(POST)
    // Every row is closed on load (#1163): loading scrolls nothing
    await expect(boxOfRow(summary(page, ROW_TITLES[0]))).toHaveJSProperty('open', false)
    await settle(page)
    expect(await scrolledTo(page), 'loading does not scroll').toBe(0)

    for (const title of ROW_TITLES) {
      const row = summary(page, title)
      const details = boxOfRow(row)
      if (await details.evaluate((el) => (el as HTMLDetailsElement).open))
        await toggle(page, row, false)
      await toFoot(page, row)
      const onPageBefore = await onPage(row)

      await toggle(page, row, true)
      await expectInView(details, title)
      // The page scrolled; the row itself is where it was on the page (#1118)
      expect(await onPage(row), `${title}: nothing above the row moved`).toBeCloseTo(
        onPageBefore,
        0,
      )

      // Closing never scrolls. A shorter page can leave less to scroll: only then may the view
      // move, to the page's end
      const opened = await scrolledTo(page)
      await toggle(page, row, false)
      const closed = await scrolledTo(page)
      const end = await page.evaluate(() =>
        Math.round(document.documentElement.scrollHeight - innerHeight),
      )
      if (closed !== opened) expect(closed, `${title}: closing`).toBe(end)

      // Opened again from where it was just in view, it moves nothing
      await toggle(page, row, true)
      if (closed === opened)
        expect(await scrolledTo(page), `${title}: already in view`).toBe(opened)
      await expectInView(details, title)
    }
  })

  test(`the list under a chart's link comes into view when it opens at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(POST)
    // The chart sits in the City's breakdown, which is closed on load (#1163)
    await toggle(page, summary(page, ROW_TITLES[0]), true)
    const row = page.locator('summary:visible', { hasText: /^See the smaller pieces$/ }).first()
    await toFoot(page, row)

    await toggle(page, row, true)
    await expectInView(boxOfRow(row), 'See the smaller pieces')
  })
}
