import type { Payload } from 'payload'
import { vi } from 'vitest'

import {
  bootPayload,
  createAccount,
  type Account,
} from '@/platform/payload/testing/inMemoryPayload'

import type { PasskeyRequestOptions } from '../domain/signInWithPasskey'
import type * as Flow from '../use-cases/signInWithPasskey'
import {
  newSoftwareCredential,
  softwareAssertion,
  type SoftwareCredential,
} from './softwareAuthenticator'

/**
 * What the passkey sign-in tests against real Payload share (#1315): the replaced request APIs,
 * the booted site with two accounts, an account that holds a passkey, and the answer a software
 * authenticator gives. A test file names the request APIs with
 * `vi.mock('next/headers', async () => (await import('../testing/passkeySignInHarness')).nextHeaders)`,
 * calls `boot()` once and `resetRequest()` before each test.
 */

export const ORIGIN = 'https://sprecher-east.example'
export const RP_ID = 'sprecher-east.example'
export const CHALLENGE_COOKIE = 'sprecher-east-passkey-challenge'
export const FAILED = { ok: false, failure: 'failed' }

export const request = {
  headers: new Headers(),
  jar: new Map<string, { value: string } & Record<string, unknown>>(),
}

/** Next's request APIs: the headers the test sets, and a cookie jar. */
export const nextHeaders = {
  headers: async () => request.headers,
  cookies: async () => ({
    get: (name: string) => request.jar.get(name),
    set: (name: string, value: string, options: Record<string, unknown> = {}) =>
      options.maxAge === 0
        ? request.jar.delete(name)
        : request.jar.set(name, { ...options, value }),
    delete: (target: string | { name: string }) =>
      request.jar.delete(typeof target === 'string' ? target : target.name),
  }),
}

export const nextServer = { after: () => {} }

export type Site = { payload: Payload; flow: typeof Flow; ada: Account; bob: Account }

/** Boots Payload on in-memory SQLite with the switch on, and makes `ada` and `bob`. */
export async function boot(): Promise<Site> {
  vi.stubEnv('PASSKEYS_ENABLED', 'true')
  vi.stubEnv('NEXT_PUBLIC_SERVER_URL', ORIGIN)
  const { payload } = await bootPayload()
  return {
    payload,
    flow: await import('../use-cases/signInWithPasskey'),
    ada: await createAccount(payload, 'guest', 'ada'),
    bob: await createAccount(payload, 'resident', 'bob'),
  }
}

/** A fresh browser, with the switch on. */
export function resetRequest(): void {
  vi.stubEnv('PASSKEYS_ENABLED', 'true')
  vi.stubEnv('NEXT_PUBLIC_SERVER_URL', ORIGIN)
  request.jar.clear()
  request.headers = new Headers()
}

export type Holder = { account: Account; credential: SoftwareCredential; handle: string }

/** An account that holds a passkey, saved as adding one stores it (`data/passkeys.ts`). */
export async function holder(account: Account): Promise<Holder> {
  const { getOrCreateUserHandle, savePasskey } = await import('../data/passkeys')
  const credential = newSoftwareCredential()
  const handle = await getOrCreateUserHandle(account.id)
  await savePasskey({
    accountId: account.id,
    credentialId: credential.credentialId,
    publicKey: credential.publicKey,
    counter: 0,
    transports: ['internal'],
    deviceType: 'multiDevice',
    backedUp: true,
    label: 'Test passkey',
  })
  return { account, credential, handle }
}

/** The sign-in options, as the browser gets them (and its challenge cookie is set). */
export async function start(site: Site): Promise<PasskeyRequestOptions> {
  const result = await site.flow.startPasskeySignIn(null)
  if (!result.ok) throw new Error(`start gave ${result.failure}`)
  return result.options
}

/** The answer the holder's authenticator gives to these options, made on the site's origin. */
export const answerTo = (
  who: Holder,
  options: PasskeyRequestOptions,
  over: Partial<Parameters<typeof softwareAssertion>[0]> = {},
) =>
  softwareAssertion({
    credential: who.credential,
    options,
    origin: ORIGIN,
    rpID: RP_ID,
    userHandle: who.handle,
    ...over,
  })

/** Who Payload's auth says the browser's auth cookie belongs to, sent as a browser sends it. */
export async function whoHolds(site: Site) {
  const cookie = request.jar.get('payload-token')?.value
  if (!cookie) return null
  const { user } = await site.payload.auth({
    headers: new Headers({ cookie: `payload-token=${cookie}`, 'sec-fetch-site': 'same-origin' }),
  })
  return user
}

export type StoredPasskey = { counter: number; lastUsedAt: string | null }

export const storedPasskey = async (site: Site, who: Holder) =>
  (await site.payload.db.findOne({
    collection: 'passkeys',
    where: { credentialId: { equals: who.credential.credentialId } },
  })) as unknown as StoredPasskey

/** A claim in a sign-in token. */
export const claim = (token: string, name: 'exp' | 'sid') =>
  JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'))[name]
