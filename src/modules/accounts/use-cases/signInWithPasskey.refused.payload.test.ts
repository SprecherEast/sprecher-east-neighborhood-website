import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PasskeyRequestOptions } from '../domain/signInWithPasskey'
import {
  answerTo,
  boot,
  CHALLENGE_COOKIE,
  FAILED,
  holder,
  type Holder,
  request,
  resetRequest,
  RP_ID,
  start,
  storedPasskey,
  whoHolds as holds,
  type Site,
} from '../testing/passkeySignInHarness'
import { newSoftwareCredential } from '../testing/softwareAuthenticator'

/**
 * Signing in with a passkey end to end, every refusal (#1315, decision 0021), with real Payload on
 * in-memory SQLite and the real WebAuthn library, answered by a software authenticator
 * (`testing/passkeySignInHarness.ts`). Each one must end as the same fixed failure, with no session
 * and the passkey's counter as it was. The good paths are in `signInWithPasskey.payload.test.ts`.
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

describe('a refused sign-in', () => {
  /** Each case builds what to send; all must end the same way. */
  type Case = [string, (who: Holder, options: PasskeyRequestOptions) => Promise<unknown>]

  const cases: Case[] = [
    ['an unknown credential', async (_who, options) => answerTo(await unsaved(), options)],
    [
      'a signature made with another key',
      async (who, options) =>
        answerTo(who, options, { signWith: newSoftwareCredential().privateKey }),
    ],
    [
      'another challenge',
      async (who, options) =>
        answerTo(who, options, { challenge: Buffer.from('another').toString('base64url') }),
    ],
    [
      'a wrong origin',
      async (who, options) => answerTo(who, options, { origin: 'https://other.example' }),
    ],
    [
      'a subdomain of the site',
      async (who, options) => answerTo(who, options, { origin: `https://preview.${RP_ID}` }),
    ],
    [
      'a wrong relying party',
      async (who, options) => answerTo(who, options, { rpID: 'other.example' }),
    ],
    [
      'an answer marked cross-origin',
      async (who, options) => answerTo(who, options, { crossOrigin: true }),
    ],
    ['no screen lock', async (who, options) => answerTo(who, options, { userVerified: false })],
    [
      'a user handle that is another account’s',
      async (who, options) =>
        answerTo(who, options, { userHandle: Buffer.alloc(32, 1).toString('base64url') }),
    ],
    ['no user handle', async (who, options) => answerTo(who, options, { userHandle: undefined })],
  ]

  /** A credential no account holds. */
  const unsaved = async (): Promise<Holder> => ({
    account: site.ada,
    credential: newSoftwareCredential(),
    handle: 'unsaved',
  })

  /** The answers of every refusal: they must all be the one fixed failure. */
  const answers = new Set<string>()

  it.each(cases)('%s: the one fixed failure, no session', async (_name, make) => {
    const who = await holder(site.ada)
    const options = await start(site)
    const answer = (await make(who, options)) as ReturnType<typeof answerTo>
    const result = await site.flow.finishPasskeySignIn({ answer, rememberMe: false })
    expect(result).toEqual(FAILED)
    answers.add(JSON.stringify(result))
    expect(await whoHolds()).toBeNull()
    expect(request.jar.has('payload-token')).toBe(false)
    // The counter of a passkey that didn't sign anyone in stays as it was
    expect(await storedPasskey(site, who)).toMatchObject({ counter: 0, lastUsedAt: null })
  })

  it.each([
    [
      'locked',
      async () =>
        site.payload.db.updateOne({
          collection: 'users',
          id: site.ada.id,
          data: { lockUntil: new Date(Date.now() + 600_000).toISOString() },
          returning: false,
        }),
    ],
    [
      'unverified',
      async () =>
        site.payload.db.updateOne({
          collection: 'users',
          id: site.ada.id,
          data: { _verified: false },
          returning: false,
        }),
    ],
    [
      'an agent',
      async () =>
        site.payload.db.updateOne({
          collection: 'users',
          id: site.ada.id,
          data: { role: 'agent' },
          returning: false,
        }),
    ],
  ])('an account that is %s: the same fixed failure, no session', async (_name, change) => {
    const who = await holder(site.ada)
    try {
      await change()
      const options = await start(site)
      const result = await site.flow.finishPasskeySignIn({
        answer: answerTo(who, options),
        rememberMe: false,
      })
      expect(result).toEqual(FAILED)
      answers.add(JSON.stringify(result))
      expect(request.jar.has('payload-token')).toBe(false)
    } finally {
      await site.payload.db.updateOne({
        collection: 'users',
        id: site.ada.id,
        data: { lockUntil: null, _verified: true, role: 'guest' },
        returning: false,
      })
    }
  })

  it('a replayed answer: the challenge is used once', async () => {
    const who = await holder(site.ada)
    const options = await start(site)
    const answer = answerTo(who, options, { counter: 20 })
    const cookie = request.jar.get(CHALLENGE_COOKIE) as { value: string }
    expect(await site.flow.finishPasskeySignIn({ answer, rememberMe: false })).toEqual({ ok: true })

    request.jar.clear()
    request.jar.set(CHALLENGE_COOKIE, cookie)
    const replay = await site.flow.finishPasskeySignIn({ answer, rememberMe: false })
    expect(replay).toEqual(FAILED)
    answers.add(JSON.stringify(replay))
  })

  it('an answer from a browser that was never given the challenge', async () => {
    const who = await holder(site.ada)
    const options = await start(site)
    request.jar.clear() // another browser: it has no cookie
    const result = await site.flow.finishPasskeySignIn({
      answer: answerTo(who, options),
      rememberMe: false,
    })
    expect(result).toEqual(FAILED)
    answers.add(JSON.stringify(result))
  })

  it('an answer after the challenge expired', async () => {
    const who = await holder(site.ada)
    const options = await start(site)
    // Expire the stored challenge, keeping the browser's cookie
    await site.payload.db.updateMany({
      collection: 'passkey-challenges',
      where: { usedAt: { exists: false } },
      data: { expiresAt: new Date(Date.now() - 1000).toISOString() },
      returning: false,
    })
    const result = await site.flow.finishPasskeySignIn({
      answer: answerTo(who, options),
      rememberMe: false,
    })
    expect(result).toEqual(FAILED)
    answers.add(JSON.stringify(result))
  })

  it('a counter that did not go up, as a cloned passkey would send', async () => {
    const who = await holder(site.ada)
    let options = await start(site)
    expect(
      await site.flow.finishPasskeySignIn({
        answer: answerTo(who, options, { counter: 30 }),
        rememberMe: false,
      }),
    ).toEqual({ ok: true })
    request.jar.clear()
    options = await start(site)
    const result = await site.flow.finishPasskeySignIn({
      answer: answerTo(who, options, { counter: 30 }),
      rememberMe: false,
    })
    expect(result).toEqual(FAILED)
    answers.add(JSON.stringify(result))
    expect(request.jar.has('payload-token')).toBe(false)
  })

  it('a challenge made for adding a passkey cannot sign anyone in', async () => {
    const who = await holder(site.ada)
    const options = await start(site)
    // Swap the stored challenge's purpose, as a challenge made by the add step would be
    await site.payload.db.updateMany({
      collection: 'passkey-challenges',
      where: { usedAt: { exists: false } },
      data: { purpose: 'add' },
      returning: false,
    })
    const result = await site.flow.finishPasskeySignIn({
      answer: answerTo(who, options),
      rememberMe: false,
    })
    expect(result).toEqual(FAILED)
    answers.add(JSON.stringify(result))
  })

  it('is the same answer for every refusal above, so none says which check failed or whether an account exists', () => {
    expect([...answers]).toEqual([JSON.stringify(FAILED)])
  })

  it('refuses with the same failure when the switch is off, calling nothing', async () => {
    vi.stubEnv('PASSKEYS_ENABLED', '')
    expect(await site.flow.startPasskeySignIn(null)).toEqual(FAILED)
    expect(request.jar.size).toBe(0)
  })
})
