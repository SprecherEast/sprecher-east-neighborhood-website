import { BILL_POST_PATH as POST, BILL_WIDTHS as WIDTHS } from './support/billRows'
import { expect, test } from './support/test'

// The whole bill's receipt reads like the breakdown chart under it (#1163): each row's dollars, a
// clear gap, then its percent, each column ending level from row to row, and the total's amount
// ending under the rows' dollars, with nothing under the percents.

for (const width of WIDTHS) {
  test(`each bill row reads dollars, a gap, then the percent, the total under the dollars, at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(POST)
    const rows = page.locator('[data-share-bill] li[data-share-row]')
    const cells = await rows.evaluateAll((items) =>
      items.map((li) => {
        const [, amount, percent] = Array.from(li.children).map((c) => c.getBoundingClientRect())
        return { amountRight: amount.right, percentLeft: percent.left, percentRight: percent.right }
      }),
    )
    for (const cell of cells) {
      expect(
        cell.percentLeft - cell.amountRight,
        'a clear gap before the percent',
      ).toBeGreaterThanOrEqual(6)
    }
    expect(new Set(cells.map((c) => Math.round(c.amountRight))).size, 'dollars end level').toBe(1)
    expect(new Set(cells.map((c) => Math.round(c.percentRight))).size, 'percents end level').toBe(1)
    const total = await page
      .locator('[data-share-bill] > p')
      .last()
      .evaluate((p) => (p.lastElementChild as HTMLElement).getBoundingClientRect().right)
    expect(
      Math.abs(total - (cells[0]?.amountRight ?? 0)),
      'the total ends under the dollars',
    ).toBeLessThan(1.5)
  })
}
