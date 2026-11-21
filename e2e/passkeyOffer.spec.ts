import { logIn, newResident } from './support/account'
import { addVirtualDevice } from './support/passkeys'
import { passkeyButton, tabTo } from './support/passkeyPages'
import { expect, expectAccessible, test } from './support/test'

// The offer to add a passkey after a log in, and the note when the passkey step finds none (#1364),
// as a resident meets them on a phone and on a desktop, with Chromium's virtual authenticator for the
// device (`support/passkeys.ts`). It runs on the second server with the passkey switch on, with the
// other passkey flows (`passkeys.spec.ts`). Its one test signs up one resident per project, so 2 a run
// of the passkey server's 20 an hour site-wide (`requestLimits.ts`); a new test here adds to that.

const NO_PASSKEY_USED = 'No passkey was used. If you haven’t added one yet, log in below as usual'
const OFFER_TITLE = 'Log in faster next time'

test.describe('the passkey offer', () => {
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
})
