import type { CDPSession, Page } from '@playwright/test'

// Chromium's virtual authenticator (#1317): a pretend device that keeps passkeys and answers the
// browser's prompt by itself, the way a phone's or laptop's screen lock does for a resident.
// Playwright has no API for it, so it is driven through the Chrome DevTools Protocol. Only
// Chromium has it; the projects in `playwright.config.ts` all run on Chromium.

/** One passkey the pretend device holds. */
export type StoredPasskey = {
  credentialId: string
  userHandle?: string
  isResidentCredential: boolean
}

/** The pretend device a test attached to a page. */
export type VirtualDevice = {
  /** The passkeys the device holds now. */
  passkeys: () => Promise<StoredPasskey[]>
}

/**
 * Attaches a pretend device to the page: a built-in authenticator that keeps passkeys on the
 * device, checks the screen lock (user verification) and answers every prompt at once, as a
 * resident who confirms with a fingerprint or a PIN. Each call is a new, empty device, so a test
 * that attaches one to a second page has a second device without the first one's passkeys.
 */
export async function addVirtualDevice(page: Page): Promise<VirtualDevice> {
  // The email field's autofill list (conditional mediation) is left out: a real browser waits there
  // for the resident to pick a passkey, but the pretend device answers at once and would sign the
  // resident in as the page opens. The tests press "Log in with a passkey" instead
  await page.addInitScript(() => {
    PublicKeyCredential.isConditionalMediationAvailable = () => Promise.resolve(false)
  })
  const session: CDPSession = await page.context().newCDPSession(page)
  await session.send('WebAuthn.enable')
  const { authenticatorId } = await session.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
  return {
    passkeys: async () => {
      const { credentials } = await session.send('WebAuthn.getCredentials', { authenticatorId })
      return credentials
    },
  }
}

/**
 * The resident closes the browser's prompt instead of confirming: from now until the page is
 * left, asking for a passkey ends the way the browser ends a dismissed prompt (`NotAllowedError`).
 * Nothing else about the page changes.
 */
export async function dismissPasskeyPrompts(page: Page) {
  await page.evaluate(() => {
    const dismissed = () =>
      Promise.reject(
        new DOMException('The operation either timed out or was not allowed.', 'NotAllowedError'),
      )
    navigator.credentials.create = dismissed
    navigator.credentials.get = dismissed
  })
}
