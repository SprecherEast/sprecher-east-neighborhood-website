import { expect, test } from './support/test'

// The resources page's groups (#1236): the headings come in the owner's order, each jump link
// brings its group's heading into view below the site header, and nothing sticks out sideways.

const GROUPS = [
  'Neighborhood utilities',
  'Government',
  'Safety and health',
  'Housing and neighborhood',
]

test('the groups come in order, each with its jump link', async ({ page }) => {
  await page.goto('/resources')

  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { level: 2 })).toHaveText(GROUPS)
  const jumps = page.getByRole('navigation', { name: 'Resource groups' }).getByRole('link')
  await expect(jumps).toHaveText(GROUPS)
})

test('a group with several categories names each one, a group with one does not repeat it', async ({
  page,
}) => {
  await page.goto('/resources')

  const housing = page.getByRole('region', { name: 'Housing and neighborhood' })
  await expect(housing.getByRole('heading', { name: 'Renting & Housing', level: 3 })).toBeVisible()
  await expect(housing.getByRole('heading', { name: 'Parks & Recreation', level: 3 })).toBeVisible()

  const safety = page.getByRole('region', { name: 'Safety and health' })
  await expect(safety.getByRole('heading', { name: 'Public Safety' })).toHaveCount(0)
  await expect(safety.getByRole('heading', { name: 'Sample safety line' })).toBeVisible()
})

for (const width of [320, 390, 768, 1280]) {
  test(`a jump link lands on its heading below the header at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/resources')

    await page
      .getByRole('navigation', { name: 'Resource groups' })
      .getByRole('link', { name: 'Safety and health' })
      .click()

    const heading = page.getByRole('heading', { name: 'Safety and health', level: 2 })
    await expect(heading).toBeInViewport()
    await expect.poll(async () => (await heading.boundingBox())?.y ?? 0).toBeGreaterThan(40)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, 'the page does not scroll sideways').toBeLessThanOrEqual(0)
  })
}
