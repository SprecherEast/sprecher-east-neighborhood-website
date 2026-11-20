import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  bootPayload,
  createAccount,
  signIn,
  type Account,
} from '@/platform/payload/testing/inMemoryPayload'

import type { PasskeyCreationOptions } from '../domain/addPasskey'
import { MAX_PASSKEYS_PER_ACCOUNT, RECENT_SIGN_IN_WINDOW_MS } from '../domain/passkeys'
import { newPasskey } from '../testing/passkeyStore'
import { softwareRegistration } from '../testing/softwareAuthenticator'
import type * as Flow from './addPasskey'

/**
 * Adding a passkey end to end (#1314, decision 0021), with real Payload on in-memory SQLite and the
 * real WebAuthn library, answered by a software authenticator: the options, the stored challenge,
 * the browser's cookie, the checks and the saved passkey. A real device can't be driven here.
 * Only Next's request APIs are replaced, and `after()` runs its work at once.
 */

vi.mock('server-only', () => ({}))
const request = vi.hoisted(() => ({
  headers: new Headers(),
  jar: new Map<string, string>(),
  after: [] as Array<() => unknown>,
}))
vi.mock('next/headers', () => ({
  headers: async () => request.headers,
  cookies: async () => ({
    get: (name: string) => (request.jar.has(name) ? { value: request.jar.get(name) } : undefined),
    set: (name: string, value: string, options: { maxAge?: number } = {}) => {
      if (options.maxAge === 0) request.jar.delete(name)
      else request.jar.set(name, value)
    },
  }),
}))
vi.mock('next/server', () => ({ after: (run: () => unknown) => request.after.push(run) }))

const ORIGIN = 'https://sprecher-east.example'
const RP_ID = 'sprecher-east.example'
const COOKIE = 'sprecher-east-passkey-challenge'

let payload: Payload
let flow: typeof Flow
let ada: Account
let bob: Account
let sendEmail: ReturnType<typeof vi.fn>

beforeAll(async () => {
  vi.stubEnv('PASSKEYS_ENABLED', 'true')
  vi.stubEnv('NEXT_PUBLIC_SERVER_URL', ORIGIN)
  payload = (await bootPayload()).payload
  flow = await import('./addPasskey')
  ada = await createAccount(payload, 'guest', 'ada')
  bob = await createAccount(payload, 'guest', 'bob')
}, 60_000)

afterAll(() => vi.unstubAllEnvs())

beforeEach(() => {
  vi.stubEnv('PASSKEYS_ENABLED', 'true')
  vi.stubEnv('NEXT_PUBLIC_SERVER_URL', ORIGIN)
  request.jar.clear()
  request.after.length = 0
  sendEmail = vi.fn().mockResolvedValue(undefined)
  payload.sendEmail = sendEmail as never
})

const signInAs = async (account: Account) => {
  request.headers = new Headers({ authorization: `JWT ${await signIn(payload, account)}` })
}

const start = async () => {
  const result = await flow.startAddPasskey(null)
  if (!result.ok) throw new Error(`start gave ${result.failure}`)
  return result.options
}

const answerTo = (options: PasskeyCreationOptions, over = {}) =>
  softwareRegistration({ options, origin: ORIGIN, rpID: RP_ID, ...over })

type StoredRow = { credentialId: string; label: string; publicKey: string; counter: number }

const passkeysOf = async (account: Account) =>
  (
    await payload.db.find<StoredRow>({
      collection: 'passkeys',
      where: { account: { equals: account.id } },
      pagination: false,
    })
  ).docs

const cookieNow = () => request.jar.get(COOKIE)

describe('a good add', () => {
  it('makes the options, then saves the passkey on the session’s account and tells its address', async () => {
    await signInAs(ada)
    const options = await start()

    expect(options).toMatchObject({
      rp: { id: RP_ID, name: 'Sprecher East' },
      attestation: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    })
    // The handle handed to the library as bytes comes back as the stored text, and is no email
    const stored = await payload.db.findOne<{ id: number; passkeyUserHandle: string }>({
      collection: 'users',
      where: { id: { equals: ada.id } },
    })
    expect(options.user.id).toBe(stored?.passkeyUserHandle)
    expect(Buffer.from(stored?.passkeyUserHandle ?? '', 'base64url')).toHaveLength(32)
    expect(options.user.name).toBe('Sprecher East passkey')
    expect(cookieNow()).toBeTruthy()

    const answer = answerTo(options)
    expect(await flow.finishAddPasskey({ answer, label: ' My phone ' })).toEqual({ ok: true })

    const saved = await passkeysOf(ada)
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ credentialId: answer.id, label: 'My phone', counter: 0 })
    expect(cookieNow()).toBeUndefined()

    await Promise.all(request.after.map((run) => run()))
    expect(sendEmail).toHaveBeenCalledOnce()
    const note = sendEmail.mock.calls[0]?.[0]
    expect(note.to).toBe('ada@example.com')
    expect(note.text).toContain('“My phone”')
    expect(note.text + note.html).not.toMatch(/https?:/)
  })
})

describe('a replay, a copy, or a wrong answer', () => {
  it('uses the challenge once: the same answer with the same cookie a second time is refused', async () => {
    await signInAs(bob)
    const options = await start()
    const cookie = cookieNow() ?? ''
    const answer = answerTo(options)
    expect(await flow.finishAddPasskey({ answer })).toEqual({ ok: true })

    request.jar.set(COOKIE, cookie)
    expect(await flow.finishAddPasskey({ answer })).toEqual({ ok: false, failure: 'failed' })
    expect(await passkeysOf(bob)).toHaveLength(1)
  })

  it('refuses another account’s challenge, even with its cookie', async () => {
    await signInAs(ada)
    const options = await start()
    const adasCookie = cookieNow() ?? ''
    const before = (await passkeysOf(bob)).length

    await signInAs(bob)
    request.jar.set(COOKIE, adasCookie)
    expect(await flow.finishAddPasskey({ answer: answerTo(options) })).toEqual({
      ok: false,
      failure: 'failed',
    })
    expect(await passkeysOf(bob)).toHaveLength(before)
  })

  it.each([
    ['another origin', { origin: 'https://evil.example' }],
    ['another relying party ID', { rpID: 'evil.example' }],
    ['a frame on another site', { crossOrigin: true }],
    ['another challenge', { challenge: Buffer.from('not-it').toString('base64url') }],
    ['no screen lock', { userVerified: false }],
  ])('refuses an answer with %s, and the challenge is used up', async (_name, over) => {
    await signInAs(ada)
    const options = await start()
    const cookie = cookieNow() ?? ''
    const count = (await passkeysOf(ada)).length
    expect(await flow.finishAddPasskey({ answer: answerTo(options, over) })).toEqual({
      ok: false,
      failure: 'failed',
    })
    // A good answer afterwards is too late: the challenge is gone
    request.jar.set(COOKIE, cookie)
    expect(await flow.finishAddPasskey({ answer: answerTo(options) })).toEqual({
      ok: false,
      failure: 'failed',
    })
    expect(await passkeysOf(ada)).toHaveLength(count)
  })

  it('refuses a credential ID that another account already holds, leaving its key as it was', async () => {
    await signInAs(ada)
    const adas = (await passkeysOf(ada))[0]
    expect(adas).toBeDefined()

    await signInAs(bob)
    const options = await start()
    const taken = Buffer.from(adas?.credentialId ?? '', 'base64url')
    const answer = answerTo(options, { credentialId: taken })
    expect(answer.id).toBe(adas?.credentialId)
    expect(await flow.finishAddPasskey({ answer })).toEqual({ ok: false, failure: 'failed' })

    const after = (await passkeysOf(ada)).find((p) => p.credentialId === adas?.credentialId)
    expect(after?.publicKey).toBe(adas?.publicKey)
    expect((await passkeysOf(bob)).some((p) => p.credentialId === adas?.credentialId)).toBe(false)
  })
})

describe('a recent sign-in', () => {
  const ageSession = async (account: Account, ms: number) => {
    const row = await payload.db.findOne<{
      id: number
      sessions: Array<{ id: string; createdAt: string }>
    }>({
      collection: 'users',
      where: { id: { equals: account.id } },
    })
    await payload.db.updateOne({
      collection: 'users',
      id: account.id,
      data: {
        sessions: (row?.sessions ?? []).map((s) => ({
          ...s,
          createdAt: new Date(Date.parse(s.createdAt) - ms).toISOString(),
        })),
      },
      returning: false,
    })
  }

  it('is needed to ask for options: an older session is sent to sign in again', async () => {
    await signInAs(ada)
    await ageSession(ada, RECENT_SIGN_IN_WINDOW_MS + 60_000)
    expect(await flow.startAddPasskey(null)).toEqual({ ok: false, failure: 'sign-in-again' })
    expect(cookieNow()).toBeUndefined()
  })

  it('is needed again when the answer comes: a challenge outliving the window adds nothing', async () => {
    await signInAs(ada)
    const options = await start()
    const count = (await passkeysOf(ada)).length
    await ageSession(ada, RECENT_SIGN_IN_WINDOW_MS + 60_000)
    expect(await flow.finishAddPasskey({ answer: answerTo(options) })).toEqual({
      ok: false,
      failure: 'sign-in-again',
    })
    expect(await passkeysOf(ada)).toHaveLength(count)
  })
})

describe('the cap', () => {
  it('refuses an account with the most passkeys, and a second add that arrives after another', async () => {
    const carl = await createAccount(payload, 'guest', 'carl')
    await signInAs(carl)
    const { savePasskey } = await import('../data/passkeys')
    for (let i = 0; i < MAX_PASSKEYS_PER_ACCOUNT - 1; i++) {
      await savePasskey(newPasskey(carl.id))
    }
    const options = await start()
    // Another add lands while this answer is on its way
    await savePasskey(newPasskey(carl.id))
    expect(await flow.finishAddPasskey({ answer: answerTo(options) })).toEqual({
      ok: false,
      failure: 'cap',
    })
    expect(await passkeysOf(carl)).toHaveLength(MAX_PASSKEYS_PER_ACCOUNT)
    expect(await flow.startAddPasskey(null)).toEqual({ ok: false, failure: 'cap' })
  })
})

describe('with the switch off', () => {
  it('refuses both steps with the one failure, and stores nothing', async () => {
    vi.stubEnv('PASSKEYS_ENABLED', '')
    await signInAs(ada)
    const challengesBefore = (await payload.db.count({ collection: 'passkey-challenges' }))
      .totalDocs
    expect(flow.arePasskeysOn()).toBe(false)
    expect(await flow.startAddPasskey(null)).toEqual({ ok: false, failure: 'failed' })
    const fake = softwareRegistration({
      options: { challenge: 'x' } as PasskeyCreationOptions,
      origin: ORIGIN,
      rpID: RP_ID,
    })
    expect(await flow.finishAddPasskey({ answer: fake })).toEqual({ ok: false, failure: 'failed' })
    expect((await payload.db.count({ collection: 'passkey-challenges' })).totalDocs).toBe(
      challengesBefore,
    )
  })
})
