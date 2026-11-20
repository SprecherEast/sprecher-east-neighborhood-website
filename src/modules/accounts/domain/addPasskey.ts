// What adding a passkey asks of the browser and answers it (#1314, decision 0021): the fixed
// failure codes, the options and answer shapes, and what the challenge cookie carries. The rules
// of who may add are in `passkeys.ts`. Pure: no Payload, Next.js or WebAuthn library.

import { z } from 'zod'

import { isAllowedPasskeyLabel, PASSKEY_LABEL_MAX_LENGTH } from './passkeys'

/** The cookie that ties a challenge to the browser that asked for it. `__Host-` in production. */
export const PASSKEY_CHALLENGE_COOKIE = 'sprecher-east-passkey-challenge'

/** The purpose its signing key is derived from, so it never reads as another cookie. */
export const PASSKEY_CHALLENGE_KEY_PURPOSE = 'passkey-challenge'

/**
 * Why adding a passkey didn't go ahead, as fixed codes the screen turns into fixed messages: the
 * sign-in is too old (or gone), the account has the most passkeys it may, too many requests, or
 * anything else. One `failed` for every other reason (the switch off, a bad answer, a replayed
 * challenge, a wrong origin, a passkey already stored), so no answer says which check refused.
 */
export type AddPasskeyFailure = 'sign-in-again' | 'cap' | 'too-many' | 'failed'

/**
 * The options the browser needs to make a passkey, as the library made them (the WebAuthn
 * `PublicKeyCredentialCreationOptionsJSON`), sent as JSON. The browser helper hands them on as
 * they are; the server never reads them back, only the challenge it stored.
 */
export type PasskeyCreationOptions = {
  challenge: string
  rp: { name: string; id?: string }
  user: { id: string; name: string; displayName: string }
  pubKeyCredParams: { type: string; alg: number }[]
  timeout?: number
  attestation?: string
  excludeCredentials?: { id: string; type: string; transports?: string[] }[]
  authenticatorSelection?: {
    authenticatorAttachment?: string
    residentKey?: string
    requireResidentKey?: boolean
    userVerification?: string
  }
  hints?: string[]
  extensions?: object
}

/** What asking for the options answers. */
export type StartAddPasskeyResult =
  | { ok: true; options: PasskeyCreationOptions }
  | { ok: false; failure: AddPasskeyFailure }

const text = (max: number) => z.string().min(1).max(max)

/**
 * The browser's answer to the options (`RegistrationResponseJSON`). Parsed again on the server
 * because anyone can call an action directly. Sizes are far above a real answer's, and a field a
 * browser adds later is dropped rather than refused, so a new browser can still add a passkey.
 */
export const registrationAnswerSchema = z.object({
  id: text(1024),
  rawId: text(1024),
  type: z.literal('public-key'),
  // Some browsers send null for none: read as absent
  authenticatorAttachment: z.preprocess(
    (value) => value ?? undefined,
    z.enum(['platform', 'cross-platform']).optional(),
  ),
  clientExtensionResults: z.record(z.string(), z.unknown()).default({}),
  response: z.object({
    clientDataJSON: text(4096),
    attestationObject: text(16_384),
    authenticatorData: text(16_384).optional(),
    transports: z.array(text(32)).max(10).optional(),
    publicKeyAlgorithm: z.number().int().optional(),
    publicKey: text(4096).optional(),
  }),
})

export type RegistrationAnswer = z.output<typeof registrationAnswerSchema>

/**
 * The name a neighbor may give a passkey, optional: letters, numbers and spaces and a few marks,
 * up to the label length (`isAllowedPasskeyLabel`). One rule for the card's form in the browser
 * and the action, which checks again.
 */
export const passkeyLabelField = z
  .string()
  .refine(
    isAllowedPasskeyLabel,
    `Please use only letters, numbers and spaces, up to ${PASSKEY_LABEL_MAX_LENGTH} characters.`,
  )

/** The card's form: just the name. */
export const passkeyLabelSchema = z.strictObject({ label: passkeyLabelField })

/** What the finishing action takes: the answer and the name the resident chose, if any. */
export const addPasskeySchema = z.strictObject({
  answer: registrationAnswerSchema,
  label: passkeyLabelField.optional(),
})

export type AddPasskeyInput = z.output<typeof addPasskeySchema>

/** The challenge row a signed cookie's data names, or null when it isn't a row's identifier. */
export function toChallengeId(data: Record<string, unknown> | null): number | null {
  const id = data?.cid
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : null
}
