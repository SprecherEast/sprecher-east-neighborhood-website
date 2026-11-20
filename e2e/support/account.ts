import type { Page } from '@playwright/test'

import { linkTo, nthEmailTo } from './mailbox'
import { expect, newEmail, newPassword } from './test'

// The account steps the specs share (#311, #1317): sign up, confirm, log in, ask for a reset link
// and choose a new password, as a resident does them.

export type Resident = { name: string; email: string; password: string }

export async function signUp(page: Page, { name, email, password }: Resident) {
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

export async function logIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  const form = page.getByRole('form', { name: 'Log in' })
  await form.getByLabel('Email').fill(email)
  await form.getByLabel('Password').fill(password)
  await form.getByRole('button', { name: 'Log In', exact: true }).click()
}

/** Signs up and confirms by the emailed link: a resident with a working account. */
export async function newResident(page: Page) {
  const resident = { name: 'Ana Resident', email: newEmail('ana'), password: newPassword() }
  await signUp(page, resident)
  const verify = linkTo(await nthEmailTo(resident.email), '/verify-account')
  await page.goto(verify)
  await page.getByRole('button', { name: 'Confirm My Account' }).click()
  await expect(page.getByRole('status')).toContainText(/confirmed|verified/i)
  return resident
}

/** Asks for a reset link and answers the path of the link the email brings. */
export async function requestReset(page: Page, email: string, nth: number) {
  await page.goto('/forgot-password')
  const form = page.getByRole('form', { name: 'Reset password' })
  await form.getByLabel('Email').fill(email)
  await form.getByRole('button', { name: 'Send Reset Link' }).click()
  await expect(page.getByRole('status')).toContainText('If that email has an account')
  return linkTo(await nthEmailTo(email, nth), '/reset-password')
}

export async function chooseNewPassword(page: Page, password: string) {
  const choose = page.getByRole('form', { name: 'Choose a new password' })
  await choose.getByRole('textbox', { name: 'New password (required)', exact: true }).fill(password)
  await choose
    .getByRole('textbox', { name: 'Confirm new password (required)', exact: true })
    .fill(password)
  await choose.getByRole('button', { name: 'Set New Password' }).click()
}
