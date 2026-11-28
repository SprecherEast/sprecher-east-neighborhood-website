/** The query name a page uses to send a visitor to log in and back (`/login?next=…`). */
export const RETURN_PARAM = 'next'

/** Longer than any address we send out; more is not one of ours */
const MAX_LENGTH = 2500
/** A name no real address has: what a relative address is read against, to see where it leads */
const BASE = 'https://return.invalid'

/**
 * Where a visitor may be sent after logging in, or null. Only an address on this site whose path
 * is exactly one of `allowedPaths` (the pages that ask for the way back), with its query kept:
 * never another site, never another page, so the log in page cannot be made an open redirect. The
 * address is read the way a browser reads it and the answer is built from that reading, so the
 * tricks a browser forgives (`//host`, a backslash, a tab inside the slashes) lead off the site
 * and are refused.
 */
export function safeReturnPath(raw: unknown, allowedPaths: readonly string[]): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_LENGTH) return null
  if (!raw.startsWith('/')) return null
  let url: URL
  try {
    url = new URL(raw, BASE)
  } catch {
    return null
  }
  if (url.origin !== BASE || url.username || url.password) return null
  if (!allowedPaths.includes(url.pathname)) return null
  return `${url.pathname}${url.search}`
}
