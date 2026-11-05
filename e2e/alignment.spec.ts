import type { Page } from '@playwright/test'

import { ALIGNMENT_POST_SLUG } from './support/alignmentSlug'
import { expect, test } from './support/test'

// Repeating things stay in line (#678): in a row of cards, the same part of every card (its
// value, its foot, its bottom edge) sits at one height, whatever wraps or is missing in one of them.
// The page holds the content most likely to break that; each width is measured as rendered.

const WIDTHS = [320, 430, 768, 1024, 1280, 1920]
const POST = `/posts/${ALIGNMENT_POST_SLUG}`

/** Where a fact's parts are marked (`FactCard`), on a key fact card and on a fact tab button alike */
const VALUE = '[data-fact-part="value"]'
const FOOT = '[data-fact-part="foot"]'
const KEY_FACT_LISTS = `ul:has(${VALUE})`
const TAB_LISTS = '[role="tablist"]'

type Box = { top: number; value: number; foot: number; badge: number; height: number }

/** Every row of every group of cards on the page, as the heights of the same part of each card */
async function measureRows(page: Page, group: string, card: string) {
  return page.evaluate(
    ({ group, card, value, foot }) =>
      [...document.querySelectorAll(group)].map((list) => {
        const rows = new Map<number, Box[]>()
        for (const element of list.querySelectorAll(card)) {
          const top = (e: Element | null) => {
            if (!e) throw new Error(`No part of the card matches in ${card}`)
            return Math.round(e.getBoundingClientRect().top)
          }
          const box: Box = {
            top: top(element),
            value: top(element.querySelector(value)),
            foot: top(element.querySelector(foot)),
            // The badge is the foot's first child: it stays on the foot's first line, even where a
            // link beside it wraps to a second line in another card
            badge: top(element.querySelector(foot)?.firstElementChild ?? null),
            height: Math.round(element.getBoundingClientRect().height),
          }
          rows.set(box.top, [...(rows.get(box.top) ?? []), box])
        }
        return [...rows.values()]
      }),
    { group, card, value: VALUE, foot: FOOT },
  )
}

function expectRowsAligned(groups: Box[][][], name: string, width: number) {
  expect(groups.length, `${name}: the page has some`).toBeGreaterThan(0)
  for (const rows of groups) {
    for (const row of rows) {
      const same = (part: keyof Box) => new Set(row.map((box) => box[part])).size === 1
      expect(same('value'), `${name}: values share a line in ${JSON.stringify(row)}`).toBe(true)
      expect(same('foot'), `${name}: feet share a line in ${JSON.stringify(row)}`).toBe(true)
      expect(same('badge'), `${name}: badges share a line in ${JSON.stringify(row)}`).toBe(true)
      expect(same('height'), `${name}: cards are as tall as each other`).toBe(true)
    }
  }
  // A wide screen must really put cards side by side, or one card per row would pass every check
  if (width >= 1024) {
    expect(
      groups.some((rows) => rows.some((row) => row.length > 1)),
      `${name}: some cards share a row at ${width}px`,
    ).toBe(true)
  }
}

test.describe('cards in a row stay in line', () => {
  for (const width of WIDTHS) {
    test(`key fact cards and fact tab buttons at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(POST)

      expectRowsAligned(
        await measureRows(page, KEY_FACT_LISTS, ':scope > li'),
        'key fact cards',
        width,
      )
      expectRowsAligned(
        await measureRows(page, TAB_LISTS, '[role="tab"]'),
        'fact tab buttons',
        width,
      )
    })
  }

  test('three facts sit three across or one per row, never two and one', async ({ page }) => {
    await page.goto(POST)
    for (const width of WIDTHS) {
      // The columns follow the block's width, so resizing is enough: no new page load
      await page.setViewportSize({ width, height: 900 })
      const columns = await page.evaluate((lists) => {
        const list = document.querySelector(lists)
        if (!list) throw new Error('No key facts on the page')
        return new Set(
          [...list.querySelectorAll(':scope > li')].map((li) =>
            Math.round(li.getBoundingClientRect().left),
          ),
        ).size
      }, KEY_FACT_LISTS)
      expect([1, 3], `${width}px`).toContain(columns)
    }
  })
})
