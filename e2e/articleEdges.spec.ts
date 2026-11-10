import { ALIGNMENT_POST_SLUG, EDGES_EVENT_SLUG } from './support/alignmentSlug'
import { expect, test } from './support/test'

const WIDTHS = [320, 430, 768, 1024, 1280, 1920]
const POST = `/posts/${ALIGNMENT_POST_SLUG}`

// The body, the metadata bar above it and the breadcrumb's home icon share the page's edges (#774,
// #1002): the body of a post with cards runs to the right margin the breadcrumb has, the
// groove runs from the body's left edge to its right edge at every width, with the metadata
// aligned to its left end above it, and the home icon starts
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
        const bar = byline.parentElement?.parentElement as Element
        const homeIcon = element('nav[aria-label="Breadcrumb"] a svg')
        return {
          crumb: rect(element('nav[aria-label="Breadcrumb"]')),
          homeIcon: rect(homeIcon),
          homeLink: rect(homeIcon.closest('a') as Element),
          text: rect(element('.payload-richtext')),
          bar: rect(bar),
          metadata: rect(byline.querySelector('dt') as Element),
          line: rect(bar.querySelector('[aria-hidden="true"]') as Element),
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
      expect(edge(m.line.left), `${width}px: the groove starts on the body's left edge`).toBe(
        edge(m.text.left),
      )
      expect(edge(m.line.right), `${width}px: the groove ends on the body's right edge`).toBe(
        edge(m.text.right),
      )
      expect(
        edge(m.metadata.left),
        `${width}px: the metadata is left-aligned, starting on the groove's left end`,
      ).toBe(edge(m.line.left))
      expect(
        m.metadata.bottom,
        `${width}px: the metadata sits above the groove`,
      ).toBeLessThanOrEqual(m.line.top + 1)
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

// An event's metadata bar and what sits directly under it share the column's edges (#1002): the
// groove runs from the left edge to the right edge of the panel below it, the metadata is grouped
// at the left end of it, "When" stays on one line wherever the row has room for it, and a long
// place is cut to one line instead of widening the row.
test.describe('the metadata bar of an event shares the edges of what is under it', () => {
  for (const width of WIDTHS) {
    test(`edges at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/events/${EDGES_EVENT_SLUG}`)

      const m = await page.evaluate(() => {
        const rect = (target: Element) => {
          const { left, right, top, bottom, height } = target.getBoundingClientRect()
          return { left, right, top, bottom, height }
        }
        const list = [...document.querySelectorAll('article dl')].find((dl) =>
          dl.textContent?.includes('When'),
        )
        if (!list) throw new Error('No metadata bar on the page')
        const bar = list.parentElement?.parentElement as Element
        const line = bar.querySelector(':scope > [aria-hidden="true"]') as Element
        const below = bar.nextElementSibling as Element
        const when = [...list.querySelectorAll('dd')][0] as Element
        const where = list.querySelector('[title]') as HTMLElement
        return {
          line: rect(line),
          below: rect(below),
          first: rect(list.querySelector('dt') as Element),
          last: rect(list.lastElementChild as Element),
          when: rect(when),
          cut: where.scrollWidth > where.clientWidth,
          whereHeight: where.getBoundingClientRect().height,
          overflow: document.documentElement.scrollWidth - window.innerWidth,
        }
      })
      const edge = (n: number) => Math.round(n)

      expect(m.overflow, `${width}px: nothing scrolls sideways`).toBeLessThanOrEqual(0)
      expect(
        edge(m.line.left),
        `${width}px: the groove starts where the content under it does`,
      ).toBe(edge(m.below.left))
      expect(
        edge(m.line.right),
        `${width}px: the groove ends where the content under it does`,
      ).toBe(edge(m.below.right))
      expect(edge(m.first.left), `${width}px: the metadata starts on the groove's left end`).toBe(
        edge(m.line.left),
      )
      expect(m.whereHeight, `${width}px: the place is one line`).toBeLessThan(20)
      if (width >= 768) {
        expect(m.when.height, `${width}px: "When" is on one line`).toBeLessThan(20)
      }
      if (width >= 1280) {
        expect(
          m.last.right,
          `${width}px: the items sit together at the left, not spread across the row`,
        ).toBeLessThan(m.line.right - (m.line.right - m.line.left) * 0.05)
      }
    })
  }
})

// The groove's accent hairline is the theme's accent colour at full strength, in both themes (#1002):
// the pixel row under the dark hairline is sampled from a screenshot and compared with the resolved
// `--accent` token, so a blend with the dark hairline or a darker shade fails.
test.describe('the groove accent hairline is exactly the accent colour', () => {
  const ACCENTS = { light: [232, 146, 58], dark: [240, 160, 75] } // `--accent` in theme.css
  for (const theme of ['light', 'dark'] as const) {
    test(`${theme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme })
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto(POST)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)

      const probe = await page.evaluate(() => {
        const list = [...document.querySelectorAll('dl')].find((dl) =>
          dl.textContent?.includes('Published'),
        ) as Element
        const line = (list.parentElement?.parentElement as Element).querySelector(
          ':scope > [aria-hidden="true"]',
        ) as Element
        line.scrollIntoView({ block: 'center' })
        const swatch = document.createElement('span')
        swatch.style.color = 'var(--color-accent)'
        document.body.append(swatch)
        const accent = getComputedStyle(swatch).color
        swatch.remove()
        const { left, width, bottom } = line.getBoundingClientRect()
        return { accent, left, width, bottom }
      })
      const resolved = (probe.accent.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number)
      expect(resolved, `${theme}: the accent token resolves to the theme file's colour`).toEqual(
        ACCENTS[theme],
      )

      const { default: sharp } = await import('sharp')
      const shot = await page.screenshot({
        clip: {
          x: Math.floor(probe.left) + 20,
          y: Math.round(probe.bottom) - 1,
          width: 40,
          height: 3,
        },
      })
      const { data, info } = await sharp(shot)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      const rows = [0, 1, 2].map((row) =>
        Array.from(data.subarray(row * info.width * 3, row * info.width * 3 + 3)),
      )
      expect(
        rows.some((row) => row.every((value, index) => value === resolved[index])),
        `${theme}: one pixel row is exactly ${probe.accent}, found ${JSON.stringify(rows)}`,
      ).toBe(true)
    })
  }
})
