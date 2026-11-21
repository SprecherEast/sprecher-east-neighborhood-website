import { createHash, createHmac } from 'node:crypto'

import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * A production sign-in token sent to a pull request preview signs no one in (#1346, part of #1074):
 * a preview has its own `PAYLOAD_SECRET` (`ops/preview-settings.sh`), and Payload checks the token's
 * signature against it. Real Payload on in-memory SQLite, standing for the preview; the token is the
 * one the account's real sign-in gives, signed again under the secret production would use. The
 * rule that a preview never takes production's secret is tested in `ops/preview-settings.test.mjs`; this
 * file shows what the other secret does to a token. The cookie's host-only scope (no `Domain`, so a browser never sends production's cookie to a preview
 * address) is checked in `authCookies.payload.test.ts`.
 */

vi.mock('server-only', () => ({}))

const PASSWORD = 'preview-sign-in-test-password'
const PRODUCTION_SECRET = 'a-secret-production-would-use-0123456789'
let payload: Payload

const base64Url = (value: Buffer | string) => Buffer.from(value).toString('base64url')
const partOf = (token: string, index: 0 | 1) =>
  JSON.parse(Buffer.from(token.split('.')[index], 'base64url').toString()) as Record<string, unknown>
/** The real token's header and claims, signed again (HS256) under this key. */
const resignWith = (key: string, token: string) => {
  const body = `${base64Url(JSON.stringify(partOf(token, 0)))}.${base64Url(JSON.stringify(partOf(token, 1)))}`
  return `${body}.${base64Url(createHmac('sha256', key).update(body).digest())}`
}
/** The email of the account these request headers sign in, or null when they sign no one in. */
const whoIs = async (headers: Record<string, string>) => {
  const { user } = await payload.auth({ headers: new Headers(headers) })
  return user && 'email' in user ? user.email : null
}
/** A real token of the account, from its real sign-in. */
const loginToken = async () =>
  (
    await payload.login({
      collection: 'users',
      data: { email: 'ada@example.com', password: PASSWORD },
    })
  ).token ?? ''
/** The key a production server would sign with: the hash of its own secret. */
const productionKey = createHash('sha256').update(PRODUCTION_SECRET).digest('hex').slice(0, 32)
/** How the token arrives: as the sign-in header, or as the cookie a browser sends from our own pages. */
const asHeader = (token: string) => ({ authorization: `JWT ${token}` })
const asCookie = (token: string) => ({
  cookie: `${payload.config.cookiePrefix}-token=${token}`,
  'Sec-Fetch-Site': 'same-origin', // the cookie only counts from our own pages (the CSRF list)
})

beforeAll(async () => {
  vi.stubEnv('DATABASE_URI', 'file::memory:')
  vi.stubEnv('PAYLOAD_SECRET', 'the-previews-own-secret-0123456789')
  vi.stubEnv('SMTP_HOST', '')
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: await (await import('@payload-config')).default })
  // The first account on an empty database becomes an admin (#354); the test uses the second
  for (const email of ['first@example.com', 'ada@example.com']) {
    const user = await payload.create({
      collection: 'users',
      data: { email, password: PASSWORD, name: 'Ada', role: 'guest' },
      disableVerificationEmail: true,
      overrideAccess: true,
    })
    await payload.db.updateOne({
      collection: 'users',
      id: user.id,
      data: { _verified: true },
      returning: false,
    })
  }
}, 60_000)

afterAll(() => vi.unstubAllEnvs())

describe('a production sign-in token on a preview', () => {
  it.each([
    ['as the sign-in header', asHeader],
    ['as the payload-token cookie', asCookie],
  ])('signs no one in, though its header and claims are the account’s own and valid, %s', async (_how, via) => {
    const token = await loginToken()
    // the control: the same header and claims, signed under this server's own key, are accepted
    expect(await whoIs(via(resignWith(payload.secret, token)))).toBe('ada@example.com')
    // production's key is another secret's hash: the same claims are refused
    expect(await whoIs(via(resignWith(productionKey, token)))).toBeNull()
  })

  it('is never sent by a browser to a preview address: the sign-in cookie sets no Domain', () => {
    expect(payload.collections.users.config.auth.cookies.domain).toBeUndefined()
  })
})
