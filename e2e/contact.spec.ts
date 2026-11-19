import type { Page } from '@playwright/test'

import { expireConfirmationLink } from './support/db'
import { emailsTo, linkTo, nthEmailTo } from './support/mailbox'
import { E2E } from './support/settings.mjs'
import { expect, expectAccessible, newEmail, test } from './support/test'

// The contact flow (#311): a resident writes, confirms their email by the link, and only then
// does the message reach the neighborhood team (#287). Mistakes and old links are tried too.

/** Fills in the contact form on the page as it stands, and sends it. */
async function fillAndSend(page: Page, email: string) {
  await page.getByLabel('Full Name').fill('Dee Resident')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Subject').click()
  await page.getByRole('option', { name: 'General Question' }).click()
  await page.getByLabel('Message').fill('Is the Door Creek path open again after the storm?')
  await page.getByRole('button', { name: 'Send Message' }).click()
}

async function sendMessage(page: Page, email: string) {
  await page.goto('/contact')
  await fillAndSend(page, email)
}

test.describe('contact the neighborhood team', () => {
  test('a message reaches the team only after its sender confirms', async ({ page }) => {
    const email = newEmail('dee')
    const ownerBefore = emailsTo(E2E.ownerEmail).length

    await page.goto('/contact')
    await expectAccessible(page)
    await sendMessage(page, email)
    await expect(page.getByText(/check your email/i)).toBeVisible()
    // The short thank-you from the seeded form, not the old long one (#551)
    await expect(page.getByRole('heading', { name: 'Thanks, neighbor!' })).toBeVisible()
    await expect(page.getByText(/received/i)).toHaveCount(0)

    const confirm = await nthEmailTo(email)
    // Nothing reaches the team yet
    expect(emailsTo(E2E.ownerEmail)).toHaveLength(ownerBefore)

    await page.goto(linkTo(confirm, '/confirm-email'))
    await expectAccessible(page)
    await page.getByRole('button', { name: 'Confirm my email' }).click()
    await expect(page.getByRole('status')).toContainText('your email is confirmed')

    const toTeam = await nthEmailTo(E2E.ownerEmail, ownerBefore + 1)
    expect(`${toTeam.text} ${toTeam.html}`).toContain('Door Creek path')

    // Opened again, the link says it's done, with nothing to press
    await page.goto(linkTo(confirm, '/confirm-email'))
    await expect(page.getByText('already confirmed')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirm my email' })).toHaveCount(0)
  })

  test('an expired link says the message wasn’t passed on and how to send it again', async ({
    page,
  }) => {
    const email = newEmail('eve')
    const ownerBefore = emailsTo(E2E.ownerEmail).length

    await sendMessage(page, email)
    const confirm = await nthEmailTo(email)
    await expireConfirmationLink(email)

    // The page reads the link's state when it opens: an expired link says so at once
    await page.goto(linkTo(confirm, '/confirm-email'))
    await expect(page.getByRole('main').getByRole('alert')).toContainText('This link has expired')
    await expect(page.getByRole('button', { name: 'Confirm my email' })).toHaveCount(0)
    await expectAccessible(page)
    expect(emailsTo(E2E.ownerEmail)).toHaveLength(ownerBefore)
  })

  test('a broken link explains itself', async ({ page }) => {
    await page.goto('/confirm-email?token=not-a-real-token')

    await expect(page.getByRole('main')).toContainText(/isn’t valid/)
    await expect(page.getByRole('button', { name: 'Confirm my email' })).toHaveCount(0)
  })

  test('a mistyped or missing email is named on the form, and the fixed form sends', async ({
    page,
  }) => {
    await page.goto('/contact')
    await page.getByRole('button', { name: 'Send Message' }).click()
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('This field is required').first()).toBeVisible()

    await page.getByLabel('Email').fill('dee.example.com')
    await page.getByRole('button', { name: 'Send Message' }).click()
    await expect(page.getByText('Enter an email address, like name@example.com')).toBeVisible()
    await expectAccessible(page)

    // Fixed on the same page, without reloading: the form that showed the errors sends
    const email = newEmail('fixed')
    await fillAndSend(page, email)
    await expect(page.getByText(/check your email/i)).toBeVisible()
    expect((await nthEmailTo(email)).subject).toMatch(/confirm/i)
  })
})
