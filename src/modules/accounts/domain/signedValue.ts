import { createHmac, timingSafeEqual } from 'node:crypto'

// A small value the server hands the browser in a cookie and reads back unchanged (#188): JSON,
// with an expiry, signed with HMAC-SHA256. Each purpose has its own key, derived from the site's
// secret with the purpose's name, so a value signed for one purpose never reads as another, and
// never as a Payload sign-in token (which Payload signs with the secret itself).

/** The key for one purpose, derived from the site's secret. */
export function purposeKey(secret: string, purpose: string): Buffer {
  return createHmac('sha256', secret).update(`sprecher-east:${purpose}`).digest()
}

const sign = (body: string, key: Buffer) => createHmac('sha256', key).update(body).digest()

/** `data` with an expiry `ttlMs` from `now`, signed: `<base64url JSON>.<base64url HMAC>`. */
export function signValue(data: object, key: Buffer, now: Date, ttlMs: number): string {
  const body = Buffer.from(JSON.stringify({ ...data, exp: now.getTime() + ttlMs })).toString(
    'base64url',
  )
  return `${body}.${sign(body, key).toString('base64url')}`
}

/**
 * The data in a value `signValue` made with this key, or null when it's missing, altered, not
 * JSON, or past its expiry. The answer is only what was signed; checking its shape is the
 * caller's.
 */
export function readSignedValue(
  value: string | null | undefined,
  key: Buffer,
  now: Date,
): Record<string, unknown> | null {
  if (!value) return null
  const [body, mac, ...rest] = value.split('.')
  if (!body || !mac || rest.length > 0) return null
  const expected = sign(body, key)
  const given = Buffer.from(mac, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const data: unknown = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
    const record = data as Record<string, unknown>
    return typeof record.exp === 'number' && record.exp > now.getTime() ? record : null
  } catch {
    return null
  }
}
