import type { Locator, Page } from '@playwright/test'

import { BILL_POST_SLUG } from './support/alignmentSlug'
import { expect, test } from './support/test'

// The "Your share" tab as a page draws it (#1118): the estimator's year control is one joined
// control on the box's row and as tall as the box, the answer card's label and badge share a row,
// nothing sticks out sideways, and opening a row keeps its title where it was on screen. Every
// percent on the bar fits inside its slice, "Tax rates" is centred over the year control, the City's
// receipt row is highlighted and the first row is open on load (#1121).

const POST = `/posts/${BILL_POST_SLUG}`
const WIDTHS = [320, 390, 768, 1280]
const ROW_TITLES = ['Where the City share goes', 'How we estimate this', 'Sources']

const estimator = (page: Page) => page.getByRole('region', { name: 'Rough Estimator' })
const box = (page: Page) => estimator(page).locator('[data-field-bar]')
const years = (page: Page) => estimator(page).getByRole('group', { name: 'Tax rates' })
const summary = (page: Page, title: string) =>
  page.locator('summary', { hasText: new RegExp(`^${title}$`) })
/** A locator's box, or a failure that says it is not on the page */
const boxOf = async (locator: Locator) => {
  const found = await locator.boundingBox()
  if (!found) throw new Error('The element is not on the page')
  return found
}
const top = async (locator: Locator) => Math.round((await boxOf(locator)).y)

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
        await boxOf(estimator(page).getByText('Your home’s assessed value')),
      ]
      expect(Math.round(mine.y), 'the labels share a line').toBe(Math.round(theirs.y))
    } else expect(group.y).toBeGreaterThan(field.y + field.height - 1)

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
      .locator('[data-share-bill] li')
      .evaluateAll((items) => items.map((li) => Math.round(li.getBoundingClientRect().height)))
    expect(Math.max(...rows), `every receipt name is on one line: ${rows}`).toBeLessThanOrEqual(22)

    const sideways = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(sideways, 'nothing sticks out sideways').toBeLessThanOrEqual(0)
  })

  test(`every percent on the bar fits inside its slice, and the City's row is highlighted at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(POST)
    const bar = page.locator('[data-share-bill] svg[role="img"]')
    await bar.scrollIntoViewIfNeeded()
    // The bar measures its labels once it has hydrated; wait for the widths to settle
    await page.waitForTimeout(500)
    const slices = await bar.locator('rect[data-share-slice]').evaluateAll((rects) =>
      rects.map((rect) => {
        const key = rect.getAttribute('data-share-slice')
        const slice = rect.getBoundingClientRect()
        const label = (rect as SVGElement).ownerSVGElement?.querySelector(
          `text[data-share-label="${key}"]`,
        )
        const text = label?.getBoundingClientRect()
        return {
          key,
          percent: label?.textContent,
          slice: { left: slice.left, right: slice.right },
          text: text && { left: text.left, right: text.right, height: text.height },
        }
      }),
    )
    expect(slices).toHaveLength(4)
    for (const { key, percent, slice, text } of slices) {
      expect(percent, `${key} shows its percent`).toMatch(/^\d+%$/)
      expect(text?.left, `${key}'s percent starts inside its slice`).toBeGreaterThanOrEqual(
        slice.left + 2,
      )
      expect(text?.right, `${key}'s percent ends inside its slice`).toBeLessThanOrEqual(
        slice.right - 2,
      )
      expect(text?.height, `${key}'s percent is on one line`).toBeLessThan(24)
    }
    // The receipt's rows keep their columns: the percents and the amounts end on the same lines
    const ends = await page.locator('[data-share-bill] li').evaluateAll((rows) =>
      rows.map((row) => {
        const [, percent, amount] = Array.from(row.children).map((c) =>
          Math.round(c.getBoundingClientRect().right),
        )
        return { percent, amount }
      }),
    )
    expect(new Set(ends.map((end) => end.percent)).size, 'percents end level').toBe(1)
    expect(new Set(ends.map((end) => end.amount)).size, 'amounts end level').toBe(1)
    // The City's row has a fill and bolder text; the others have neither
    const looks = await page.locator('[data-share-bill] li').evaluateAll((rows) =>
      rows.map((row) => {
        const style = getComputedStyle(row)
        return { fill: style.backgroundColor, weight: Number(style.fontWeight) }
      }),
    )
    expect(looks[0]?.fill).not.toBe('rgba(0, 0, 0, 0)')
    expect(looks[0]?.weight).toBeGreaterThanOrEqual(600)
    for (const other of looks.slice(1)) {
      expect(other.fill).toBe('rgba(0, 0, 0, 0)')
      expect(other.weight).toBeLessThan(600)
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

  test(`the first row is open on load and the other two are closed at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(POST)
    const open = await page
      .locator('details:has(> summary)')
      .filter({ has: page.locator('summary', { hasText: /^(Where|How|Sources)/ }) })
      .evaluateAll((rows) => rows.map((row) => (row as HTMLDetailsElement).open))
    expect(open).toEqual([true, false, false])
  })

  test(`opening or closing a row keeps its title where it was on screen at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(POST)
    for (const title of ROW_TITLES) {
      const row = summary(page, title)
      await row.scrollIntoViewIfNeeded()
      // Put the title at about two thirds of the screen, then let any smooth scrolling end
      await row.evaluate((el) =>
        window.scrollBy({
          top: el.getBoundingClientRect().top - innerHeight * 0.6,
          behavior: 'instant',
        }),
      )
      await page.waitForTimeout(300)
      const before = await top(row)
      const wasOpen = await row
        .locator('xpath=..')
        .evaluate((el) => (el as HTMLDetailsElement).open)
      await row.click()
      await expect(row.locator('xpath=..')).toHaveJSProperty('open', !wasOpen)
      // The view may not move while the row opens and its content settles
      for (let i = 0; i < 4; i++) {
        await page.waitForTimeout(150)
        expect(await top(row), `${title}: the title stays put`).toBeCloseTo(before, 0)
      }
      await row.click()
      await expect(row.locator('xpath=..')).toHaveJSProperty('open', wasOpen)
      expect(await top(row), `${title}: the title stays put when it goes back`).toBeCloseTo(
        before,
        0,
      )
    }
  })
}

// With scripting off the first row is open too: it is in the page's own markup (#1121)
test.describe('without scripting', () => {
  test.use({ javaScriptEnabled: false })
  test('the first row is open and the other two are closed', async ({ page }) => {
    await page.goto(POST)
    const open = await page
      .locator('summary', { hasText: /^(Where the City share goes|How we estimate this|Sources)$/ })
      .evaluateAll((rows) => rows.map((row) => (row.parentElement as HTMLDetailsElement).open))
    expect(open).toEqual([true, false, false])
  })
})
