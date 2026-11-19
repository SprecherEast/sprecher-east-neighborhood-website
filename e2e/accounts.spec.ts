import type { Page } from '@playwright/test'

import { expireResetLink } from './support/db'
import { expectHeaderSignedIn, expectHeaderSignedOut } from './support/header'
import { emailsTo, linkTo, nthEmailTo } from './support/mailbox'
import { expect, expectAccessible, newEmail, newPassword, test } from './support/test'

// The account flows (#311), as a resident goes through them on a phone and on a desktop: sign
// up, confirm by email, sign in, forget the password and reset it. Each flow also tries the
// mistakes residents make (a wrong password, a link opened twice, a mistyped field) and checks
// that they can recover.
//
// The site-wide limits count for the whole run (both projects): 20 sign-ups and 30 reset requests
// an hour (`requestLimits.ts`). These specs use 9 sign-ups and 5 reset requests per project, so 18
// and 10 a run. A new test that signs up or asks for a reset adds to that: keep under the limits.
//
// Not covered here: an expired sign-up link (Payload's verification tokens don't expire), the robot
// check (it's off, so the tests need no network), and changing a password on /account.

type Resident = { name: string; email: string; password: string }

async function signUp(page: Page, { name, email, password }: Resident) {
  await page.goto('/sign-up')
  const form = page.getByRole('form', { name: 'Create an account' })
  await form.getByLabel('Name').fill(name)
  await form.getByLabel('Email').fill(email)
  await form.getByRole('textbox', { name: 'Password (required)', exact: true }).fill(password)
  await form
    .getByRole('textbox', { name: 'Confirm password (required)', exact: true })
    .fill(password)
  await form.getByRole('button', { name: 'Create Account' }).click()
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  const form = page.getByRole('form', { name: 'Log in' })
  await form.getByLabel('Email').fill(email)
  await form.getByLabel('Password').fill(password)
  await form.getByRole('button', { name: 'Log In' }).click()
}

/** Signs up and confirms by the emailed link: a resident with a working account. */
async function newResident(page: Page) {
  const resident = { name: 'Ana Resident', email: newEmail('ana'), password: newPassword() }
  await signUp(page, resident)
  const verify = linkTo(await nthEmailTo(resident.email), '/verify-account')
  await page.goto(verify)
  await page.getByRole('button', { name: 'Confirm My Account' }).click()
  await expect(page.getByRole('status')).toContainText(/confirmed|verified/i)
  return resident
}

/** Asks for a reset link and answers the path of the link the email brings. */
async function requestReset(page: Page, email: string, nth: number) {
  await page.goto('/forgot-password')
  const form = page.getByRole('form', { name: 'Reset password' })
  await form.getByLabel('Email').fill(email)
  await form.getByRole('button', { name: 'Send Reset Link' }).click()
  await expect(page.getByRole('status')).toContainText('If that email has an account')
  return linkTo(await nthEmailTo(email, nth), '/reset-password')
}

async function chooseNewPassword(page: Page, password: string) {
  const choose = page.getByRole('form', { name: 'Choose a new password' })
  await choose.getByRole('textbox', { name: 'New password (required)', exact: true }).fill(password)
  await choose
    .getByRole('textbox', { name: 'Confirm new password (required)', exact: true })
    .fill(password)
  await choose.getByRole('button', { name: 'Set New Password' }).click()
}

test.describe('sign up, confirm and sign in', () => {
  test('a new resident signs up, confirms by email and signs in', async ({ page }) => {
    const resident = { name: 'Ben Resident', email: newEmail('ben'), password: newPassword() }

    await page.goto('/sign-up')
    await expectAccessible(page)
    await signUp(page, resident)
    await expect(page.getByRole('status')).toContainText(/check your email/i)

    // Before confirming, the account can't sign in
    await logIn(page, resident.email, resident.password)
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible()

    const email = await nthEmailTo(resident.email)
    expect(email.subject).toMatch(/confirm/i)
    await page.goto(linkTo(email, '/verify-account'))
    await expectAccessible(page)
    await page.getByRole('button', { name: 'Confirm My Account' }).click()
    await expect(page.getByRole('status')).toContainText(/confirmed|verified/i)

    await logIn(page, resident.email, resident.password)
    await expect(page).toHaveURL(/\/account/)
    await expect(page.getByText(resident.email)).toBeVisible()
  })

  test('a confirmation link opened again says the account is already confirmed', async ({
    page,
  }) => {
    const resident = await newResident(page)
    const verify = linkTo(await nthEmailTo(resident.email), '/verify-account')

    await page.goto(verify)
    // The exact text: the invalid-link message also says "already"
    await expect(page.getByText('This account is already confirmed')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirm My Account' })).toHaveCount(0)
  })

  test('signing up again sends a new link, which asks for the password and opens the account with it', async ({
    page,
  }) => {
    // #289: a resident who lost the first email signs up again. The new link asks for the
    // password, so neither earlier one opens the account
    const first = { name: 'Gil Resident', email: newEmail('gil'), password: newPassword() }
    await signUp(page, first)
    await expect(page.getByRole('status')).toContainText(/check your email/i)
    await signUp(page, { ...first, password: newPassword() })
    await expect(page.getByRole('status')).toContainText(/check your email/i)

    await page.goto(linkTo(await nthEmailTo(first.email, 2), '/verify-account'))
    await page.getByRole('button', { name: 'Confirm My Account' }).click()
    await expect(page.getByText('Choose a password to finish')).toBeVisible()
    await expectAccessible(page)
    const chosen = newPassword()
    const form = page.getByRole('form', { name: 'Choose your password' })
    await form.getByRole('textbox', { name: 'Password (required)', exact: true }).fill(chosen)
    await form
      .getByRole('textbox', { name: 'Confirm password (required)', exact: true })
      .fill(chosen)
    await form.getByRole('button', { name: 'Set Password and Confirm' }).click()
    await expect(page.getByRole('status')).toContainText('Your email is confirmed')

    await logIn(page, first.email, first.password)
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'Invalid email or password',
    )
    await logIn(page, first.email, chosen)
    await expect(page).toHaveURL(/\/account/)
  })

  test('a broken confirmation link explains itself and offers a way on', async ({ page }) => {
    await page.goto('/verify-account?token=not-a-real-token')

    await expect(page.getByRole('button', { name: 'Confirm My Account' })).toHaveCount(0)
    await expect(page.getByRole('main')).toContainText('This link isn’t valid or was already used')
    await expect(page.getByRole('main').getByRole('link', { name: 'Log In' })).toBeVisible()
    await expectAccessible(page)
  })

  test('mistakes on the sign-up form are named, and fixing them works', async ({ page }) => {
    await page.goto('/sign-up')
    const form = page.getByRole('form', { name: 'Create an account' })
    await form.getByRole('button', { name: 'Create Account' }).click()
    await expect(form.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true')

    const password = newPassword()
    await form.getByLabel('Name').fill('Cy Resident')
    await form.getByLabel('Email').fill('not-an-email')
    await form.getByRole('textbox', { name: 'Password (required)', exact: true }).fill(password)
    await form
      .getByRole('textbox', { name: 'Confirm password (required)', exact: true })
      .fill(`${password}x`)
    await form.getByRole('button', { name: 'Create Account' }).click()
    await expect(form.getByText('Enter one email address')).toBeVisible()
    await expect(form.getByText('The passwords don’t match')).toBeVisible()
    await expectAccessible(page)

    const email = newEmail('cy')
    await form.getByLabel('Email').fill(email)
    await form
      .getByRole('textbox', { name: 'Confirm password (required)', exact: true })
      .fill(password)
    await form.getByRole('button', { name: 'Create Account' }).click()
    await expect(page.getByRole('status')).toContainText(/check your email/i)
    expect((await nthEmailTo(email)).subject).toMatch(/confirm/i)
  })
})

test.describe('sign in', () => {
  test('a wrong password gets one plain message, and the right one then works', async ({
    page,
  }) => {
    const resident = await newResident(page)

    await logIn(page, resident.email, `${resident.password}-wrong`)
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'Invalid email or password',
    )
    await expectAccessible(page)

    // An unknown email gets the same message, so the form never tells who has an account
    await logIn(page, newEmail('nobody'), resident.password)
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'Invalid email or password',
    )

    await logIn(page, resident.email, resident.password)
    await expect(page).toHaveURL(/\/account/)

    // The header follows the session: after signing in, after a reload, and after signing out (#281)
    await expectHeaderSignedIn(page, resident.name)
    await page.reload()
    const header = await expectHeaderSignedIn(page, resident.name)
    await header.getByRole('button', { name: 'Sign Out' }).click()
    await expect(page).toHaveURL('/')
    await expectHeaderSignedOut(page)
  })

  test('after five wrong passwords the account is locked, and a reset gets the resident back in', async ({
    page,
  }) => {
    const resident = await newResident(page)
    for (let i = 0; i < 5; i++) {
      await logIn(page, resident.email, `${resident.password}-wrong-${i}`)
      await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
    }

    // Locked: even the right password is refused, with the same plain message
    await logIn(page, resident.email, resident.password)
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'Invalid email or password',
    )

    // Recovery: a new password from the emailed link opens the account at once
    const reset = await requestReset(page, resident.email, 2)
    await page.goto(reset)
    const newOne = newPassword()
    await chooseNewPassword(page, newOne)
    await expect(page.getByText('Your new password is set')).toBeVisible()
    await logIn(page, resident.email, newOne)
    await expect(page).toHaveURL(/\/account/)
  })
})

test.describe('forgot password and reset', () => {
  test('a resident resets a forgotten password from the emailed link; an unknown email gets the same answer and no email', async ({
    page,
  }) => {
    const resident = await newResident(page)

    // An address no account uses first: the page answers the same, and no email goes out
    const nobody = newEmail('nobody')
    await page.goto('/forgot-password')
    await expectAccessible(page)
    const form = page.getByRole('form', { name: 'Reset password' })
    await form.getByLabel('Email').fill(nobody)
    await form.getByRole('button', { name: 'Send Reset Link' }).click()
    await expect(page.getByRole('status')).toContainText('If that email has an account')

    await page.goto('/forgot-password')
    await form.getByLabel('Email').fill(resident.email)
    await form.getByRole('button', { name: 'Send Reset Link' }).click()
    await expect(page.getByRole('status')).toContainText('If that email has an account')

    // The second email to this resident: the first was the sign-up confirmation
    const reset = linkTo(await nthEmailTo(resident.email, 2), '/reset-password')
    // The unknown address was asked for first, so by the time the resident's email is here, its
    // own would have been too
    expect(emailsTo(nobody)).toHaveLength(0)
    await page.goto(reset)
    await expectAccessible(page)
    const newOne = newPassword()
    await chooseNewPassword(page, newOne)
    await expect(page.getByText('Your new password is set')).toBeVisible()

    // The old password no longer works; the new one does
    await logIn(page, resident.email, resident.password)
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'Invalid email or password',
    )
    await logIn(page, resident.email, newOne)
    await expect(page).toHaveURL(/\/account/)

    // The same link can't be used twice, and the page offers a new one
    await page.context().clearCookies()
    await page.goto(reset)
    const another = newPassword()
    await chooseNewPassword(page, another)
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'expired or was already used',
    )
    await expect(page.getByRole('link', { name: 'Get a New Link' })).toBeVisible()
    // The refused link changed nothing: the password from the first reset still works
    await logIn(page, resident.email, another)
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'Invalid email or password',
    )
    await logIn(page, resident.email, newOne)
    await expect(page).toHaveURL(/\/account/)
  })

  test('an expired reset link says so and offers a new one, which works', async ({ page }) => {
    test.setTimeout(90_000)
    const resident = await newResident(page)
    const old = await requestReset(page, resident.email, 2)
    await expireResetLink(resident.email)

    await page.goto(old)
    await chooseNewPassword(page, newPassword())
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'expired or was already used',
    )
    await expect(page.getByRole('link', { name: 'Get a New Link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
    await expectAccessible(page)

    // Payload sends one reset email per account every 15 seconds at most: wait that out
    await page.waitForTimeout(16_000)
    const fresh = await requestReset(page, resident.email, 3)
    await page.goto(fresh)
    const newOne = newPassword()
    await chooseNewPassword(page, newOne)
    await expect(page.getByText('Your new password is set')).toBeVisible()
    await logIn(page, resident.email, newOne)
    await expect(page).toHaveURL(/\/account/)
  })
})
