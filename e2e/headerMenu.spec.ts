import { expect, test } from './support/test'

// The header's Resources menu (#1237): it opens by a press, never by hover, closes on Escape and
// on a press elsewhere, and its links lead to the group pages. On a phone it is an accordion in
// the mobile menu.

test.describe('on a wide screen', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('opens by a click, not by hover, and a link leads to its page', async ({ page }) => {
    await page.goto('/')
    const label = page.locator('header').getByRole('button', { name: 'Resources' })
    const link = page.getByRole('link', { name: 'Government' })

    await label.hover()
    await expect(link).toBeHidden()

    await label.click()
    await expect(link).toBeVisible()

    await link.click()
    await expect(page).toHaveURL(/\/resources\/government$/)
    await expect(link).toBeHidden()
  })

  test('closes on Escape, with focus back on the label, and on a press elsewhere', async ({
    page,
  }) => {
    await page.goto('/')
    const label = page.locator('header').getByRole('button', { name: 'Resources' })
    const link = page.getByRole('link', { name: 'Government' })

    // The panel takes focus once it is open and listening for Escape and outside presses; on a
    // slow runner the link shows before that, and an early key or press is lost (#1277)
    const panel = page.getByRole('dialog', { name: 'Resources' })

    await label.click()
    await expect(panel).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(link).toBeHidden()
    await expect(label).toBeFocused()

    await label.click()
    await expect(panel).toBeFocused()
    // The library starts listening for presses a moment after it focuses the panel, so a press can
    // land first on a slow runner: press again until it closes (a press on a closed menu does nothing)
    await expect(async () => {
      await page.mouse.click(10, 500)
      await expect(link).toBeHidden({ timeout: 1000 })
    }).toPass({ timeout: 15_000 })
  })

  test('opens with the keyboard', async ({ page }) => {
    await page.goto('/')
    const label = page.locator('header').getByRole('button', { name: 'Resources' })

    await label.focus()
    await page.keyboard.press('Enter')

    await expect(page.getByRole('link', { name: 'Safety and health' })).toBeVisible()
  })
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('is an accordion in the mobile menu, and following a link closes the menu', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Open menu' }).click()
    const dialog = page.getByRole('dialog')
    const link = dialog.getByRole('link', { name: 'Neighborhood utilities' })

    await expect(link).toBeHidden()
    await dialog.locator('summary', { hasText: 'Resources' }).click()
    await expect(link).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)

    await link.click()
    await expect(page).toHaveURL(/\/resources\/utilities$/)
    await expect(dialog).toBeHidden()
  })

  test('a tap on a submenu link leads to its page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Open menu' }).tap()
    const dialog = page.getByRole('dialog')
    await dialog.locator('summary', { hasText: 'Resources' }).tap()
    await dialog.getByRole('link', { name: 'Safety and health' }).tap()

    await expect(page).toHaveURL(/\/resources\/safety-health$/)
    await expect(dialog).toBeHidden()
  })
})
