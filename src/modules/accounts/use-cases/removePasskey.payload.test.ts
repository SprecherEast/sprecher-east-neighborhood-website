import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  bootPayload,
  createAccount,
  signIn,
  testPassword,
  type Account,
} from '@/platform/payload/testing/inMemoryPayload'

import { RECENT_SIGN_IN_WINDOW_MS } from '../domain/signInSession'
import { newPasskey } from '../testing/passkeyStore'
import type * as Flow from './removePasskey'
import type * as Store from '../data/passkeys'

/**
 * Seeing and removing passkeys end to end (#1316, decision 0021), with real Payload on in-memory
 * SQLite: the real session, the real data layer and the real delete. Only Next's request APIs are
 * replaced.
 */
vi.mock('server-only', () => ({}))
const request = vi.hoisted(() => ({
  headers: new Headers(),
  after: [] as Array<() => unknown>,
}))
vi.mock('next/headers', () => ({
  headers: async () => request.headers,
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
}))
vi.mock('next/server', () => ({ after: (run: () => unknown) => request.after.push(run) }))

let payload: Payload
let flow: typeof Flow
let store: typeof Store
let ada: Account
let bob: Account
let sendEmail: ReturnType<typeof vi.fn>

beforeAll(async () => {
  payload = (await bootPayload()).payload
  flow = await import('./removePasskey')
  store = await import('../data/passkeys')
  ada = await createAccount(payload, 'guest', 'ada')
  bob = await createAccount(payload, 'guest', 'bob')
}, 60_000)

afterAll(() => vi.unstubAllEnvs())

beforeEach(async () => {
  request.after.length = 0
  sendEmail = vi.fn().mockResolvedValue(undefined)
  payload.sendEmail = sendEmail as never
  await payload.db.deleteMany({ collection: 'passkeys', where: { id: { exists: true } } })
})

const signInAs = async (account: Account) => {
  request.headers = new Headers({ authorization: `JWT ${await signIn(payload, account)}` })
}

const save = async (account: Account, label = 'My phone') => {
  const saved = await store.savePasskey(newPasskey(account.id, { label }))
  if (!saved.saved) throw new Error('not saved')
  return saved.id
}

const countOf = (account: Account) => store.countPasskeys(account.id)

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

describe('listing', () => {
  it('lists the account’s own passkeys as plain items, and no one else’s', async () => {
    await save(ada, 'Phone')
    await save(bob, 'Bob’s key')
    const items = await flow.getOwnPasskeys(ada.id)
    expect(items.map((item) => item.label)).toEqual(['Phone'])
    expect(Object.keys(items[0] ?? {}).sort()).toEqual(['addedAt', 'id', 'label', 'lastUsedAt'])
  })
})

describe('removing your own passkey', () => {
  it('removes it, then sends the note with its name after the response', async () => {
    const id = await save(ada, 'Phone')
    const keep = await save(ada, 'Laptop')
    await signInAs(ada)
    expect(await flow.removePasskey({ passkeyId: id })).toEqual({ ok: true })
    expect(await store.findPasskeyById(id)).toBeNull()
    expect(await store.findPasskeyById(keep)).not.toBeNull()
    expect(sendEmail).not.toHaveBeenCalled()
    await request.after[0]?.()
    expect(sendEmail).toHaveBeenCalledOnce()
    expect(sendEmail.mock.calls[0]?.[0]).toMatchObject({ to: ada.email })
    expect(sendEmail.mock.calls[0]?.[0].text).toContain('“Phone”')
  })

  it('lets the last one go, and email and password still sign in', async () => {
    const id = await save(ada)
    await signInAs(ada)
    expect(await flow.removePasskey({ passkeyId: id })).toEqual({ ok: true })
    expect(await countOf(ada)).toBe(0)
    const { token } = await payload.login({
      collection: 'users',
      data: { email: ada.email, password: testPassword('ada') },
    })
    expect(token).toBeTruthy()
  })

  it('removes a passkey once: a second request for it is refused and sends no second note', async () => {
    const id = await save(ada)
    await signInAs(ada)
    expect(await flow.removePasskey({ passkeyId: id })).toEqual({ ok: true })
    expect(await flow.removePasskey({ passkeyId: id })).toEqual({ ok: false, failure: 'failed' })
    expect(request.after).toHaveLength(1)
  })
})

describe('removing what isn’t yours', () => {
  it('refuses another account’s passkey, leaves it in place and sends nothing', async () => {
    const bobs = await save(bob, 'Bob’s key')
    await signInAs(ada)
    expect(await flow.removePasskey({ passkeyId: bobs })).toEqual({ ok: false, failure: 'failed' })
    expect(await store.findPasskeyById(bobs)).not.toBeNull()
    expect(request.after).toHaveLength(0)
  })

  it('answers the same for a passkey that does not exist', async () => {
    await signInAs(ada)
    expect(await flow.removePasskey({ passkeyId: 987654 })).toEqual({
      ok: false,
      failure: 'failed',
    })
  })

  it('refuses when nobody is signed in', async () => {
    const id = await save(ada)
    request.headers = new Headers()
    expect(await flow.removePasskey({ passkeyId: id })).toEqual({
      ok: false,
      failure: 'sign-in-again',
    })
    expect(await store.findPasskeyById(id)).not.toBeNull()
  })
})

describe('a recent sign-in', () => {
  it('is needed: an older session is sent to sign in again and the passkey stays', async () => {
    const id = await save(ada)
    await signInAs(ada)
    await ageSession(ada, RECENT_SIGN_IN_WINDOW_MS + 60_000)
    expect(await flow.removePasskey({ passkeyId: id })).toEqual({
      ok: false,
      failure: 'sign-in-again',
    })
    expect(await store.findPasskeyById(id)).not.toBeNull()
    expect(request.after).toHaveLength(0)
  })
})
