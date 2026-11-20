// What every browser answer about a passkey carries, whether it made one (adding, `addPasskey.ts`)
// or used one (signing in, `signInWithPasskey.ts`): the credential's ID, its type, the attachment
// and the extension results. Parsed on the server because anyone can call an action directly.

import { z } from 'zod'

/** Text of one to `max` characters. */
export const text = (max: number) => z.string().min(1).max(max)

/**
 * The fields around the `response`, as WebAuthn's JSON form has them. Sizes are far above a real
 * answer's, and a field a browser adds later is dropped rather than refused, so a new browser can
 * still make and use passkeys.
 */
export const answerEnvelope = {
  id: text(1024),
  rawId: text(1024),
  type: z.literal('public-key'),
  // Some browsers send null for none: read as absent
  authenticatorAttachment: z.preprocess(
    (value) => value ?? undefined,
    z.enum(['platform', 'cross-platform']).optional(),
  ),
  clientExtensionResults: z.record(z.string(), z.unknown()).default({}),
}
