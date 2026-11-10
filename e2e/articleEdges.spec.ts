import { ALIGNMENT_POST_SLUG } from './support/alignmentSlug'
import { expect, test } from './support/test'

const WIDTHS = [320, 430, 768, 1024, 1280, 1920]
const POST = `/posts/${ALIGNMENT_POST_SLUG}`

// The body, the metadata bar above it and the breadcrumb's home icon share the page's edges (#774,
// #1002): the body of a post with cards runs to the right margin the breadcrumb has, the bar's
// line runs from the body's left edge to its right edge at every width, and the home icon starts
// on the left edge of the page menu.
test.describe('the body, metadata bar and breadcrumb of a post share edges', () => {
  for (const width of WIDTHS) {
    test(`edges at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(POST)

      const m = await page.evaluate(() => {
        const element = (selector: string) => {
          const found = document.querySelector(selector)
          if (!found) throw new Error(`Nothing matches ${selector}`)
          return found
        }
        const rect = (target: Element) => {
          const { left, right, top, bottom, height } = target.getBoundingClientRect()
          return { left, right, top, bottom, height }
        }
        const byline = [...document.querySelectorAll('dl')].find((dl) =>
          dl.textContent?.includes('Published'),
        )
        if (!byline) throw new Error('No metadata bar on the page')
        const bar = byline.parentElement as Element
        const homeIcon = element('nav[aria-label="Breadcrumb"] a svg')
        return {
          crumb: rect(element('nav[aria-label="Breadcrumb"]')),
          homeIcon: rect(homeIcon),
          homeLink: rect(homeIcon.closest('a') as Element),
          text: rect(element('.payload-richtext')),
          bar: rect(bar),
          metadata: rect(byline),
          bylineInHeader: byline.closest('header') !== null,
          overflow: document.documentElement.scrollWidth - window.innerWidth,
        }
      })
      // Whole pixels are what a reader sees; a fraction is only a rounding of the same edge
      const edge = (n: number) => Math.round(n)

      expect(m.overflow, `${width}px: nothing scrolls sideways`).toBeLessThanOrEqual(0)
      expect(
        edge(m.text.right),
        `${width}px: the body runs to the breadcrumb's right edge, the page margin`,
      ).toBe(edge(m.crumb.right))
      expect(edge(m.text.left), `${width}px: the body and the breadcrumb`).toBeGreaterThanOrEqual(
        edge(m.crumb.left),
      )

      expect(m.bylineInHeader, `${width}px: the bar is in the article, not the header`).toBe(false)
      expect(edge(m.bar.left), `${width}px: the bar's line starts on the body's left edge`).toBe(
        edge(m.text.left),
      )
      expect(edge(m.bar.right), `${width}px: the bar's line ends on the body's right edge`).toBe(
        edge(m.text.right),
      )
      expect(
        edge(m.metadata.right),
        `${width}px: the metadata stays inside the line, short of the right edge`,
      ).toBeLessThan(edge(m.bar.right))
      expect(m.bar.bottom, `${width}px: the bar is above the text`).toBeLessThanOrEqual(m.text.top)
      expect(
        m.text.top - m.bar.bottom,
        `${width}px: clear space under the bar, before the first line`,
      ).toBeGreaterThanOrEqual(32)

      expect(
        edge(m.homeIcon.left),
        `${width}px: the home icon starts on the breadcrumb's left edge`,
      ).toBe(edge(m.crumb.left))
      expect(
        m.homeLink.height,
        `${width}px: the home link keeps its tap height`,
      ).toBeGreaterThanOrEqual(36)
    })
  }
})
