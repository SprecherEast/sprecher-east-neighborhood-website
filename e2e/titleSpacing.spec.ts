import { ALIGNMENT_POST_SLUG, EDGES_EVENT_SLUG } from './support/alignmentSlug'
import { expect, test } from './support/test'

const WIDTHS = [320, 375, 768, 1024, 1280, 1920]
const PAGES = {
  post: `/posts/${ALIGNMENT_POST_SLUG}`,
  event: `/events/${EDGES_EVENT_SLUG}`,
}

// The title band and the breadcrumb row are tight (#1279): the title has the same space above it
// (under the site header) as below it, and the trail has the same small space above and below,
// while its links keep their tap size (44 px on a phone, 36 px from `lg`).
test.describe('the title and the breadcrumb row are tight and even', () => {
  for (const [name, path] of Object.entries(PAGES)) {
    for (const width of WIDTHS) {
      test(`${name} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(path)

        const m = await page.evaluate(() => {
          const rect = (e: Element) => {
            const { top, bottom, height } = e.getBoundingClientRect()
            return { top, bottom, height }
          }
          const need = (selector: string, root: ParentNode = document) => {
            const found = root.querySelector(selector)
            if (!found) throw new Error(`Nothing matches ${selector}`)
            return found
          }
          const article = need('article')
          const band = need('header > div', article)
          const title = need('h1', article).parentElement as Element
          const nav = need('nav[aria-label="Breadcrumb"]', article)
          const next = nav.closest('.container')?.nextElementSibling as Element
          return {
            siteHeader: rect(need('body header')),
            band: rect(band),
            title: rect(title),
            nav: rect(nav),
            link: rect(need('a', nav)),
            next: rect(next),
          }
        })
        const round = (n: number) => Math.round(n)

        // The band's own bottom border is one hairline pixel, so the two gaps are equal within it
        const above = m.title.top - m.siteHeader.bottom
        const below = m.band.bottom - m.title.bottom
        expect(
          Math.abs(above - below),
          `${width}px: title above ${above}, below ${below}`,
        ).toBeLessThanOrEqual(1)
        expect(
          round(above),
          `${width}px: no more than a small space above the title`,
        ).toBeLessThanOrEqual(24)

        const crumbAbove = m.nav.top - m.band.bottom
        const crumbBelow = m.next.top - m.nav.bottom
        expect(round(crumbAbove), `${width}px: the trail's space above and below`).toBe(
          round(crumbBelow),
        )
        expect(round(crumbAbove), `${width}px: the trail's space is small`).toBeLessThanOrEqual(12)

        const tap = width >= 1024 ? 36 : 44
        expect(
          round(m.link.height),
          `${width}px: the links keep their tap size`,
        ).toBeGreaterThanOrEqual(tap)
      })
    }
  }
})
