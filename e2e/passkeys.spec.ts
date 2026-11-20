import type { Browser, Locator, Page } from '@playwright/test'

import {
  chooseNewPassword,
  logIn,
  newResident,
  requestReset,
  type Resident,
} from './support/account'
import { expectHeaderSignedIn } from './support/header'
import { emailsTo } from './support/mailbox'
import { addVirtualDevice, dismissPasskeyPrompts } from './support/passkeys'
import { expect, expectAccessible, newPassword, test } from './support/test'

// The passkey flows (#1317), as a resident goes through them on a phone and on a desktop, with
// Chromium's virtual authenticator standing in for the device's screen lock. They run against the
// second server (`node e2e/serve.mjs passkeys`: `next dev` with the passkey switch on), because the
// production build on http://localhost can't have the switch on (decision 0021).
//
// Each test signs up its own resident: 7 sign-ups and 1 reset request per project, 14 and 2 a run,
// beside the 4 sign-ups the accounts flows use on the same server. Its site-wide limit is 20 sign-ups
// an hour (`requestLimits.ts`): a new test here that signs up needs room under it.

const LOG_IN_WITH_A_PASSKEY = 'Log in with a passkey'
const NO_PASSKEY_USED = 'No passkey was used. If you haven’t added one yet, log in below as usual'
const OFFER_TITLE = 'Log in faster next time'
const COULDNT_LOG_IN = 'We couldn’t log you in with that passkey'
const TWO_HOURS_S = 2 * 60 * 60
const A_WEEK_S = 7 * 24 * 60 * 60

/** How long the browser's session cookie has left, in seconds, or null when it holds none. */
async function sessionSecondsLeft(page: Page): Promise<number | null> {
  const cookie = (await page.context().cookies()).find(({ name }) => /payload-token/.test(name))
  return cookie ? cookie.expires - Date.now() / 1000 : null
}

/** The sign-in lasts about as long as asked: two hours, or a week with "Keep me signed in". */
async function expectSessionOf(page: Page, lasts: number) {
  const left = await sessionSecondsLeft(page)
  expect(left).toBeGreaterThan(lasts - 600)
  expect(left).toBeLessThanOrEqual(lasts + 60)
}

async function signOut(page: Page, resident: Resident) {
  const header = await expectHeaderSignedIn(page, resident.name)
  await header.getByRole('button', { name: 'Sign Out' }).click()
  await expect(page).toHaveURL('/')
}

/** The passkey button on /login, once the page has asked the browser whether it can use one. */
async function passkeyButton(page: Page) {
  await page.goto('/login')
  const button = page.getByRole('button', { name: LOG_IN_WITH_A_PASSKEY })
  await expect(button).toBeVisible()
  return button
}

/** Adds a passkey from /account, signed in, and waits for the page to list it. */
async function addPasskey(page: Page, name: string) {
  await page.goto('/account')
  const form = page.getByRole('form', { name: 'Add a passkey' })
  await form.getByLabel('Passkey name').fill(name)
  await form.getByRole('button', { name: 'Add a passkey' }).click()
  await expect(page.getByText('Passkey added.')).toBeVisible()
  await expect(page.getByRole('button', { name: `Remove passkey: ${name}` })).toBeVisible()
}

/** A resident who has signed in with a password, on a device that holds no passkey yet. */
async function signedInResident(page: Page) {
  const device = await addVirtualDevice(page)
  const resident = await newResident(page)
  await logIn(page, resident.email, resident.password)
  await expect(page).toHaveURL(/\/account/)
  return { device, resident }
}

/** A resident who has added a passkey on this device and signed out. */
async function residentWithPasskey(page: Page, name: string) {
  const { device, resident } = await signedInResident(page)
  await addPasskey(page, name)
  await signOut(page, resident)
  return { device, resident }
}

/** Removes a passkey on /account: the button, then the dialog's own confirmation. */
async function removePasskey(page: Page, name: string) {
  await page.getByRole('button', { name: `Remove passkey: ${name}` }).click()
  const dialog = page.getByRole('dialog', { name: 'Remove this passkey?' })
  await dialog.getByRole('button', { name: 'Remove passkey', exact: true }).click()
  await expect(page.getByText('Passkey removed.')).toBeVisible()
  await expect(page.getByText('No passkeys yet.')).toBeVisible()
}

/** Presses Tab until the element has focus, as a keyboard user does; fails if it never does. */
async function tabTo(page: Page, target: Locator) {
  for (let presses = 0; presses < 80; presses++) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((element) => element === document.activeElement)) return
  }
  throw new Error('The keyboard never reached the element')
}

/** A second browser, with nothing from the first: no sign-in, and its own device without passkeys. */
async function anotherDevice(browser: Browser, page: Page) {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: page.viewportSize(),
    extraHTTPHeaders: { 'x-forwarded-for': '10.250.0.1' },
  })
  const other = await context.newPage()
  return { other, device: await addVirtualDevice(other), close: () => context.close() }
}

test.describe('passkeys', () => {
  test('a resident adds a passkey, signs out and back in with it, and keep me signed in works as with a password', async ({
    page,
  }) => {
    const { device, resident } = await signedInResident(page)
    // A password sign-in without the box lasts two hours: the passkey's has to match
    await expectSessionOf(page, TWO_HOURS_S)

    await page.goto('/account')
    await expect(page.getByText('No passkeys yet.')).toBeVisible()
    const form = page.getByRole('form', { name: 'Add a passkey' })
    await form.getByLabel('Passkey name').fill('Ana’s phone')
    await form.getByRole('button', { name: 'Add a passkey' }).click()
    await expect(
      page.getByText('Passkey added. Next time, choose Log in with a passkey.'),
    ).toBeVisible()
    const passkeys = page.getByRole('region', { name: 'Passkeys' })
    await expect(passkeys.getByText('Ana’s phone')).toBeVisible()
    await expect(passkeys.getByText('Not used yet')).toBeVisible()
    expect(await device.passkeys()).toHaveLength(1)

    await signOut(page, resident)
    await expect.poll(() => sessionSecondsLeft(page)).toBeNull()

    // Without the box: the account opens, and the session is the short one
    await (await passkeyButton(page)).click()
    await expect(page).toHaveURL(/\/account/)
    await expect(page.getByText(resident.email)).toBeVisible()
    await expectSessionOf(page, TWO_HOURS_S)
    await expect(passkeys.getByText('Not used yet')).toHaveCount(0)
    await signOut(page, resident)

    // With the box ticked: the same sign-in lasts a week
    const button = await passkeyButton(page)
    await page.getByRole('checkbox', { name: /Keep me signed in/ }).check()
    await button.click()
    await expect(page).toHaveURL(/\/account/)
    await expectHeaderSignedIn(page, resident.name)
    await expectSessionOf(page, A_WEEK_S)
  })

  test('closing the browser prompt breaks nothing, and the password still works', async ({
    page,
  }) => {
    const { device, resident } = await signedInResident(page)

    // Adding: the resident closes the prompt
    await page.goto('/account')
    const form = page.getByRole('form', { name: 'Add a passkey' })
    await expect(form).toBeVisible()
    await dismissPasskeyPrompts(page)
    await form.getByRole('button', { name: 'Add a passkey' }).click()
    await expect(page.getByText('No passkey was added. You can try again any time.')).toBeVisible()
    await expect(page.getByText('No passkeys yet.')).toBeVisible()
    expect(await device.passkeys()).toHaveLength(0)
    // Trying again, with the prompt answered this time, works
    await addPasskey(page, 'Second try')
    await signOut(page, resident)

    // Signing in: the resident closes the prompt; no error, one plain note with the way forward
    // (#1364), and the form is as it was
    const button = await passkeyButton(page)
    await dismissPasskeyPrompts(page)
    await button.click()
    await expect(button).toBeEnabled()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('main').getByRole('status')).toContainText(NO_PASSKEY_USED)

    // Email and password still work
    await logIn(page, resident.email, resident.password)
    await expect(page).toHaveURL(/\/account/)
    await expectHeaderSignedIn(page, resident.name)
  })

  test('after a log in, the offer sets up a passkey, “Not now” is remembered, and nothing is offered once one exists', async ({
    page,
  }) => {
    // A device with no passkey: pressing the button finds none, and the page says what to do (#1364)
    const device = await addVirtualDevice(page)
    await (await passkeyButton(page)).click()
    await expect(page.getByRole('main').getByRole('status')).toContainText(NO_PASSKEY_USED)
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
    await expectAccessible(page)

    // Logging in with the password lands on /account with the offer on top
    const resident = await newResident(page)
    await logIn(page, resident.email, resident.password)
    await expect(page).toHaveURL(/\/account/)
    const offer = page.getByRole('region', { name: OFFER_TITLE })
    await expect(offer).toBeVisible()
    await expectAccessible(page)

    // "Not now" hides it, and it stays hidden on the next visit
    await tabTo(page, offer.getByRole('button', { name: 'Set up a passkey' }))
    await page.keyboard.press('Tab')
    await expect(offer.getByRole('button', { name: 'Not now' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(offer).toHaveCount(0)
    await expect(page.getByText('No problem. You can add a passkey any time')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('form', { name: 'Add a passkey' })).toBeVisible()
    await expect(offer).toHaveCount(0)

    // Once the time is up, it is offered again; accepting adds the passkey, with the browser's prompt
    await page.evaluate(() => localStorage.removeItem('passkey-offer-snoozed-until'))
    await page.reload()
    await expect(offer).toBeVisible()
    await offer.getByRole('button', { name: 'Set up a passkey' }).click()
    await expect(
      page.getByText('Passkey added. Next time, choose Log in with a passkey.'),
    ).toBeVisible()
    expect(await device.passkeys()).toHaveLength(1)
    await expect(
      page.getByRole('region', { name: 'Passkeys' }).getByText('Not used yet'),
    ).toBeVisible()

    // With a passkey, no offer on the next visit
    await page.reload()
    await expect(page.getByRole('form', { name: 'Add a passkey' })).toBeVisible()
    await expect(page.getByText(OFFER_TITLE)).toHaveCount(0)
  })

  test('a removed passkey no longer signs in', async ({ page }) => {
    const { device, resident } = await signedInResident(page)
    await addPasskey(page, 'Old phone')

    await removePasskey(page, 'Old phone')
    // The device still holds its copy: only the site forgot it
    expect(await device.passkeys()).toHaveLength(1)
    await signOut(page, resident)

    await (await passkeyButton(page)).click()
    await expect(page.getByRole('main').getByRole('alert')).toContainText(COULDNT_LOG_IN)
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('button', { name: 'Log In', exact: true })).toBeVisible()

    // The password was never in question
    await logIn(page, resident.email, resident.password)
    await expect(page).toHaveURL(/\/account/)
  })

  test('after losing the device, forgot password gets the resident back in, and the lost passkey can go', async ({
    page,
    browser,
  }) => {
    const { resident } = await residentWithPasskey(page, 'Lost phone')

    // A new device holds no passkey, and the lost one's still signed in nowhere
    const { other, device, close } = await anotherDevice(browser, page)
    const resetLink = await requestReset(other, resident.email, emailsTo(resident.email).length + 1)
    await other.goto(resetLink)
    const chosen = newPassword()
    await chooseNewPassword(other, chosen)
    await expect(other.getByText('Your new password is set')).toBeVisible()
    await logIn(other, resident.email, chosen)
    await expect(other).toHaveURL(/\/account/)

    // The lost phone's passkey is listed with the way to remove it, and the new device has none
    expect(await device.passkeys()).toHaveLength(0)
    await expect(other.getByText('Lost a device?')).toBeVisible()
    await removePasskey(other, 'Lost phone')
    await close()
  })

  test('a locked account is refused its passkey as it is its password', async ({ page }) => {
    const { device, resident } = await residentWithPasskey(page, 'Ana’s laptop')

    for (let i = 0; i < 5; i++) {
      await logIn(page, resident.email, `${resident.password}-wrong-${i}`)
      await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
    }

    await (await passkeyButton(page)).click()
    await expect(page.getByRole('main').getByRole('alert')).toContainText(COULDNT_LOG_IN)
    await expect(page).toHaveURL(/\/login/)
    // The refusal gives nothing away: no word about a lock, and the account stays closed
    await expect(page.getByRole('main')).not.toContainText(/locked/i)
    await expect(page.getByRole('link', { name: resident.name })).toHaveCount(0)
    // The passkey is still on the device; the site is what said no
    expect(await device.passkeys()).toHaveLength(1)
  })
})

test.describe('passkey screens: keyboard and accessibility', () => {
  test('/login and /account work by keyboard alone, with names a screen reader reads and no axe violations', async ({
    page,
  }) => {
    const { resident } = await signedInResident(page)
    await signOut(page, resident)

    // /login: the passkey button is named for what it does, and axe finds nothing
    await passkeyButton(page)
    await expectAccessible(page)

    // Log in by keyboard: email, password, then Enter on the form
    await tabTo(page, page.getByLabel('Email'))
    await page.keyboard.type(resident.email)
    await tabTo(page, page.getByLabel('Password'))
    await page.keyboard.type(resident.password)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/account/)

    // /account: the card is a named region; add a passkey by keyboard
    const passkeys = page.getByRole('region', { name: 'Passkeys' })
    await expect(passkeys).toBeVisible()
    await expect(page.getByText('No passkeys yet.')).toBeVisible()
    await expectAccessible(page)
    await tabTo(page, page.getByLabel('Passkey name'))
    await page.keyboard.type('Keyboard key')
    await tabTo(page, page.getByRole('button', { name: 'Add a passkey' }))
    await page.keyboard.press('Enter')
    const remove = page.getByRole('button', { name: 'Remove passkey: Keyboard key' })
    await expect(remove).toBeVisible()
    await expectAccessible(page)

    // Removing asks first, in a dialog that takes focus and gives it back
    await tabTo(page, remove)
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Remove this passkey?' })
    await expect(dialog).toBeVisible()
    await expect(dialog.locator(':focus')).toHaveCount(1)
    await expectAccessible(page)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(remove).toBeFocused()

    // Signed out again, the passkey button is reached and pressed by keyboard
    await signOut(page, resident)
    await passkeyButton(page)
    await tabTo(page, page.getByRole('button', { name: LOG_IN_WITH_A_PASSKEY }))
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/account/)
  })
})
