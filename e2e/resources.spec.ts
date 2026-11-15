import { expect, test } from './support/test'

// The resources group pages (#1245): one page per group, the old address redirecting to the first,
// related links to the other groups, and nothing sticking out sideways.

const GROUPS = [
  { id: 'utilities', label: 'Neighborhood utilities' },
  { id: 'government', label: 'Government' },
  { id: 'safety-health', label: 'Safety and health' },
  { id: 'housing-renting', label: 'Housing and renting' },
  { id: 'community-family', label: 'Community and family' },
]

test('the old Resources address leads to the first group', async ({ page }) => {
  await page.goto('/resources')

  await expect(page).toHaveURL(/\/resources\/utilities$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Neighborhood utilities')
})

for (const { id, label } of GROUPS) {
  test(`${label} has its own page with links to the other four groups`, async ({ page }) => {
    await page.goto(`/resources/${id}`)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label)
    const related = page.getByRole('navigation', { name: 'More resources' }).getByRole('link')
    await expect(related).toHaveText(GROUPS.filter((group) => group.id !== id).map((g) => g.label))
  })
}

test('a group with several categories names each one, a group with one does not repeat it', async ({
  page,
}) => {
  await page.goto('/resources/community-family')
  await expect(page.getByRole('heading', { name: 'Parks & Recreation', level: 2 })).toBeVisible()

  await page.goto('/resources/safety-health')
  await expect(page.getByRole('heading', { name: 'Public Safety' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Sample safety line' })).toBeVisible()
})

test('an address that is not a group is not found', async ({ page }) => {
  const response = await page.goto('/resources/everything')

  expect(response?.status()).toBe(404)
})

for (const width of [320, 390, 768, 1280]) {
  test(`a group page does not scroll sideways at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/resources/community-family')

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
}
