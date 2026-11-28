import {
  browserSupportsPasskeys,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser'

import type { PasskeyCreationOptions } from '../domain/addPasskey'
import type { PasskeyRequestOptions } from '../domain/signInWithPasskey'

// The one place the browser package is called from the account and log in screens (decision 0021):
// swapping it touches this file and the server adapter only.

/**
 * Whether this browser can make a passkey with the device's screen lock or a phone nearby. False
 * when it can't tell: the card then stays hidden rather than offering what may not work.
 */
export const passkeysSupported = (): Promise<boolean> =>
  browserSupportsPasskeys().catch(() => false)

/** How making a passkey in the browser ended. `answer` goes to the server as it is. */
export type CreatePasskeyResult =
  { ok: true; answer: unknown } | { ok: false; reason: 'cancelled' | 'already-here' | 'failed' }

/**
 * Shows the browser's own prompt and gives its answer. Closing the prompt, a timeout and "not
 * allowed" are `cancelled`: nothing went wrong. The device already holding a passkey for the
 * account (the server lists them as excluded) is `already-here`. Every other error is `failed`;
 * its text is never kept or shown.
 */
export async function createPasskey(options: PasskeyCreationOptions): Promise<CreatePasskeyResult> {
  try {
    // The server made these with the same library's own types, as WebAuthn's JSON form
    const answer = await startRegistration({
      optionsJSON: options as PublicKeyCredentialCreationOptionsJSON,
    })
    return { ok: true, answer }
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    const code = (error as { code?: unknown } | null)?.code
    if (code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') {
      return { ok: false, reason: 'already-here' }
    }
    if (name === 'NotAllowedError' || name === 'AbortError') {
      return { ok: false, reason: 'cancelled' }
    }
    return { ok: false, reason: 'failed' }
  }
}

/**
 * Whether the browser can offer a passkey in the email field's autofill. False when it can't
 * tell: the field then works as it always did, and the button remains.
 */
export const passkeyAutofillSupported = (): Promise<boolean> =>
  browserSupportsWebAuthnAutofill().catch(() => false)

/** How asking for a passkey in the browser ended. `answer` goes to the server as it is. */
export type GetPasskeyResult =
  { ok: true; answer: unknown } | { ok: false; reason: 'cancelled' | 'failed' }

/**
 * Shows the browser's own prompt, or with `autofill` waits in the email field's autofill list
 * until a passkey is picked, and gives its answer. The library ends an earlier request when a new
 * one starts, which is how the button replaces the autofill one. Closing the prompt, a timeout,
 * "not allowed" and a request a newer one replaced are all `cancelled`: nothing went wrong. Every
 * other error is `failed`; its text is never kept or shown.
 */
export async function getPasskey(
  options: PasskeyRequestOptions,
  { autofill = false }: { autofill?: boolean } = {},
): Promise<GetPasskeyResult> {
  try {
    // The server made these with the same library's own types, as WebAuthn's JSON form
    const answer = await startAuthentication({
      optionsJSON: options as PublicKeyCredentialRequestOptionsJSON,
      useBrowserAutofill: autofill,
    })
    return { ok: true, answer }
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    return {
      ok: false,
      reason: name === 'NotAllowedError' || name === 'AbortError' ? 'cancelled' : 'failed',
    }
  }
}
