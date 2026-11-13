import type { Locator } from '@playwright/test'

import {
  BILL_POST_PATH as POST,
  BILL_ROW_TITLES as ROW_TITLES,
  summaryRow as summary,
} from './support/billRows'
import { expect, test } from './support/test'

/** A locator's box, or a failure that says it is not on the page */
const boxOf = async (locator: Locator) => {
  const found = await locator.boundingBox()
  if (!found) throw new Error('The element is not on the page')
  return found
}

// The breakdown opens by itself once, after the reader's first value, when the total has counted
// and flashed and a short pause has passed, expanding over a moment rather than snapping, without
// scrolling the page (#1163, #1170)
test('the breakdown opens after the first value, once, and scrolls nothing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(POST)
  const row = summary(page, ROW_TITLES[0])
  const details = row.locator('xpath=..')
  const input = page.getByRole('textbox', { name: 'Enter your assessed value' })
  await input.scrollIntoViewIfNeeded()
  await input.fill('$700,000')
  await page.getByRole('button', { name: 'Estimate' }).click()
  // The count, the flash (1.5 s) and then the pause (0.4 s): still closed while the total counts and flashes
  await page.waitForTimeout(2500)
  await expect(details).toHaveJSProperty('open', false)
  const before = await boxOf(row)
  // From now on, note the row's height on every frame
  await details.evaluate((el) => {
    const seen: number[] = []
    ;(el as HTMLElement & { seen: number[] }).seen = seen
    const tick = () => {
      seen.push(el.getBoundingClientRect().height)
      requestAnimationFrame(tick)
    }
    tick()
  })
  await expect(details).toHaveJSProperty('open', true, { timeout: 2500 })
  // It expands over about 200 ms rather than snapping: the heights drawn while it opened include some
  // between closed and settled
  await page.waitForTimeout(600)
  const heights = await details.evaluate((el) => (el as HTMLElement & { seen: number[] }).seen)
  const settled = heights[heights.length - 1]
  expect(
    heights.some((height) => height > heights[0] && height < settled),
    'the row expands rather than snapping',
  ).toBe(true)
  const after = await boxOf(row)
  expect(after.y, 'opening by itself moves nothing on screen').toBeCloseTo(before.y, 0)
  // Closed by the reader, it stays closed for the next value
  await row.click()
  await expect(details).toHaveJSProperty('open', false)
  await input.fill('$800,000')
  await page.getByRole('button', { name: 'Estimate' }).click()
  await page.waitForTimeout(6000)
  await expect(details).toHaveJSProperty('open', false)
})
