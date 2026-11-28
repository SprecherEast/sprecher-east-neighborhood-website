import OAuth2Server from '@node-oauth/oauth2-server'
import type { Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { createAccount, type Account } from '@/platform/payload/testing/inMemoryPayload'

import { signConsent } from '../../domain/oauth/consent'
import {
  approve,
  authorizeParams,
  begin,
  bootOAuth,
  decide,
  pkce,
  REDIRECT,
  registerClient,
  viewerOf,
  onlyDoc,
} from '../../testing/oauthFlow'

/**
 * What the consent page refuses (#1501): a wrong redirect address, a client that is unknown or
 * switched off, a request without PKCE S256 or the MCP address as resource, and an approval by
 * someone who is not an admin or that was forged, changed or left too long. The token address's
 * refusals are in `tokenRefusals.payload.test.ts`.
 */

vi.mock('server-only', () => ({}))

let payload: Payload
let admin: Account
let agent: Account
let clientId: string

beforeAll(async () => {
  ;({ payload, admin, agent, clientId } = await bootOAuth())
}, 60_000)

const { challenge } = pkce()
const refusedPage = { kind: 'refused' }
const tokenRows = async () =>
  (await payload.count({ collection: 'oauth-tokens', overrideAccess: true })).totalDocs

describe('a request that must not be redirected anywhere', () => {
  it.each([
    ['an address that is not registered', { redirect_uri: 'https://evil.example/cb' }],
    ['a registered address with a path added', { redirect_uri: `${REDIRECT}/x` }],
    ['no redirect address', { redirect_uri: undefined }],
    ['an unknown client', { client_id: 'mcp_unknown' }],
    ['no client', { client_id: undefined }],
  ])('shows an error on the site for %s', async (_name, over) => {
    const begun = await begin(authorizeParams(clientId, challenge, over), viewerOf(admin))
    expect(begun).toMatchObject(refusedPage)
  })

  it('shows an error for a client an admin switched off, and approves nothing', async () => {
    const off = await registerClient(payload, admin, agent, { enabled: false })
    expect(await begin(authorizeParams(off, challenge), viewerOf(admin))).toMatchObject(refusedPage)
  })

  it('does not ask a visitor to sign in for a request that is already wrong', async () => {
    const begun = await begin(
      authorizeParams(clientId, challenge, { redirect_uri: 'https://evil.example/cb' }),
      null,
    )
    expect(begun).toMatchObject(refusedPage)
  })

  it('lets a loopback client use any port, and no other address', async () => {
    const local = await registerClient(payload, admin, agent, {
      redirectUris: ['http://127.0.0.1/callback'],
    })
    const ok = await begin(
      authorizeParams(local, challenge, { redirect_uri: 'http://127.0.0.1:40123/callback' }),
      viewerOf(admin),
    )
    expect(ok).toMatchObject({ kind: 'consent', view: { redirectHost: '127.0.0.1:40123' } })
    const other = await begin(
      authorizeParams(local, challenge, { redirect_uri: 'http://127.0.0.1:40123/other' }),
      viewerOf(admin),
    )
    expect(other).toMatchObject(refusedPage)
  })
})

describe('a request the client hears about', () => {
  it.each([
    ['no PKCE challenge', { code_challenge: undefined }, 'invalid_request'],
    ['the plain method', { code_challenge_method: 'plain' }, 'invalid_request'],
    ['no method', { code_challenge_method: undefined }, 'invalid_request'],
    ['no state', { state: undefined }, 'invalid_request'],
    ['the token response type', { response_type: 'token' }, 'unsupported_response_type'],
    ['no resource', { resource: undefined }, 'invalid_target'],
    ['another resource', { resource: 'https://sprechereast.com/api/graphql' }, 'invalid_target'],
    ['another scope', { scope: 'mcp admin' }, 'invalid_scope'],
  ])('answers %s with %s', async (_name, over, code) => {
    const begun = await begin(authorizeParams(clientId, challenge, over), viewerOf(admin))
    if (begun.kind !== 'redirect') throw new Error(`expected a redirect, got ${begun.kind}`)
    const back = new URL(begun.url)
    expect(`${back.origin}${back.pathname}`).toBe(REDIRECT)
    expect(back.searchParams.get('error')).toBe(code)
    expect(back.searchParams.get('code')).toBeNull()
  })
})

describe('the approval', () => {
  it('is refused for an editor, a visitor and an agent, and makes no code', async () => {
    const before = await tokenRows()
    const begun = await begin(authorizeParams(clientId, challenge), viewerOf(admin))
    if (begun.kind !== 'consent') throw new Error('expected consent')
    const editor = await createAccount(payload, 'editor', 'ed')
    for (const who of [viewerOf(editor), viewerOf(agent), null]) {
      expect(await decide(begun.view.request, begun.view.ticket, 'approve', who)).toMatchObject(
        refusedPage,
      )
    }
    expect(await tokenRows()).toBe(before)
  })

  it('is refused when the ticket was made for another admin', async () => {
    const second = await createAccount(payload, 'admin', 'bo')
    const begun = await begin(authorizeParams(clientId, challenge), viewerOf(admin))
    if (begun.kind !== 'consent') throw new Error('expected consent')
    const forwarded = await decide(
      begun.view.request,
      begun.view.ticket,
      'approve',
      viewerOf(second),
    )
    expect(forwarded).toMatchObject(refusedPage)
  })

  it('is refused when the request was changed after the page showed it', async () => {
    const begun = await begin(authorizeParams(clientId, challenge), viewerOf(admin))
    if (begun.kind !== 'consent') throw new Error('expected consent')
    const swapped = { ...begun.view.request, codeChallenge: pkce().challenge }
    expect(await decide(swapped, begun.view.ticket, 'approve', viewerOf(admin))).toMatchObject(
      refusedPage,
    )
    const other = await registerClient(payload, admin, agent, { name: 'Other' })
    const another = { ...begun.view.request, clientId: other }
    expect(await decide(another, begun.view.ticket, 'approve', viewerOf(admin))).toMatchObject(
      refusedPage,
    )
  })

  it('is refused when the ticket is forged, empty or too old', async () => {
    const begun = await begin(authorizeParams(clientId, challenge), viewerOf(admin))
    if (begun.kind !== 'consent') throw new Error('expected consent')
    for (const ticket of ['', 'forged', '9999999999.AAAA']) {
      expect(await decide(begun.view.request, ticket, 'approve', viewerOf(admin))).toMatchObject(
        refusedPage,
      )
    }
    const old = signConsent(begun.view.request, {
      adminId: admin.id,
      now: new Date('2026-01-01'),
      secret: payload.secret,
    })
    expect(await decide(begun.view.request, old, 'approve', viewerOf(admin))).toMatchObject(
      refusedPage,
    )
  })

  it('is refused when the client was switched off after the page was shown', async () => {
    const soon = await registerClient(payload, admin, agent)
    const begun = await begin(authorizeParams(soon, challenge), viewerOf(admin))
    if (begun.kind !== 'consent') throw new Error('expected consent')
    const found = await payload.find({
      collection: 'oauth-clients',
      where: { clientId: { equals: soon } },
      user: admin,
      overrideAccess: false,
    })
    await payload.update({
      collection: 'oauth-clients',
      id: onlyDoc(found).id,
      data: { enabled: false },
      user: admin,
      overrideAccess: false,
    })
    expect(
      await decide(begun.view.request, begun.view.ticket, 'approve', viewerOf(admin)),
    ).toMatchObject(refusedPage)
  })
})

describe('an error the OAuth library raises while the approval makes its code', () => {
  const approveWith = async (error: Error) => {
    vi.spyOn(OAuth2Server.prototype, 'authorize').mockRejectedValueOnce(error)
    const done = await approve(authorizeParams(clientId, challenge), admin)
    if (done.kind !== 'redirect') throw new Error('expected a redirect')
    return new URL(done.url).searchParams
  }

  it('goes back to the tool under its standard name', async () => {
    const answered = await approveWith(new OAuth2Server.InvalidScopeError('internal detail'))
    expect(answered.get('error')).toBe('invalid_scope')
    expect(answered.get('error_description')).toBe('The request was refused.')
  })

  it('goes back as a server error when the name is not a standard one, never as the library names it', async () => {
    const answered = await approveWith(new OAuth2Server.InvalidArgumentError('internal detail'))
    expect(answered.get('error')).toBe('server_error')
    expect(answered.get('error_description')).toBe('The server could not finish the sign-in.')
  })
})
