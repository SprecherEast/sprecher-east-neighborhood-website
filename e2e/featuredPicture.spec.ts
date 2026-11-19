import type { Page } from '@playwright/test'

import {
  PICTURE_CARDS_POST_SLUG,
  PICTURE_EVENT_SLUG,
  PICTURE_POST_SLUG,
} from './support/featuredPicturePages'
import { expect, test } from './support/test'

// The picture of a post or an event is the full column on a phone, about half of it on a tablet
// and about a third from the desktop breakpoint, to the right of the text with the text beside it
// (#1023). Measured in the browser, against the width of the box it floats in.
const SIZES = [
  { width: 430, share: 1, beside: false },
  { width: 768, share: 0.5, beside: true },
  { width: 1280, share: 1 / 3, beside: true },
]

const measure = (page: Page) =>
  page.evaluate(() => {
    const rect = (target: Element) => {
      const { left, right, top, bottom, width } = target.getBoundingClientRect()
      return { left, right, top, bottom, width }
    }
    const figure = document.querySelector('article figure')
    if (!figure) throw new Error('No picture on the page')
    const first = [...document.querySelectorAll('article p')].find((p) =>
      p.textContent?.startsWith('Paragraph 1.'),
    )
    if (!first) throw new Error('No text on the page')
    const lead = document.querySelectorAll('article .payload-richtext')[0]
    return {
      figure: rect(figure),
      box: rect(figure.parentElement as Element),
      // The first line of the text itself: a paragraph's box runs the full width, its lines don't
      text: (() => {
        const range = document.createRange()
        range.selectNodeContents(first)
        const line = range.getClientRects()[0] as DOMRect
        return {
          left: line.left,
          right: line.right,
          top: line.top,
          bottom: line.bottom,
          width: line.width,
        }
      })(),
      lead: lead ? rect(lead) : null,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }
  })

// An event's panels (place, registration) come before its text and sit beside the picture, so only
// a post's first text is measured beside it
for (const [name, path, textFirst] of [
  ['a post', `/posts/${PICTURE_POST_SLUG}`, true],
  ['an event', `/events/${PICTURE_EVENT_SLUG}`, false],
] as const) {
  test.describe(`the picture of ${name}`, () => {
    for (const { width, share, beside } of SIZES) {
      test(`is its share of the column at ${width}px, with the text beside it`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(path)
        const m = await measure(page)

        expect(m.overflow, `${width}px: nothing scrolls sideways`).toBeLessThanOrEqual(0)
        expect(
          m.figure.width / m.box.width,
          `${width}px: the picture is ${share.toFixed(2)} of the column`,
        ).toBeCloseTo(share, 1)
        expect(Math.round(m.figure.right), `${width}px: on the column's right edge`).toBe(
          Math.round(m.box.right),
        )
        if (beside && textFirst) {
          expect(m.text.right, `${width}px: the first text lies left of the picture`).toBeLessThan(
            m.figure.left,
          )
          expect(m.text.top, `${width}px: and starts at its top`).toBeLessThan(m.figure.bottom)
        } else if (!beside) {
          expect(m.text.top, `${width}px: the text follows the picture`).toBeGreaterThanOrEqual(
            m.figure.bottom - 1,
          )
        }
      })
    }

    test('has no Enlarge button, and a click on it opens nothing (#1055)', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto(path)

      await expect(page.getByRole('button', { name: /Enlarge/ })).toHaveCount(0)
      await page.locator('article figure img').first().click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    })
  })
}

// An article that opens with a row of cards shows them first, and the picture starts beside the
// text after them, so no blank block is left beside the cards
test.describe('the picture of a post that opens with a row of cards', () => {
  for (const { width, beside } of SIZES) {
    test(`starts after the cards at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/posts/${PICTURE_CARDS_POST_SLUG}`)
      const m = await measure(page)

      expect(m.lead, 'the opening cards are drawn before the picture').not.toBeNull()
      expect(m.figure.top, `${width}px: the picture is under the cards`).toBeGreaterThanOrEqual(
        (m.lead?.bottom ?? 0) - 1,
      )
      if (beside) {
        expect(m.text.right, `${width}px: the text lies left of the picture`).toBeLessThan(
          m.figure.left,
        )
      }
    })
  }
})
