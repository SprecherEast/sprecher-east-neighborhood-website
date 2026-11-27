import type { Page } from '@playwright/test'

import { connectionClientId } from './support/db'
import { CONNECT, connectionRequest, routeTheTool } from './support/connection'
import { logIn } from './support/account'
import { expect, expectAccessible, test } from './support/test'

// An AI tool such as the Claude connector asking to be let in to the AI agent address (#1501), as
// the admin goes through it on a phone and on a desktop. The tool's site is a page on another
// origin, so the first visit is a real cross-site navigation, where the browser holds back the
// sign-in cookie: the first page shows who is asking and a way on, and the approval, opened from
// our own site, is where the signed-in admin is recognised. This is the flow a unit test of the
// page could not see.

const allow = (page: Page) => page.getByRole('button', { name: 'Allow this connection' })
const startFromTheTool = async (page: Page, state: string) => {
  const url = connectionRequest(await connectionClientId(), state)
  await routeTheTool(page, url)
  await page.goto('https://claude.example/')
  await page.getByRole('link', { name: 'Connect' }).click()
}

test.describe('connecting an AI tool', () => {
  test('a signed-in admin arriving from the tool continues, allows it, and goes back with a code', async ({
    page,
  }) => {
    await logIn(page, CONNECT.adminEmail, CONNECT.password)
    await expect(page).toHaveURL(/\/account/)

    await startFromTheTool(page, 'state-allow')
    // The first page: who is asking, and no account or approval
    await expect(page.getByText(CONNECT.clientName, { exact: true })).toBeVisible()
    await expect(page.getByText('claude.example')).toBeVisible()
    await expect(allow(page)).toHaveCount(0)
    await expect(page.getByText(CONNECT.agentName)).toHaveCount(0)
    await expectAccessible(page)

    // Continuing opens the approval from our own site, where the admin is recognised
    await page.getByRole('link', { name: 'Continue to approval' }).click()
    await expect(allow(page)).toBeVisible()
    await expect(page.getByText(CONNECT.agentName)).toBeVisible()
    await expectAccessible(page)

    await allow(page).click()
    await page.waitForURL(/^https:\/\/claude\.example\/cb\?/)
    const back = new URL(page.url())
    expect(back.searchParams.get('code')).toMatch(/^sec_/)
    expect(back.searchParams.get('state')).toBe('state-allow')
    expect(back.searchParams.get('iss')).toMatch(/^http:\/\/localhost:\d+$/)
  })

  test('not allowing sends the tool back with a refusal and no code', async ({ page }) => {
    await logIn(page, CONNECT.adminEmail, CONNECT.password)
    await expect(page).toHaveURL(/\/account/)
    await startFromTheTool(page, 'state-deny')
    await page.getByRole('link', { name: 'Continue to approval' }).click()
    await page.getByRole('button', { name: 'Don’t allow' }).click()
    await page.waitForURL(/^https:\/\/claude\.example\/cb\?/)
    const back = new URL(page.url())
    expect(back.searchParams.get('error')).toBe('access_denied')
    expect(back.searchParams.get('code')).toBeNull()
    expect(back.searchParams.get('state')).toBe('state-deny')
  })

  test('a visitor who is signed out logs in and comes back to the same request', async ({
    page,
  }) => {
    await startFromTheTool(page, 'state-visitor')
    await page.getByRole('link', { name: 'Continue to approval' }).click()
    await expect(allow(page)).toHaveCount(0)
    await expect(page.getByText('Log in with an admin account')).toBeVisible()
    // The header has a plain log in link too; this one carries the pending request
    await page.locator('a[href^="/login?next="]').click()
    await expect(page).toHaveURL(/\/login\?next=/)

    const form = page.getByRole('form', { name: 'Log in' })
    await form.getByLabel('Email').fill(CONNECT.adminEmail)
    await form.getByLabel('Password').fill(CONNECT.password)
    await form.getByRole('button', { name: 'Log In', exact: true }).click()

    // Back at the same pending request, not the account page
    await expect(page).toHaveURL(/\/oauth\/approve\?/)
    expect(new URL(page.url()).searchParams.get('state')).toBe('state-visitor')
    await expect(allow(page)).toBeVisible()
  })

  test('a signed-in resident who is not an admin is told an admin is needed', async ({ page }) => {
    await logIn(page, CONNECT.guestEmail, CONNECT.password)
    await expect(page).toHaveURL(/\/account/)
    await startFromTheTool(page, 'state-guest')
    await page.getByRole('link', { name: 'Continue to approval' }).click()
    await expect(page.getByText('Only an admin can allow this')).toBeVisible()
    await expect(allow(page)).toHaveCount(0)
  })

  test('the log in page returns only to the approval, never to another address', async ({
    page,
  }) => {
    for (const next of ['https://evil.example/', '//evil.example/', '/account']) {
      await page.goto(`/login?next=${encodeURIComponent(next)}`)
      const form = page.getByRole('form', { name: 'Log in' })
      await form.getByLabel('Email').fill(CONNECT.guestEmail)
      await form.getByLabel('Password').fill(CONNECT.password)
      await form.getByRole('button', { name: 'Log In', exact: true }).click()
      await expect(page).toHaveURL(/\/account/)
      await page.context().clearCookies()
    }
  })

  test('a request the site cannot trust is explained here and nothing is sent back', async ({
    page,
  }) => {
    await page.goto(
      '/oauth/authorize?client_id=mcp_nobody&redirect_uri=https%3A%2F%2Fevil.example%2F',
    )
    await expect(page.getByRole('alert').filter({ hasText: 'not valid' })).toBeVisible()
    await expect(page).toHaveURL(/\/oauth\/authorize/)
  })
})
