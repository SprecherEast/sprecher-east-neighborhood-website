import { createHash } from 'node:crypto'

/**
 * The SHA-256 of a value, in hex, for one-time link tokens: a database copy or backup then holds
 * no working link. A plain hash is enough (no salt or slow hash) because the tokens are random,
 * not passwords someone chose. Server code only: kept out of `index.ts`, so client bundles never
 * pull in `node:crypto`.
 */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
