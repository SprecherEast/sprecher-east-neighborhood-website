import {
  browserSupportsPasskeys,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
} from '@simplewebauthn/browser'

import type { PasskeyCreationOptions } from '../domain/addPasskey'

// The one place the browser package is called from the account screen (decision 0021): swapping
// it touches this file and the server adapter only.

/**
 * Whether this browser can make a passkey with the device's screen lock or a phone nearby. False
 * when it can't tell: the card then stays hidden rather than offering what may not work.
 */
export const passkeysSupported = (): Promise<boolean> =>
  browserSupportsPasskeys().catch(() => false)

/** How making a passkey in the browser ended. `answer` goes to the server as it is. */
export type CreatePasskeyResult =
  | { ok: true; answer: unknown }
  | { ok: false; reason: 'cancelled' | 'already-here' | 'failed' }

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
