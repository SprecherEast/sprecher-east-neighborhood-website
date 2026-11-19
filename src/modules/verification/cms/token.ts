import { randomBytes } from 'node:crypto'

import { sha256Hex } from '@/platform/lib/sha256'

/** 32 random bytes in base64url: 43 characters (`domain/tokenFormat.ts`), 256 bits nobody can guess. */
const TOKEN_BYTES = 32

/** A new confirmation token, for the link, and its hash, the only part the database keeps. */
export function newConfirmationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString('base64url')
  return { token, tokenHash: hashConfirmationToken(token) }
}

/** The SHA-256 of a token, in hex: the database keeps this, never a working link. */
export const hashConfirmationToken = sha256Hex
