import type { Page } from '@playwright/test'

import { expect } from './test'

/** The header's account links: in the bar on a desktop, in the menu on a phone (#281). */
async function accountLinks(page: Page) {
  const openMenu = page.getByRole('button', { name: 'Open menu' })
  if (await openMenu.isVisible()) {
    await openMenu.click()
    return page.getByRole('dialog')
  }
  return page.getByRole('banner')
}

/** The header offers the account's name and "Sign Out", and no "Log In". */
export async function expectHeaderSignedIn(page: Page, name: string) {
  const header = await accountLinks(page)
  await expect(header.getByRole('link', { name })).toBeVisible()
  await expect(header.getByRole('button', { name: 'Sign Out' })).toBeVisible()
  await expect(header.getByRole('link', { name: 'Log In' })).toHaveCount(0)
  return header
}

/** The header offers "Log In" and no "Sign Out". */
export async function expectHeaderSignedOut(page: Page) {
  const header = await accountLinks(page)
  await expect(header.getByRole('link', { name: 'Log In' })).toBeVisible()
  await expect(header.getByRole('button', { name: 'Sign Out' })).toHaveCount(0)
}
