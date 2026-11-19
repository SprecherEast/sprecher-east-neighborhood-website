import { BILL_POST_PATH as POST, BILL_WIDTHS as WIDTHS } from './support/billRows'
import { expect, test } from './support/test'

// The whole bill's receipt reads like a bill and like the breakdown chart under it (#1163, #1184):
// each row's name, its percent, a clear gap, then its dollars flush right, each column ending level
// from row to row, and the total's amount ending under the rows' dollars, with nothing under the
// percents.

for (const width of WIDTHS) {
  test(`each bill row reads percent, a gap, then the dollars at the right edge, the total under the dollars, at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(POST)
    const rows = page.locator('[data-share-bill] li[data-share-row]')
    const cells = await rows.evaluateAll((items) =>
      items.map((li) => {
        const [, percent, amount] = Array.from(li.children).map((c) => c.getBoundingClientRect())
        return { amountLeft: amount.left, percentRight: percent.right, amountRight: amount.right }
      }),
    )
    for (const cell of cells) {
      expect(
        cell.amountLeft - cell.percentRight,
        'a clear gap before the dollars',
      ).toBeGreaterThanOrEqual(6)
    }
    expect(new Set(cells.map((c) => Math.round(c.amountRight))).size, 'dollars end level').toBe(1)
    expect(new Set(cells.map((c) => Math.round(c.percentRight))).size, 'percents end level').toBe(1)
    // The total's figures end where the rows' dollars end, for the average home and for a large one
    // whose total is wider than its column: it then reaches left, never under the percents
    const textRight = (el: Element) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      return range.getBoundingClientRect().right
    }
    const ends = async () =>
      page.locator('[data-share-bill]').evaluate((bill, fn) => {
        const right = new Function(`return ${fn}`)() as (el: Element) => number
        const amounts = Array.from(bill.querySelectorAll('li[data-share-row]'), (li) =>
          right(li.children[2] as Element),
        )
        const total = bill.querySelector(':scope > :last-child > p:last-child')
        return { amounts, total: right(total?.lastElementChild as Element) }
      }, textRight.toString())
    for (const value of [null, '$2,500,000']) {
      if (value) {
        await page.getByRole('textbox', { name: 'Enter your assessed value' }).fill(value)
        await page.getByRole('button', { name: 'Estimate' }).click()
        // The new bill has finished counting once its total flashes
        await expect(page.locator('[data-share-bill] p.total-pulse')).toHaveCount(1)
      }
      const { amounts, total } = await ends()
      // Nothing overlaps: each row's name ends before its dollars start, and the total's label before its amount
      const clear = await page.locator('[data-share-bill]').evaluate((bill) => {
        const gaps: number[] = []
        const range = document.createRange()
        const rows = [
          ...Array.from(bill.querySelectorAll('li[data-share-row]'), (li) => [
            li.children[0],
            li.children[1],
          ]),
          ...Array.from(bill.querySelectorAll('li[data-share-row]'), (li) => [
            li.children[0],
            li.children[2],
          ]),
          ...Array.from(bill.querySelectorAll(':scope > :last-child > p'), (p) => [
            p.children[0],
            p.children[1],
          ]),
        ]
        for (const [name, amount] of rows) {
          // What shows of the name: its box, which an ellipsis cuts, never the hidden text
          const nameEnd = (name as Element).getBoundingClientRect().right
          range.selectNodeContents(amount as Element)
          gaps.push(range.getBoundingClientRect().left - nameEnd)
        }
        return Math.min(...gaps)
      })
      expect(
        clear,
        `names never touch the percents or the amounts (${value ?? 'average'})`,
      ).toBeGreaterThanOrEqual(4)
      for (const amount of amounts) {
        expect(
          Math.abs(total - amount),
          `the total ends under the dollars (${value ?? 'average'})`,
        ).toBeLessThan(1.5)
      }
    }
  })
}
