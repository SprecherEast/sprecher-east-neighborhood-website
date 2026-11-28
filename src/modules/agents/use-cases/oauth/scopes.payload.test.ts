import type { Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { createAccount, type Account } from '@/platform/payload/testing/inMemoryPayload'

import { signConsent, type ConsentRequest } from '../../domain/oauth/consent'
import {
  approve,
  authorizeParams,
  begin,
  bootOAuth,
  codeFrom,
  continueFrom,
  decide,
  exchange,
  onlyDoc,
  pkce,
  REDIRECT,
  registerClient,
  RESOURCE,
  viewerOf,
} from '../../testing/oauthFlow'

/**
 * Scopes in the sign-in (#1499): a request is held to the scopes this repo offers and to what the
 * client's record allows, the admin is shown what will be granted, a ticket cannot be stretched
 * to more, and the token says what it got. An unknown scope, or a client past its expiry, is
 * refused.
 */

vi.mock('server-only', () => ({}))

let payload: Payload
let admin: Account
let agent: Account

beforeAll(async () => {
  ;({ payload, admin, agent } = await bootOAuth())
}, 60_000)

/** Leaves the scopes out, as the Admin form can: the default fills them in */
const NO_SCOPES = {} as { scopes: never }
const { challenge } = pkce()
const consentOf = async (clientId: string, scope?: string) => {
  const begun = await begin(authorizeParams(clientId, challenge, { scope }), viewerOf(admin))
  if (begun.kind !== 'consent') throw new Error(`expected consent, got ${begun.kind}`)
  return begun.view
}
const errorOf = (url: string) => new URL(url).searchParams.get('error')

describe('what the admin is asked to approve', () => {
  it('is the minimal scope when the request names none', async () => {
    const id = await registerClient(payload, admin, agent, { scopes: ['read', 'suggest'] })
    expect((await consentOf(id)).request.scope).toBe('read')
  })

  it('is what was asked, when the record allows it', async () => {
    const id = await registerClient(payload, admin, agent, { scopes: ['read', 'suggest'] })
    expect((await consentOf(id, 'suggest read')).request.scope).toBe('read suggest')
  })

  it('is no more than the record allows, whatever the request asks for', async () => {
    const id = await registerClient(payload, admin, agent, { scopes: ['read'] })
    expect((await consentOf(id, 'read suggest')).request.scope).toBe('read')
  })

  it('is refused to the client when none of what it asked for is allowed', async () => {
    const id = await registerClient(payload, admin, agent, { scopes: ['read'] })
    const begun = await begin(authorizeParams(id, challenge, { scope: 'suggest' }), viewerOf(admin))
    expect(begun).toMatchObject({ kind: 'redirect' })
    if (begun.kind === 'redirect') expect(errorOf(begun.url)).toBe('invalid_scope')
  })

  it.each(['admin', 'mcp', 'read admin', 'READ'])('refuses the unknown scope %j', async (scope) => {
    const id = await registerClient(payload, admin, agent)
    const begun = await begin(authorizeParams(id, challenge, { scope }), viewerOf(admin))
    expect(begun.kind).toBe('redirect')
    if (begun.kind === 'redirect') expect(errorOf(begun.url)).toBe('invalid_scope')
  })

  it('never includes publish, which nothing grants: asked with read, only read is shown', async () => {
    const id = await registerClient(payload, admin, agent, { scopes: ['read', 'suggest'] })
    expect((await consentOf(id, 'read publish')).request.scope).toBe('read')
    const begun = await begin(authorizeParams(id, challenge, { scope: 'publish' }), viewerOf(admin))
    expect(begun.kind).toBe('redirect')
  })
})

describe('the first page', () => {
  it('carries on only what the record allows, so both pages show the same grant', async () => {
    const id = await registerClient(payload, admin, agent, { scopes: ['read'] })
    const page = await continueFrom(authorizeParams(id, challenge, { scope: 'read suggest' }))
    if (page.kind !== 'continue') throw new Error(`expected continue, got ${page.kind}`)
    expect(new URL(page.next, 'https://x').searchParams.get('scope')).toBe('read')
  })

  it('sends invalid_scope back when none of what was asked is allowed', async () => {
    const id = await registerClient(payload, admin, agent, { scopes: ['read'] })
    const page = await continueFrom(authorizeParams(id, challenge, { scope: 'suggest' }))
    expect(page.kind).toBe('redirect')
    if (page.kind === 'redirect') expect(errorOf(page.url)).toBe('invalid_scope')
  })

  it('refuses a client past its expiry on the site, sending nothing back', async () => {
    const id = await registerClient(payload, admin, agent, {
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    })
    expect((await continueFrom(authorizeParams(id, challenge))).kind).toBe('refused')
  })
})

describe('an approval', () => {
  it('gives a token the scopes shown, and says so in the answer', async () => {
    const id = await registerClient(payload, admin, agent, { scopes: ['read', 'suggest'] })
    const { verifier, challenge: c } = pkce()
    const decided = await approve(authorizeParams(id, c, { scope: 'read suggest' }), admin)
    if (decided.kind !== 'redirect') throw new Error('refused')
    const tokens = await exchange({
      grant_type: 'authorization_code',
      client_id: id,
      code: codeFrom(decided.url),
      code_verifier: verifier,
      redirect_uri: REDIRECT,
    })
    expect(tokens.body.scope).toBe('read suggest')
    const refreshed = await exchange({
      grant_type: 'refresh_token',
      client_id: id,
      refresh_token: tokens.body.refresh_token ?? '',
    })
    expect(refreshed.body.scope).toBe('read suggest')
  })

  it('cannot be stretched: a signed ticket for more than the record allows is refused', async () => {
    const id = await registerClient(payload, admin, agent, { scopes: ['read'] })
    const request: ConsentRequest = {
      clientId: id,
      redirectUri: REDIRECT,
      state: 'state-1',
      codeChallenge: challenge,
      resource: RESOURCE,
      scope: 'read suggest',
    }
    const ticket = signConsent(request, {
      adminId: admin.id,
      now: new Date(),
      secret: payload.secret,
    })
    expect(await decide(request, ticket, 'approve', viewerOf(admin))).toMatchObject({
      kind: 'refused',
    })
  })

  it('is refused when the record was narrowed after the page was shown', async () => {
    const id = await registerClient(payload, admin, agent, { scopes: ['read', 'suggest'] })
    const view = await consentOf(id, 'read suggest')
    const doc = onlyDoc(
      await payload.find({
        collection: 'oauth-clients',
        where: { clientId: { equals: id } },
        overrideAccess: true,
      }),
    )
    await payload.update({
      collection: 'oauth-clients',
      id: doc.id,
      data: { scopes: ['read'] },
      user: admin,
      overrideAccess: false,
    })
    expect(await decide(view.request, view.ticket, 'approve', viewerOf(admin))).toMatchObject({
      kind: 'refused',
    })
  })
})

describe('a client past its expiry', () => {
  it('cannot start a connection', async () => {
    const id = await registerClient(payload, admin, agent)
    const doc = onlyDoc(
      await payload.find({
        collection: 'oauth-clients',
        where: { clientId: { equals: id } },
        overrideAccess: true,
      }),
    )
    await payload.update({
      collection: 'oauth-clients',
      id: doc.id,
      data: { expiresAt: '2020-01-01T00:00:00.000Z' },
      user: admin,
      overrideAccess: false,
    })
    expect(await begin(authorizeParams(id, challenge), viewerOf(admin))).toMatchObject({
      kind: 'refused',
    })
  })

  it('can be registered with a later expiry and still connects', async () => {
    const id = await registerClient(payload, admin, agent, {
      expiresAt: '2099-01-01T00:00:00.000Z',
    })
    expect((await consentOf(id)).request.scope).toBe('read')
  })
})

describe('registering a client', () => {
  it('starts with read only when no scope is picked, and refuses none at all', async () => {
    const created = await payload.create({
      collection: 'oauth-clients',
      data: {
        name: 'Default',
        agent: (await createAccount(payload, 'agent', 'plain')).id,
        redirectUris: [{ uri: REDIRECT }],
        ...NO_SCOPES,
      },
      user: admin,
      overrideAccess: false,
    })
    expect(created.scopes).toEqual(['read'])
    await expect(
      payload.create({
        collection: 'oauth-clients',
        data: { name: 'None', agent: agent.id, redirectUris: [{ uri: REDIRECT }], scopes: [] },
        user: admin,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('cannot be saved with a scope this address does not offer', async () => {
    await expect(
      payload.create({
        collection: 'oauth-clients',
        data: {
          name: 'Odd',
          agent: agent.id,
          redirectUris: [{ uri: REDIRECT }],
          scopes: ['publish' as never],
        },
        user: admin,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})
