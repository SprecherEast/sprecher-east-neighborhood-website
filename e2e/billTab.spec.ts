import type { Locator, Page } from '@playwright/test'

import {
  BILL_POST_PATH as POST,
  BILL_ROW_TITLES as ROW_TITLES,
  BILL_WIDTHS as WIDTHS,
  summaryRow as summary,
} from './support/billRows'
import { expect, test } from './support/test'

// The "Your share" tab as a page draws it (#1118): the estimator's year control is one joined
// control on the box's row and as tall as the box, the answer card's label and badge share a row,
// nothing sticks out sideways (an opened row coming into view is `disclosure.spec.ts`). Every
// percent on the bar fits inside its slice, "Tax rates" is centred over the year control, the City's
// receipt row is highlighted with the breakdown under it, and every row is closed on load (#1121, #1163).

const estimator = (page: Page) => page.getByRole('region', { name: 'Rough Estimator' })
const box = (page: Page) => estimator(page).locator('[data-field-bar]')
const years = (page: Page) => estimator(page).getByRole('group', { name: 'Tax rates' })
/** A locator's box, or a failure that says it is not on the page */
const boxOf = async (locator: Locator) => {
  const found = await locator.boundingBox()
  if (!found) throw new Error('The element is not on the page')
  return found
}

for (const width of WIDTHS) {
  test(`the estimator, the answer card and the page fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(POST)
    await estimator(page).scrollIntoViewIfNeeded()

    // The years are one control of two options showing the year numbers only
    await expect(years(page).getByRole('button')).toHaveText(['2026', '2027'])
    const group = await boxOf(years(page))
    const field = await boxOf(box(page))
    expect(group.height, 'nothing in the row is larger than the box').toBeLessThanOrEqual(
      field.height,
    )
    // On a phone from 360 px the control shares the box's row, centred on it, and its short label is
    // on the line of the box's label; narrower, the control stacks under the box, whole
    if (width >= 360) {
      expect(Math.abs(group.y + group.height / 2 - (field.y + field.height / 2))).toBeLessThan(2)
      const [mine, theirs] = [
        await boxOf(estimator(page).getByText('Tax rates')),
        await boxOf(estimator(page).getByText('Enter your assessed value')),
      ]
      expect(Math.round(mine.y), 'the labels share a line').toBe(Math.round(theirs.y))
    } else expect(group.y).toBeGreaterThan(field.y + field.height - 1)

    // The same space sits above the estimator (under the intro) as below it (above the answer card) (#1142)
    const intro = await boxOf(estimator(page).locator('xpath=preceding-sibling::*[1]'))
    const answerCard = await boxOf(page.getByRole('region', { name: 'Your City tax' }))
    const gapAbove = Math.round((await boxOf(estimator(page))).y - (intro.y + intro.height))
    const gapBelow = Math.round(
      answerCard.y - ((await boxOf(estimator(page))).y + (await boxOf(estimator(page))).height),
    )
    // ... and it is the rich text paragraph spacing, 20 px (#1142)
    expect(Math.abs(gapAbove - 20), `above ${gapAbove}px`).toBeLessThanOrEqual(1)
    expect(Math.abs(gapBelow - 20), `below ${gapBelow}px`).toBeLessThanOrEqual(1)
    expect(
      Math.abs(gapAbove - gapBelow),
      `above ${gapAbove}px, below ${gapBelow}px`,
    ).toBeLessThanOrEqual(1)

    // The answer card's label and badge share a row from 390 px (the 320 px card is too narrow for both
    // and puts the badge whole on a line of its own); either way the badge stays inside the card
    const answer = page.getByRole('region', { name: 'Your City tax' })
    const label = answer.getByText('City tax on an average home')
    const badge = answer.getByText('Proposed')
    const card = await boxOf(answer)
    const [l, b] = [await boxOf(label), await boxOf(badge)]
    if (width >= 390) expect(Math.abs(l.y + l.height / 2 - (b.y + b.height / 2))).toBeLessThan(2)
    expect(b.x + b.width, 'the badge stays inside the card').toBeLessThanOrEqual(
      card.x + card.width + 1,
    )

    // "Tax rates" is centred over the joined control, beside the box and stacked alike (#1121)
    const [name, control] = [
      await boxOf(estimator(page).getByText('Tax rates')),
      await boxOf(years(page)),
    ]
    expect(
      Math.abs(name.x + name.width / 2 - (control.x + control.width / 2)),
      '"Tax rates" is centred over the control',
    ).toBeLessThanOrEqual(1)

    // Each year option is tapped as 44 px tall though drawn 36 px: its invisible area reaches past the box
    const reach = await years(page)
      .getByRole('button')
      .first()
      .evaluate((el) => {
        const after = getComputedStyle(el, '::after')
        return { position: after.position, top: after.top, bottom: after.bottom }
      })
    expect(reach).toEqual({ position: 'absolute', top: '-4px', bottom: '-4px' })

    // No receipt name wraps, down to 320 px
    const rows = await page
      .locator('[data-share-bill] li[data-share-row]')
      .evaluateAll((items) =>
        items.map((li) => Math.round((li.children[0] as Element).getBoundingClientRect().height)),
      )
    expect(Math.max(...rows), `every receipt name is on one line: ${rows}`).toBeLessThanOrEqual(22)

    const sideways = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(sideways, 'nothing sticks out sideways').toBeLessThanOrEqual(0)
  })

  test(`every body has its own bar on one scale, and all four rows look alike at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(POST)
    const rows = page.locator('[data-share-bill] li[data-share-row]')
    await rows.first().scrollIntoViewIfNeeded()
    // No segmented bar on top any more, and no colour squares
    await expect(page.locator('[data-share-bill] svg[role="img"]')).toHaveCount(0)
    const bars = await rows.evaluateAll((items) =>
      items.map((row) => {
        const svg = row.querySelector('svg') as SVGElement
        const track = svg.getBoundingClientRect()
        const fill = (svg.querySelector('rect[data-share-bar]') as Element).getBoundingClientRect()
        return {
          left: Math.round(track.left),
          right: Math.round(track.right),
          height: Math.round(track.height),
          fill: Math.round(fill.width),
          rowHeight: Math.round(row.getBoundingClientRect().height),
        }
      }),
    )
    expect(bars).toHaveLength(4)
    // Every track has the same edges and height, so no row looks squished
    expect(new Set(bars.map((bar) => bar.left)).size, 'tracks start level').toBe(1)
    expect(new Set(bars.map((bar) => bar.right)).size, 'tracks end level').toBe(1)
    expect(new Set(bars.map((bar) => bar.height)).size, 'bars are as thick as each other').toBe(1)
    // The largest slice fills its track (within a pixel), the others are shorter
    const track =
      (bars[0] as { right: number; left: number }).right - (bars[0] as { left: number }).left
    expect(Math.max(...bars.map((bar) => bar.fill))).toBeGreaterThanOrEqual(track - 1)
    // The receipt's rows keep their columns: the percents and the amounts end on the same lines
    const ends = await rows.evaluateAll((items) =>
      items.map((row) => {
        const [, percent, amount] = Array.from(row.children).map((c) =>
          Math.round(c.getBoundingClientRect().right),
        )
        return { percent, amount }
      }),
    )
    expect(new Set(ends.map((end) => end.percent)).size, 'percents end level').toBe(1)
    expect(new Set(ends.map((end) => end.amount)).size, 'amounts end level').toBe(1)
    // The City's row has no fill or bolder text of its own: all four rows are built alike
    const looks = await rows.evaluateAll((items) =>
      items.map((row) => {
        const style = getComputedStyle(row)
        return { fill: style.backgroundColor, weight: Number(style.fontWeight) }
      }),
    )
    for (const look of looks) {
      expect(look.fill).toBe('rgba(0, 0, 0, 0)')
      expect(look.weight).toBeLessThan(600)
    }
  })

  test(`the earliest year reads "Base year" in the primary green and the card keeps its height at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(POST)
    const answer = page.getByRole('region', { name: 'Your City tax' })
    const line = answer.locator('[data-answer-increase]')
    await expect(line).toContainText('Up $')
    const later = await boxOf(answer)
    const accent = await line.evaluate((el) => getComputedStyle(el).color)
    await years(page).getByRole('button', { name: '2026' }).click()
    await expect(line).toHaveText('Base year')
    // Wait out the half-second count of the year switch
    await page.waitForTimeout(800)
    const earlier = await boxOf(answer)
    expect(earlier.height, 'the card is as tall in both years').toBeCloseTo(later.height, 0)
    expect(await line.evaluate((el) => getComputedStyle(el).color)).not.toBe(accent)
    await years(page).getByRole('button', { name: '2027' }).click()
    await expect(line).toContainText('Up $')
  })

  test(`the breakdown sits under the City's row, set in, its amounts clear of the bodies’, at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(POST)
    const bill = page.getByRole('region', { name: 'Your whole property tax bill' })
    const cityRow = bill.locator('li[data-share-row="city"]')
    const row = summary(page, ROW_TITLES[0])
    await expect(bill.locator('[data-share-bill] ul > li').filter({ has: row })).toHaveCount(1)
    const [name, label, rowBox, cityBox] = await Promise.all([
      boxOf(cityRow.getByText('City of Madison')),
      boxOf(row.locator('span', { hasText: ROW_TITLES[0] }).first()),
      boxOf(row),
      boxOf(cityRow),
    ])
    // Set in from the left of the City's name; the button keeps its full width
    expect(label.x, 'the label starts to the right of the City’s name').toBeGreaterThan(name.x + 8)
    // Opened, its amounts end before the bodies' amounts, so they are not read as parts of the sum (#1196)
    await row.click()
    const amount = page.locator('[data-breakdown-row] [data-amount]').first()
    await expect(amount).toBeVisible()
    const [inner, outer] = await Promise.all([boxOf(amount), boxOf(cityRow.locator('span').last())])
    expect(inner.x + inner.width, 'the breakdown’s amounts end before the City’s').toBeLessThan(
      outer.x + outer.width - 16,
    )
    const gap = rowBox.y - (cityBox.y + cityBox.height)
    expect(gap, 'directly under the City’s row').toBeGreaterThanOrEqual(0)
    expect(gap, 'directly under the City’s row').toBeLessThanOrEqual(16)
    // Its label is larger than the bill's rows and smaller than the rows in the card below
    const size = (locator: Locator) =>
      locator.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    const [mine, rows, below] = await Promise.all([
      size(row),
      size(cityRow.getByText('City of Madison')),
      size(summary(page, ROW_TITLES[1])),
    ])
    expect(mine).toBeGreaterThan(rows)
    expect(mine).toBeLessThan(below)
  })

  test(`the first row's title fits on one line at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(POST)
    const title = summary(page, ROW_TITLES[0]).locator('span', { hasText: ROW_TITLES[0] }).first()
    const lines = await title.evaluate((el) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      return new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top))).size
    })
    expect(lines).toBe(1)
  })
}
