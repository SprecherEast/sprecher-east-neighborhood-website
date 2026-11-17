import { BILL_POST_PATH as POST } from './support/billRows'
import { expect, test } from './support/test'

// A link to a tab (the Home page's "Estimate your tax split" button, #1283) opens that tab and
// brings the tabs into view, whether the visitor arrives by a fresh load or by a link on the site
// (a soft navigation, where the framework also scrolls)
const YOUR_SHARE = `${POST}#tab-your-share`

declare global {
  interface Window {
    next?: { router: { push: (href: string) => void } }
  }
}

for (const arrival of ['a fresh load', 'a link on the site'] as const) {
  test(`a tab link opens its tab and shows it, from ${arrival}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    if (arrival === 'a fresh load') await page.goto(YOUR_SHARE)
    else {
      await page.goto('/')
      await page.waitForFunction(() => Boolean(window.next?.router))
      // The button sits part way down the Home page, so the visitor has scrolled when they press it
      await page.evaluate(() => window.scrollTo(0, 300))
      await page.evaluate((href) => window.next?.router.push(href), YOUR_SHARE)
      await page.waitForURL(`**${YOUR_SHARE}`)
    }
    const tab = page.getByRole('tab', { name: /Your share/ })
    await expect(tab).toHaveAttribute('aria-selected', 'true')
    // The tabs, not the top of the page, are on screen once the page has settled
    await page.waitForTimeout(1500)
    await expect(tab).toBeInViewport()
    expect(
      await page.evaluate(() => window.scrollY),
      'the page has scrolled to the tabs',
    ).toBeGreaterThan(300)
  })
}
