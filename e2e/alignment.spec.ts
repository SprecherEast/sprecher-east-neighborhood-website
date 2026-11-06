import type { Locator, Page } from '@playwright/test'

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

// What the owner saw on the real post (#707): the tabs hang apart from the open panel, one tab
// carries a line the others lack, and a figure breaks in the middle of a phrase.
const TAB = '[role="tab"]'
const ACTIVE_PANEL = '[role="tabpanel"][data-state="active"]'
/** The explanation the fixture's third fact has and the others lack; a tab must not show it */
const DETAIL = 'The City’s release says about $7 a month'

test.describe('fact tabs stay tidy', () => {
  for (const width of WIDTHS) {
    test(`gap, parts and wrapping at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(POST)
      const list = page.locator(TAB_LISTS).first()
      await list.scrollIntoViewIfNeeded()

      const measured = await list.evaluate(
        (list, { tab, panel, value }) => {
          const tabs = [...list.querySelectorAll(tab)]
          const box = (e: Element) => e.getBoundingClientRect()
          const active = document.querySelector(panel)
          const activeTab = tabs.find((t) => t.getAttribute('data-state') === 'active')
          if (!active || !activeTab || tabs.length < 2) {
            throw new Error('No fact tabs with an open panel')
          }
          // Each word of a figure, with its line, to see where it breaks
          const lines = tabs.map((t) => {
            const figure = t.querySelector(value)
            if (!figure?.firstChild) throw new Error('A tab has no figure')
            const words: { word: string; top: number; right: number }[] = []
            for (const m of (figure.textContent ?? '').matchAll(/\S+/g)) {
              const range = document.createRange()
              range.setStart(figure.firstChild, m.index)
              range.setEnd(figure.firstChild, m.index + m[0].length)
              const r = range.getBoundingClientRect()
              words.push({ word: m[0], top: Math.round(r.top), right: Math.round(r.right) })
            }
            return { words, tabRight: Math.round(box(t).right) }
          })
          return {
            tabGap: Math.round(box(tabs[1]).left - box(tabs[0]).right),
            panelGap: Math.round(box(active).top - box(tabs[0]).bottom),
            texts: tabs.map((t) => t.textContent ?? ''),
            lines,
            // The tab's corner, the curved join's size and the box's corner (#738)
            radii: {
              tab: getComputedStyle(activeTab).borderTopRightRadius,
              join: getComputedStyle(activeTab, '::before').height,
              box: getComputedStyle(active).borderBottomRightRadius,
            },
          }
        },
        { tab: TAB, panel: ACTIVE_PANEL, value: VALUE },
      )

      // The space under the tabs is the space between them, not a wider, unexplained one
      expect(measured.panelGap, 'tabs to panel equals tab to tab').toBe(measured.tabGap)
      // One radius all the way round: the tab, the curved join beside it and the box
      expect(measured.radii.join, 'the join is as round as the tab').toBe(measured.radii.tab)
      expect(measured.radii.box, 'the box is as round as the tab').toBe(measured.radii.tab)
      for (const text of measured.texts) {
        expect(text, 'a tab carries no line the others lack').not.toContain(DETAIL)
      }
      for (const { words, tabRight } of measured.lines) {
        const label = words.map((w) => w.word).join(' ')
        words.forEach((w, i) => {
          expect(w.right, `${label} stays inside its tab`).toBeLessThanOrEqual(tabRight)
          // A line never ends on a lone short word: "+$90 a / year" reads as broken
          const next = words[i + 1]
          if (next && w.word.length === 1) {
            expect(next.top, `"${w.word}" stays with "${next.word}" in ${label}`).toBe(w.top)
          }
        })
      }
    })
  }
})

// A figure's caption, then its legend (#658): the legend starts below the caption instead of
// covering it, and is as wide as the image, so their left and right edges are the same.
test.describe('a legend sits under its figure and caption', () => {
  for (const width of WIDTHS) {
    test(`caption and legend at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(POST)
      const legend = page.locator('ol[aria-label="Diagram key"]').locator('..')
      await legend.scrollIntoViewIfNeeded()
      const figure = legend.locator('xpath=preceding-sibling::figure[1]')

      const box = async (locator: Locator) => {
        const rect = await locator.boundingBox()
        if (!rect) throw new Error('Nothing to measure: the element is not on the page')
        return {
          left: rect.x,
          right: rect.x + rect.width,
          top: rect.y,
          bottom: rect.y + rect.height,
        }
      }
      const image = await box(figure.locator('img'))
      const caption = await box(figure.locator('figcaption'))
      const key = await box(legend)

      expect(key.top, 'the legend starts below the whole caption').toBeGreaterThanOrEqual(
        caption.bottom,
      )
      expect(Math.round(key.left), 'legend and image share a left edge').toBe(
        Math.round(image.left),
      )
      expect(Math.round(key.right), 'legend and image share a right edge').toBe(
        Math.round(image.right),
      )
    })
  }
})
