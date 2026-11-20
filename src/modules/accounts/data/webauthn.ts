import 'server-only'

import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server'

import type { PasskeyCreationOptions, RegistrationAnswer } from '../domain/addPasskey'
import type { PasskeyDeviceType, RelyingParty } from '../domain/passkeys'

// The one place the WebAuthn server library is called (decision 0021). It takes and returns the
// module's plain types; the domain and the use cases never import the library. Cryptography and
// the response checks stay in the library: the signature, the challenge, the origin, the relying
// party ID and user verification. Everything about an account is ours (`use-cases/addPasskey.ts`).
// Swapping the library means rewriting this file behind its tests.

/** The name a passkey manager shows for the site. */
const RELYING_PARTY_NAME = 'Sprecher East'

/** The bytes of a user handle: `getOrCreateUserHandle` makes 32 random bytes, stored as base64url. */
const USER_HANDLE_BYTES = 32

/** A passkey the library has verified, as the store keeps it. */
export type VerifiedPasskey = {
  credentialId: string
  /** base64url text of the COSE public key */
  publicKey: string
  counter: number
  transports: string[]
  deviceType: PasskeyDeviceType
  backedUp: boolean
}

/** A passkey the account already has, so the browser doesn't offer the same device twice. */
export type ExistingCredential = { credentialId: string; transports: string[] }

/**
 * The options for adding a passkey, and the challenge the library made for them (it is random,
 * and the library makes it). Settings that matter are written out here, never left to the
 * library's defaults, which are `preferred` for both: a discoverable credential, so sign-in needs
 * no typed email, and the device's own screen lock; no attestation, since the device model isn't
 * needed and asking for more costs privacy. `userName` is the passkey's default label, never the
 * email. The stored handle is base64url text of the bytes the library must get as `userID`: handed
 * over as text, the `userHandle` a later sign-in returns would never equal it.
 */
export async function makeRegistrationOptions({
  relyingParty,
  userName,
  userHandle,
  existing,
}: {
  relyingParty: RelyingParty
  userName: string
  userHandle: string
  existing: readonly ExistingCredential[]
}): Promise<{ options: PasskeyCreationOptions; challenge: string }> {
  const userID = Buffer.from(userHandle, 'base64url')
  if (userID.length !== USER_HANDLE_BYTES) throw new Error('The stored user handle is not usable')
  const options = await generateRegistrationOptions({
    rpName: RELYING_PARTY_NAME,
    rpID: relyingParty.id,
    userName,
    userID: new Uint8Array(userID),
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    excludeCredentials: existing.map(({ credentialId, transports }) => ({
      id: credentialId,
      transports,
    })),
  })
  return { options, challenge: options.challenge }
}

/**
 * Whether the answer was made in a frame on another site: the library checks the top origin only
 * when the browser sends it, and not every browser does, so a framed answer is refused here. Any
 * `crossOrigin` but an absent or `false` one counts, and so does client data that can't be read.
 */
function isFramed(clientDataJSON: string): boolean {
  try {
    const data: unknown = JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf8'))
    if (typeof data !== 'object' || data === null) return true
    const { crossOrigin } = data as { crossOrigin?: unknown }
    return crossOrigin !== undefined && crossOrigin !== false
  } catch {
    return true
  }
}

/**
 * Checks the browser's answer against the challenge taken for it, at the one expected origin and
 * relying party ID (the configured site address, never a request's header). Gives the verified
 * passkey, or null for every other outcome: only `verified === true` counts, and every thrown
 * error is the same null, so no failure says why. The library's messages hold the challenge and
 * the origin, so none is logged or kept.
 */
export async function verifyNewPasskey({
  answer,
  challenge,
  relyingParty,
}: {
  answer: RegistrationAnswer
  challenge: string
  relyingParty: RelyingParty
}): Promise<VerifiedPasskey | null> {
  try {
    if (isFramed(answer.response.clientDataJSON)) return null
    const result = await verifyRegistrationResponse({
      response: answer,
      expectedChallenge: challenge,
      expectedOrigin: relyingParty.origin,
      expectedRPID: relyingParty.id,
      expectedType: 'webauthn.create',
      requireUserPresence: true,
      requireUserVerification: true,
    })
    if (result.verified !== true) return null
    const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo
    return {
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: credential.transports ?? answer.response.transports ?? [],
      deviceType: credentialDeviceType === 'singleDevice' ? 'singleDevice' : 'multiDevice',
      backedUp: credentialBackedUp === true,
    }
  } catch {
    return null
  }
}
