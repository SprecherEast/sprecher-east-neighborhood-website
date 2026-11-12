import type { Locator, Page } from '@playwright/test'

import { BILL_POST_SLUG } from './support/alignmentSlug'
import { expect, test } from './support/test'

// The "Your share" tab as a page draws it (#1118): the estimator's year control is one joined
// control on the box's row and as tall as the box, the answer card's label and badge share a row,
// nothing sticks out sideways, and opening a row keeps its title where it was on screen.

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

  test(`opening a row keeps its title where it was on screen at ${width}px`, async ({ page }) => {
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
      await row.click()
      await expect(row.locator('xpath=..')).toHaveJSProperty('open', true)
      // The view may not move while the row opens and its content settles
      for (let i = 0; i < 4; i++) {
        await page.waitForTimeout(150)
        expect(await top(row), `${title}: the title stays put`).toBeCloseTo(before, 0)
      }
      await row.click()
    }
  })
}
