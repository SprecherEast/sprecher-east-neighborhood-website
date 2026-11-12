import type { Locator, Page } from '@playwright/test'

import { ALIGNMENT_POST_SLUG } from './support/alignmentSlug'
import { expect, test } from './support/test'

// Repeating things stay in line (#678): in a row of cards, the same part of every card (its
// value, its foot, its bottom edge) sits at one height, whatever wraps or is missing in one of them.
// The page holds the content most likely to break that; each width is measured as rendered.

const WIDTHS = [320, 430, 768, 1024, 1280, 1920]
const POST = `/posts/${ALIGNMENT_POST_SLUG}`

/** Where a fact's parts are marked (`FactCard`) on a key fact card */
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
    test(`key fact cards at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(POST)

      expectRowsAligned(
        await measureRows(page, KEY_FACT_LISTS, ':scope > li'),
        'key fact cards',
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

// The fact tab buttons (#1112): plain and equal, one row above the panel, each label on one line.
const TAB = '[role="tab"]'
const ACTIVE_PANEL = '[role="tabpanel"][data-state="active"]'

test.describe('fact tabs stay tidy', () => {
  for (const width of WIDTHS) {
    test(`equal buttons, one line each and a gap to the panel at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(POST)
      const list = page.locator(TAB_LISTS).first()
      await list.scrollIntoViewIfNeeded()

      const measured = await list.evaluate(
        (list, { tab, panel }) => {
          const tabs = [...list.querySelectorAll(tab)]
          const box = (e: Element) => e.getBoundingClientRect()
          const active = document.querySelector(panel)
          if (!active || tabs.length < 2) throw new Error('No fact tabs with an open panel')
          return {
            widths: new Set(tabs.map((t) => Math.round(box(t).width))).size,
            heights: new Set(tabs.map((t) => Math.round(box(t).height))).size,
            tops: new Set(tabs.map((t) => Math.round(box(t).top))).size,
            minHeight: Math.min(...tabs.map((t) => box(t).height)),
            tabGap: Math.round(box(tabs[1]).left - box(tabs[0]).right),
            panelGap: Math.round(box(active).top - box(tabs[0]).bottom),
            // The label's own lines (one line top) and its room: its left and right edges against
            // the button's, so a label spilling sideways is seen
            lines: tabs.map((t) => {
              const label = t.querySelector('[data-fact-part="label"]')
              if (!label) throw new Error('A tab has no label')
              const range = document.createRange()
              range.selectNodeContents(label)
              return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size
            }),
            room: tabs.map((t) => {
              const label = t.querySelector('[data-fact-part="label"]')
              if (!label) throw new Error('A tab has no label')
              const range = document.createRange()
              range.selectNodeContents(label)
              const text = range.getBoundingClientRect()
              const button = box(t)
              return Math.min(text.left - button.left, button.right - text.right)
            }),
            icons: list.querySelectorAll('svg').length,
          }
        },
        { tab: TAB, panel: ACTIVE_PANEL },
      )

      expect(measured.widths, 'every tab is as wide as the others').toBe(1)
      expect(measured.heights, 'every tab is as tall as the others').toBe(1)
      expect(measured.tops, 'the tabs share one row').toBe(1)
      expect(measured.minHeight, 'a tab is at least 48px tall').toBeGreaterThanOrEqual(48)
      // The space under the tabs is the space between them, not a wider, unexplained one
      expect(measured.panelGap, 'tabs to panel equals tab to tab').toBe(measured.tabGap)
      expect(measured.lines, 'every label sits on one line').toEqual(measured.lines.map(() => 1))
      // Visible room on each side of the longest labels a post holds, inside the border
      for (const room of measured.room) {
        expect(room, 'a label keeps room inside its button').toBeGreaterThanOrEqual(3)
      }
      expect(measured.icons, 'no icon on a tab').toBe(0)
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

// The page menu, the related content and the article of a post keep one left edge and a fixed
// order (#677). From `lg` the left rail holds the page menu above the related content, and the
// article sits beside it; before `lg` it is one column: page menu, article, related content.
test.describe('the left rail of a post', () => {
  for (const width of WIDTHS) {
    test(`left edge and order at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(POST)

      const m = await page.evaluate(() => {
        const element = (selector: string) => {
          const found = document.querySelector(selector)
          if (!found) throw new Error(`Nothing matches ${selector}`)
          return found
        }
        const rect = (selector: string) => {
          const { left, right, top, bottom } = element(selector).getBoundingClientRect()
          return {
            left: Math.round(left),
            right: Math.round(right),
            top: Math.round(top),
            bottom: Math.round(bottom),
          }
        }
        const layout = element('[data-detail-rail]').parentElement as HTMLElement
        return {
          crumb: rect('nav[aria-label="Breadcrumb"]'),
          menu: rect('nav[aria-label="On this page"]'),
          related: rect('[data-detail-rail] > aside'),
          text: rect('.payload-richtext'),
          // The rail is a box of its own only where the layout has two columns
          twoColumns: getComputedStyle(element('[data-detail-rail]')).display !== 'contents',
          gap: parseFloat(getComputedStyle(layout).columnGap),
          overflow: document.documentElement.scrollWidth - window.innerWidth,
        }
      })

      expect(m.overflow, `${width}px: nothing scrolls sideways`).toBeLessThanOrEqual(0)
      if (m.twoColumns) {
        expect(m.menu.left, `${width}px: the menu starts at the breadcrumb's left edge`).toBe(
          m.crumb.left,
        )
        expect(m.text.left, `${width}px: the article sits right of the rail`).toBe(
          m.related.right + Math.round(m.gap),
        )
        expect(m.related.top, `${width}px: related content is under the page menu`).toBeGreaterThan(
          m.menu.bottom,
        )
      } else {
        expect(m.text.left, `${width}px: the text starts at the breadcrumb's left edge`).toBe(
          m.crumb.left,
        )
        expect(m.menu.top, `${width}px: the page menu is above the article`).toBeLessThan(
          m.text.top,
        )
        expect(m.related.top, `${width}px: related content is below the article`).toBeGreaterThan(
          m.text.bottom,
        )
        // The bar keeps its place under the site header while the article scrolls past it
        // Instant, because the page scrolls smoothly and the read below must not race the scroll
        await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }))
        expect(
          await page.evaluate(() => window.scrollY),
          `${width}px: the page scrolled`,
        ).toBeGreaterThan(0)
        const stuck = await page
          .locator('nav[aria-label="On this page"]')
          .evaluate((nav) => Math.round(nav.getBoundingClientRect().top))
        expect(stuck, `${width}px: the page menu bar stays at the top`).toBeGreaterThanOrEqual(0)
        expect(stuck, `${width}px: the page menu bar stays at the top`).toBeLessThan(120)
      }
    })
  }
})
