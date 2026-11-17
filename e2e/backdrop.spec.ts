import {
  BACKDROP_EVENT_SLUG,
  BACKDROP_POST_SLUG,
  BLACK_POST_SLUG,
  PLAIN_POST_SLUG,
  WHITE_POST_SLUG,
} from './support/backdropPages'
import { expect, test } from './support/test'

// The photo behind a whole page (#1268). Text never sits straight on the photo: it keeps AA contrast
// (4.5:1) over the two worst photos there are, solid white and solid black, in light and dark, on a
// phone and a desktop. Any photo lies between them, so what passes over both passes over every photo.
const MIN = 4.5
const THEMES = ['light', 'dark'] as const

// What is read: the element, and the text inside it whose colour is compared with what is behind it
const TEXT = {
  title: 'article h1',
  crumb: 'nav[aria-label="Breadcrumb"] li:last-child',
  body: 'article .payload-richtext p',
  heading: 'article .payload-richtext h2',
  meta: 'article dl',
  related: 'aside a',
  'card heading': 'aside [data-glass-panel] h3',
  'card text': 'aside [data-glass-panel] p',
  'card button': 'aside [data-glass-panel] a',
}

test.describe('text over a photo behind the page', () => {
  for (const photo of [WHITE_POST_SLUG, BLACK_POST_SLUG]) {
    for (const scheme of THEMES) {
      test(`passes AA over ${photo.includes('white') ? 'white' : 'black'}, ${scheme}`, async ({
        page,
      }) => {
        test.setTimeout(120_000)
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
        await page.goto(`/posts/${photo}`)
        await page.evaluate(() => document.fonts.ready)
        await expect(page.locator('html')).toHaveAttribute('data-theme', scheme)
        // No colour is mid-way between the themes when it is read
        await page.addStyleTag({ content: '*{transition:none!important}' })
        await page.evaluate(
          () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
        )
        // The photo itself, not its blurred placeholder, is what the text is read against
        await page.waitForFunction(() =>
          [...document.querySelectorAll('[data-backdrop-parallax] img')].every(
            (img) =>
              (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
          ),
        )

        const worst: Record<string, number> = {}
        for (const [name, selector] of Object.entries(TEXT)) {
          const target = page.locator(selector).first()
          if ((await target.count()) === 0) continue
          // The middle of the screen, clear of the sticky site header, and still before the picture
          await target.evaluate((e) => e.scrollIntoView({ block: 'center' }))
          await page.waitForTimeout(200)
          if (!(await target.isVisible())) continue
          const ratio = await target.evaluate(async (element) => {
            const channel = (c: number) => {
              const s = c / 255
              return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
            }
            const luminance = (r: number, g: number, b: number) =>
              0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
            const holder =
              [element, ...element.querySelectorAll('*')].find((node) =>
                [...node.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()),
              ) ?? element
            const probe = document.createElement('canvas').getContext('2d')!
            probe.fillStyle = getComputedStyle(holder).color
            probe.fillRect(0, 0, 1, 1)
            const [tr, tg, tb] = probe.getImageData(0, 0, 1, 1).data
            return { text: luminance(tr, tg, tb), box: element.getBoundingClientRect().toJSON() }
          })
          // Hide the text and read what is behind it, from a picture of the page
          const style = await page.addStyleTag({
            content:
              '*{transition:none!important;color:transparent!important;-webkit-text-fill-color:transparent!important;text-decoration-color:transparent!important;text-shadow:none!important}' +
              ' article img:not([data-backdrop-parallax] img),article svg{visibility:hidden!important}',
          })
          // The text is really clear before the picture is taken (a first style change can be slow)
          await target.evaluate(
            (e) => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
          )
          await page.waitForFunction(
            (sel) => getComputedStyle(document.querySelector(sel)!).color === 'rgba(0, 0, 0, 0)',
            selector,
          )
          const base64 = (await target.screenshot()).toString('base64')
          await style.evaluate((node) => node.remove())
          const min = await page.evaluate(
            async ({ base64, text }) => {
              const channel = (c: number) => {
                const s = c / 255
                return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
              }
              const image = new Image()
              image.src = `data:image/png;base64,${base64}`
              await image.decode()
              const canvas = document.createElement('canvas')
              canvas.width = image.width
              canvas.height = image.height
              const context = canvas.getContext('2d')!
              context.drawImage(image, 0, 0)
              const data = context.getImageData(0, 0, canvas.width, canvas.height).data
              let worstRatio = 99
              for (let i = 0; i < data.length; i += 4 * 5) {
                const l =
                  0.2126 * channel(data[i]) +
                  0.7152 * channel(data[i + 1]) +
                  0.0722 * channel(data[i + 2])
                const ratio = (Math.max(text, l) + 0.05) / (Math.min(text, l) + 0.05)
                if (ratio < worstRatio) worstRatio = ratio
              }
              return worstRatio
            },
            { base64, text: ratio.text },
          )
          worst[name] = Math.round(min * 100) / 100
        }

        console.log(`contrast ${photo} ${scheme}: ${JSON.stringify(worst)}`)
        expect(Object.keys(worst).length, 'the page has text to measure').toBeGreaterThan(4)
        for (const [name, value] of Object.entries(worst)) {
          expect(value, `${name} over ${photo}, ${scheme}: ${value}:1`).toBeGreaterThanOrEqual(MIN)
        }
      })
    }
  }
})

test.describe('the backdrop behaves', () => {
  for (const slug of [`posts/${BACKDROP_POST_SLUG}`, `events/${BACKDROP_EVENT_SLUG}`]) {
    test(`${slug}: no sideways scroll, no layout shift, a still photo for reduced motion`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(`/${slug}`)

      const photo = page.locator('[data-backdrop-parallax]')
      await expect(photo).toBeAttached()
      const before = await photo.evaluate((e) => (e as HTMLElement).style.transform)
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await page.waitForTimeout(300)
      expect(await photo.evaluate((e) => (e as HTMLElement).style.transform)).toBe(before)

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })

    test(`${slug}: the photo drifts with the scroll when motion is allowed, without moving the page`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.goto(`/${slug}`)

      const photo = page.locator('[data-backdrop-parallax]')
      const top = () => photo.evaluate((e) => (e as HTMLElement).style.transform)
      const start = await top()
      const heightBefore = await page.evaluate(() => document.documentElement.scrollHeight)
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await expect.poll(top).not.toBe(start)
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(heightBefore)
    })
  }

  test('a post with no photo has no backdrop and no glass card', async ({ page }) => {
    await page.goto(`/posts/${PLAIN_POST_SLUG}`)

    await expect(page.locator('[data-backdrop]')).toHaveCount(0)
    await expect(page.locator('[data-glass-panel]')).toHaveCount(0)
  })

  test('the Get Involved card is glass when there is a photo', async ({ page }) => {
    await page.goto(`/posts/${BACKDROP_POST_SLUG}`)

    await expect(page.locator('aside [data-glass-panel]')).toHaveCount(1)
  })
})
