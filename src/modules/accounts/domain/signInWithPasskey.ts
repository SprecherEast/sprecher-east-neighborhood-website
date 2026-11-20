// What signing in with a passkey asks of the browser and answers it (#1315, decision 0021): the
// fixed failure codes, the options and answer shapes. The rules of who a passkey signs in are in
// `passkeys.ts` (`decideUsePasskey`). Pure: no Payload, Next.js or WebAuthn library.

import { z } from 'zod'

import { answerEnvelope, text } from './passkeyAnswerFields'

/**
 * Why a passkey sign-in didn't go ahead, as fixed codes the screen turns into fixed messages:
 * too many requests, or anything else. One `failed` for every other reason (the switch off, an
 * unknown credential, a bad signature, a replayed or expired challenge, a wrong origin, a framed
 * answer, a locked, unverified or agent account), so no answer says which check refused or
 * whether an account exists (decision 0021).
 */
export type PasskeySignInFailure = 'too-many' | 'failed'

/**
 * The options the browser needs to ask for a passkey, as the library made them (the WebAuthn
 * `PublicKeyCredentialRequestOptionsJSON`), sent as JSON. They name no account and list no
 * credential: the passkeys are discoverable, so the device offers its own.
 */
export type PasskeyRequestOptions = {
  challenge: string
  rpId?: string
  timeout?: number
  userVerification?: string
  allowCredentials?: { id: string; type: string; transports?: string[] }[]
  hints?: string[]
  extensions?: object
}

/** What asking for the options answers. */
export type StartPasskeySignInResult =
  | { ok: true; options: PasskeyRequestOptions }
  | { ok: false; failure: PasskeySignInFailure }

/**
 * The browser's answer to the options (`AuthenticationResponseJSON`). Parsed again on the server
 * because anyone can call an action directly. Sizes are far above a real answer's, and a field a
 * browser adds later is dropped rather than refused. `userHandle` is optional here, and refused
 * later when it doesn't match the credential's owner.
 */
export const authenticationAnswerSchema = z.object({
  ...answerEnvelope,
  response: z.object({
    clientDataJSON: text(4096),
    authenticatorData: text(16_384),
    signature: text(4096),
    userHandle: z.preprocess((value) => value ?? undefined, text(1024).optional()),
  }),
})

export type AuthenticationAnswer = z.output<typeof authenticationAnswerSchema>

/**
 * What the finishing action takes: the answer and the "Keep me signed in" box (#587), left
 * unticked when a caller leaves it out, as for a password. Strict, so no account can be named.
 */
export const passkeySignInSchema = z.strictObject({
  answer: authenticationAnswerSchema,
  rememberMe: z.boolean().default(false),
})

export type PasskeySignInValues = z.output<typeof passkeySignInSchema>
