import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAccount } from '@/platform/payload/testing/inMemoryPayload'

import { REMEMBER_ME_LIFETIME_MS } from '../domain/sessionLifetimes'
import {
  answerTo,
  boot,
  claim,
  CHALLENGE_COOKIE,
  holder,
  request,
  resetRequest,
  RP_ID,
  start,
  storedPasskey,
  whoHolds as holds,
  type Site,
} from '../testing/passkeySignInHarness'

/**
 * Signing in with a passkey end to end, the good paths (#1315, decision 0021), with real Payload on
 * in-memory SQLite and the real WebAuthn library, answered by a software authenticator
 * (`testing/passkeySignInHarness.ts`): the options, the stored challenge, the browser's cookie,
 * the checks, the counter and the session Payload's own auth then accepts. A real device can't be
 * driven here. Only Next's request APIs are replaced. The refusals are in
 * `signInWithPasskey.refused.payload.test.ts`.
 */

vi.mock('server-only', () => ({}))
vi.mock('next/headers', async () => (await import('../testing/passkeySignInHarness')).nextHeaders)
vi.mock('next/server', async () => (await import('../testing/passkeySignInHarness')).nextServer)
vi.mock('@payloadcms/next/auth', () => ({ login: vi.fn() }))

let site: Site
const whoHolds = () => holds(site)

beforeAll(async () => {
  site = await boot()
}, 60_000)
afterAll(() => vi.unstubAllEnvs())
beforeEach(resetRequest)

describe('a good sign-in', () => {
  it('signs in the passkey’s account only, with a cookie Payload’s auth accepts, and records the use', async () => {
    const adas = await holder(site.ada)
    const bobs = await holder(site.bob)
    const options = await start(site)
    expect(options).toMatchObject({ rpId: RP_ID, userVerification: 'required' })
    expect(options.allowCredentials ?? []).toEqual([])
    expect(request.jar.get(CHALLENGE_COOKIE)).toBeTruthy()

    expect(
      await site.flow.finishPasskeySignIn({
        answer: answerTo(adas, options, { counter: 3 }),
        rememberMe: false,
      }),
    ).toEqual({ ok: true })

    expect(await whoHolds()).toMatchObject({ id: site.ada.id, collection: 'users' })
    expect(await storedPasskey(site, adas)).toMatchObject({ counter: 3 })
    expect((await storedPasskey(site, adas)).lastUsedAt).toBeTruthy()
    expect(await storedPasskey(site, bobs)).toMatchObject({ counter: 0, lastUsedAt: null })
    // The browser's challenge cookie is spent
    expect(request.jar.has(CHALLENGE_COOKIE)).toBe(false)
  })

  it('ends with sign-out, as for any other session', async () => {
    const adas = await holder(site.ada)
    const options = await start(site)
    await site.flow.finishPasskeySignIn({ answer: answerTo(adas, options), rememberMe: false })
    const token = request.jar.get('payload-token')?.value ?? ''
    expect(await whoHolds()).not.toBeNull()

    request.headers = new Headers({ authorization: `JWT ${token}` })
    const { endSession } = await import('../data/session')
    await endSession()

    expect(request.jar.has('payload-token')).toBe(false)
    const { user } = await site.payload.auth({
      headers: new Headers({ authorization: `JWT ${token}` }),
    })
    expect(user).toBeNull()
  })

  it('signs in an admin as the admin, so /admin opens for staff who sign in this way', async () => {
    const staff = await holder(await createAccount(site.payload, 'admin', 'staff'))
    const options = await start(site)
    await site.flow.finishPasskeySignIn({ answer: answerTo(staff, options), rememberMe: false })
    expect(await whoHolds()).toMatchObject({ id: staff.account.id, role: 'admin' })
  })

  it('lasts Payload’s two hours, or a week with "Keep me signed in"', async () => {
    const adas = await holder(site.ada)
    const before = Date.now()
    let options = await start(site)
    await site.flow.finishPasskeySignIn({
      answer: answerTo(adas, options, { counter: 10 }),
      rememberMe: false,
    })
    const short = request.jar.get('payload-token')?.value ?? ''
    expect(claim(short, 'exp') * 1000 - before).toBeLessThan(2 * 60 * 60 * 1000 + 5_000)

    options = await start(site)
    await site.flow.finishPasskeySignIn({
      answer: answerTo(adas, options, { counter: 11 }),
      rememberMe: true,
    })
    const long = request.jar.get('payload-token')?.value ?? ''
    expect(claim(long, 'exp') * 1000 - before).toBeGreaterThan(REMEMBER_ME_LIFETIME_MS - 5_000)
    expect(await whoHolds()).toMatchObject({ id: site.ada.id })
  })

  it('counts as a recent sign-in, since it starts a new session', async () => {
    const adas = await holder(site.ada)
    const options = await start(site)
    await site.flow.finishPasskeySignIn({ answer: answerTo(adas, options), rememberMe: false })
    request.headers = new Headers({
      authorization: `JWT ${request.jar.get('payload-token')?.value}`,
    })
    const { getSignInSession } = await import('../data/session')
    const session = await getSignInSession()
    expect(session?.accountId).toBe(site.ada.id)
    expect(Date.now() - (session?.signedInAt?.getTime() ?? 0)).toBeLessThan(60_000)
  })
})
