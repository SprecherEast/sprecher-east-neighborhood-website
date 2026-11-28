import type { Page } from '@playwright/test'

import { connectionClientId } from './support/db'
import { CONNECT, connectionRequest, hydrated, routeTheTool } from './support/connection'
import { logIn } from './support/account'
import { expect, expectAccessible, test } from './support/test'

// An AI tool such as the Claude connector asking to be let in to the AI agent address (#1501), as
// the admin goes through it on a phone and on a desktop. The tool's site is a page on another
// origin, so the first visit is a real cross-site navigation, where the browser holds back the
// sign-in cookie: the first page shows who is asking and a way on, and the approval, opened from
// this site, is where the signed-in admin is recognised. This is the flow a unit test of the
// page could not see.

const allow = (page: Page) => page.getByRole('button', { name: 'Allow this connection' })
const startFromTheTool = async (page: Page, state: string) => {
  const url = connectionRequest(await connectionClientId(), state)
  await routeTheTool(page, url)
  await page.goto('https://claude.example/')
  const arrived = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/oauth/authorize',
  )
  await page.getByRole('link', { name: 'Connect' }).click()
  return (await arrived).headers()
}
const NO_FRAMING = "frame-ancestors 'none'"

test.describe('connecting an AI tool', () => {
  test('a signed-in admin arriving from the tool continues, allows it, and goes back with a code', async ({
    page,
  }) => {
    await logIn(page, CONNECT.adminEmail, CONNECT.password)
    await expect(page).toHaveURL(/\/account/)

    const firstPage = await startFromTheTool(page, 'state-allow')
    // Neither page can be framed: a site next to ours, such as a preview, is read as the same site
    expect(firstPage['content-security-policy']).toBe(NO_FRAMING)
    // The first page: who is asking, and no account or approval
    await expect(page.getByText(CONNECT.clientName, { exact: true })).toBeVisible()
    await expect(page.getByText('claude.example')).toBeVisible()
    await expect(allow(page)).toHaveCount(0)
    await expect(page.getByText(CONNECT.agentName)).toHaveCount(0)
    await expect(page).toHaveTitle(/Connect an AI Tool/)
    await expectAccessible(page)

    // Continuing opens the approval from this site, where the admin is recognised
    const approving = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/oauth/approve',
    )
    await page.getByRole('link', { name: 'Continue to approval' }).click()
    expect((await approving).headers()['content-security-policy']).toBe(NO_FRAMING)
    await expect(allow(page)).toBeVisible()
    await expect(page.getByText(CONNECT.agentName)).toBeVisible()
    // Continuing is a client-side navigation: the new page's title replaces the old one a moment
    // after its content, and a check in that gap would find none
    await expect(page).toHaveTitle(/Approve an AI Tool/)
    await expectAccessible(page)

    await hydrated(allow(page))
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
    await hydrated(page.getByRole('button', { name: 'Don’t allow' }))
    await page.getByRole('button', { name: 'Don’t allow' }).click()
    await page.waitForURL(/^https:\/\/claude\.example\/cb\?/)
    const back = new URL(page.url())
    expect(back.searchParams.get('error')).toBe('access_denied')
    expect(back.searchParams.get('code')).toBeNull()
    expect(back.searchParams.get('state')).toBe('state-deny')
  })

  // A tap before the page has hydrated must not be lost. Scripts are held back, so the buttons are
  // only what the server rendered: a form. The answer is the redirect back to the tool, which the
  // stand-in site can't serve to a form post, so the redirect itself is what is read.
  for (const [button, expected] of [
    ['Allow this connection', /^https:\/\/claude\.example\/cb\?code=sec_/],
    ['Don’t allow', /^https:\/\/claude\.example\/cb\?error=access_denied/],
  ] as const) {
    test(`pressing "${button}" before the page has loaded its scripts still answers the tool`, async ({
      page,
    }) => {
      await logIn(page, CONNECT.adminEmail, CONNECT.password)
      await expect(page).toHaveURL(/\/account/)
      await routeTheTool(page, connectionRequest(await connectionClientId(), 'state-early'))
      await page.goto('https://claude.example/')
      await page.route('**/_next/static/**/*.js', (route) => route.abort())
      await page.getByRole('link', { name: 'Connect' }).click()
      await page.getByRole('link', { name: 'Continue to approval' }).click()
      const posted = page.waitForResponse((response) => response.request().method() === 'POST')
      await page.getByRole('button', { name: button }).click()
      const answer = await posted
      expect(answer.status()).toBe(303)
      expect(answer.headers().location).toMatch(expected)
      expect(answer.headers().location).toContain('state=state-early')
    })
  }

  // A refused press before hydration (an altered or expired ticket, or no choice) is answered by a
  // render of the page with the refusal. It must answer at once and leave the site answering: a
  // render that never finishes once held the server at full CPU.
  const alteredTicket = async (page: Page) => {
    const bound = page.locator('input[name^="$ACTION_"][value*="ticket"]')
    await bound.evaluate((input: HTMLInputElement) => {
      input.value = input.value.replace(/"ticket":"[^"]*"/, '"ticket":"1.forged"')
    })
  }
  const noChoice = (page: Page) =>
    page.getByRole('button', { name: 'Allow this connection' }).evaluate((button) => {
      button.removeAttribute('name')
    })
  for (const [variant, spoil] of [
    ['an altered ticket', alteredTicket],
    ['no choice', noChoice],
  ] as const) {
    test(`pressing "Allow this connection" with ${variant} before the page has loaded its scripts shows the refusal and leaves the site answering`, async ({
      page,
    }) => {
      await logIn(page, CONNECT.adminEmail, CONNECT.password)
      await expect(page).toHaveURL(/\/account/)
      await routeTheTool(page, connectionRequest(await connectionClientId(), 'state-refused'))
      await page.goto('https://claude.example/')
      await page.route('**/_next/static/**/*.js', (route) => route.abort())
      await page.getByRole('link', { name: 'Connect' }).click()
      await page.getByRole('link', { name: 'Continue to approval' }).click()
      await spoil(page)
      const posted = page.waitForResponse((response) => response.request().method() === 'POST', {
        timeout: 10_000,
      })
      await page.getByRole('button', { name: 'Allow this connection' }).click()
      expect((await posted).status()).toBe(200)
      await expect(page.getByRole('alert').filter({ hasText: 'not valid' })).toBeVisible()
      // The site still answers
      expect((await page.request.get('/events', { timeout: 10_000 })).status()).toBe(200)
    })
  }

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
