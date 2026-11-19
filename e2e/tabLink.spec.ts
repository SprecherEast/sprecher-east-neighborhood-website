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

// The right tab shows from the server's HTML and CSS alone (#1309): a visitor on a slow first load,
// with the page's scripts not yet run, must not see the first tab where the link named another
test('a tab link shows its tab before any page script has run', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route(/\.js(\?.*)?$/, (route) => route.abort())
  await page.goto(YOUR_SHARE)

  const tab = page.getByRole('tab', { name: /Your share/ })
  const other = page.getByRole('tab').first()
  const panelOf = (id: string | null) => page.locator(`[role="tabpanel"][aria-labelledby="${id}"]`)
  await expect(panelOf(await tab.getAttribute('id'))).toBeVisible()
  await expect(page.locator('[role="tabpanel"]:visible')).toHaveCount(1)
  // The tab button wears the selected look, and the one that is first does not
  const border = (locator: typeof tab) =>
    locator.evaluate((element) => getComputedStyle(element).borderTopColor)
  expect(await border(tab)).not.toEqual(await border(other))
  await expect(tab).toBeInViewport()
})

// Once the script has taken over, the link's target no longer decides: a reader can choose any tab
test('after a tab link opened its tab, another tab can still be chosen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(YOUR_SHARE)
  const yours = page.getByRole('tab', { name: /Your share/ })
  await expect(yours).toHaveAttribute('aria-selected', 'true')
  await page.waitForFunction(() => Boolean(document.querySelector('[data-tabs-ready]')))

  const first = page.getByRole('tab').first()
  await first.click()
  await expect(first).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('[role="tabpanel"]:visible')).toHaveCount(1)
  await expect(
    page.locator(`[role="tabpanel"][aria-labelledby="${await first.getAttribute('id')}"]`),
  ).toBeVisible()
})
