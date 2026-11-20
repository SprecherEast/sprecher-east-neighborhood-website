import type { Locator, Page } from '@playwright/test'

import { expect } from './test'

// Steps the passkey specs share (#1317, #1364): the log in page's button, and the keyboard.

export const LOG_IN_WITH_A_PASSKEY = 'Log in with a passkey'

/** The passkey button on /login, once the page has asked the browser whether it can use one. */
export async function passkeyButton(page: Page) {
  await page.goto('/login')
  const button = page.getByRole('button', { name: LOG_IN_WITH_A_PASSKEY })
  await expect(button).toBeVisible()
  return button
}

/** Presses Tab until the element has focus, as a keyboard user does; fails if it never does. */
export async function tabTo(page: Page, target: Locator) {
  for (let presses = 0; presses < 80; presses++) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((element) => element === document.activeElement)) return
  }
  throw new Error('The keyboard never reached the element')
}
