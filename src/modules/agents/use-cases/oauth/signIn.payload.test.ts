import type { Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { createAccount, type Account } from '@/platform/payload/testing/inMemoryPayload'

import {
  approve,
  authorizeParams,
  begin,
  bootOAuth,
  codeFrom,
  decide,
  exchange,
  pkce,
  REDIRECT,
  RESOURCE,
  signIn,
  viewerOf,
  onlyDoc,
} from '../../testing/oauthFlow'

/**
 * The OAuth sign-in on Payload with an in-memory database (#1501): an admin registered the client
 * and approves, and the client trades the code for tokens. Renewing and replaying are in
 * `renewal.payload.test.ts`, the refusals in `refusals.payload.test.ts` and `tokenRefusals.payload.test.ts`,
 * and the MCP address in `mcpOAuth.payload.test.ts`.
 */

vi.mock('server-only', () => ({}))

let payload: Payload
let admin: Account
let agent: Account
let clientId: string

beforeAll(async () => {
  ;({ payload, admin, agent, clientId } = await bootOAuth())
}, 60_000)

describe('registering a client', () => {
  it('gives it an ID made by the server, which an edit cannot change', async () => {
    expect(clientId).toMatch(/^mcp_[0-9a-f]{32}$/)
    const found = await payload.find({
      collection: 'oauth-clients',
      where: { clientId: { equals: clientId } },
      user: admin,
      overrideAccess: false,
    })
    const updated = await payload.update({
      collection: 'oauth-clients',
      id: onlyDoc(found).id,
      data: { name: 'Claude', clientId: 'mcp_chosen' },
      user: admin,
      overrideAccess: false,
    })
    expect(updated.clientId).toBe(clientId)
  })
})

describe('the consent page', () => {
  it('shows an admin the client, where it returns to, and the account it acts as', async () => {
    const { challenge } = pkce()
    const begun = await begin(authorizeParams(clientId, challenge), viewerOf(admin))
    expect(begun).toMatchObject({
      kind: 'consent',
      view: { clientName: 'Claude', redirectHost: 'claude.ai', agentName: 'scout' },
    })
  })

  it('asks a visitor to sign in, and tells a signed-in non-admin only an admin may approve', async () => {
    const { challenge } = pkce()
    const params = authorizeParams(clientId, challenge)
    expect(await begin(params, null)).toEqual({ kind: 'sign-in-needed' })
    const editor = await createAccount(payload, 'editor', 'ed')
    expect(await begin(params, viewerOf(editor))).toEqual({ kind: 'admin-needed' })
  })
})

describe('authorization code with PKCE', () => {
  it('approves, then trades the code for an access token and a refresh token', async () => {
    const { verifier, challenge } = pkce()
    const decided = await approve(authorizeParams(clientId, challenge), admin)
    if (decided.kind !== 'redirect') throw new Error('expected a redirect')
    const back = new URL(decided.url)
    expect(`${back.origin}${back.pathname}`).toBe(REDIRECT)
    expect(back.searchParams.get('state')).toBe('state-1')
    expect(back.searchParams.get('iss')).toBe(new URL(RESOURCE).origin)

    const tokens = await exchange({
      grant_type: 'authorization_code',
      client_id: clientId,
      code: codeFrom(decided.url),
      code_verifier: verifier,
      redirect_uri: REDIRECT,
      resource: RESOURCE,
    })
    expect(tokens.status).toBe(200)
    expect(tokens.headers['Cache-Control']).toBe('no-store')
    expect(tokens.body).toMatchObject({ token_type: 'Bearer', scope: 'mcp' })
    expect(tokens.body.access_token).toMatch(/^sea_/)
    expect(tokens.body.refresh_token).toMatch(/^ser_/)
    expect(tokens.body.expires_in).toBeGreaterThan(3500)
    expect(tokens.body.expires_in).toBeLessThanOrEqual(3600)
  })

  it('keeps only hashes: no stored value is a credential, and no row is readable as one', async () => {
    const { body, code } = await signIn(payload, admin, clientId)
    const rows = await payload.find({
      collection: 'oauth-tokens',
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    const stored = JSON.stringify(rows.docs)
    for (const secret of [body.access_token, body.refresh_token, code]) {
      expect(secret).toBeTruthy()
      expect(stored).not.toContain(secret)
    }
    expect(rows.docs.every((row) => row.tokenHash.length === 64)).toBe(true)
  })

  it('records who approved, and what the tokens are for', async () => {
    const { body } = await signIn(payload, admin, clientId)
    expect(body.access_token).toBeTruthy()
    const rows = await payload.find({
      collection: 'oauth-tokens',
      where: { kind: { equals: 'access' } },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    expect(rows.docs[0]).toMatchObject({
      resource: RESOURCE,
      scope: 'mcp',
      consentedBy: admin.id,
      agent: agent.id,
    })
  })
})

describe('a denied connection', () => {
  it('sends access_denied back with the state and makes no code', async () => {
    const { challenge } = pkce()
    const begun = await begin(authorizeParams(clientId, challenge), viewerOf(admin))
    if (begun.kind !== 'consent') throw new Error('expected consent')
    const before = await payload.count({ collection: 'oauth-tokens', overrideAccess: true })
    const decided = await decide(begun.view.request, begun.view.ticket, 'deny', viewerOf(admin))
    if (decided.kind !== 'redirect') throw new Error('expected a redirect')
    const back = new URL(decided.url)
    expect(back.searchParams.get('error')).toBe('access_denied')
    expect(back.searchParams.get('state')).toBe('state-1')
    expect(back.searchParams.get('code')).toBeNull()
    expect(
      (await payload.count({ collection: 'oauth-tokens', overrideAccess: true })).totalDocs,
    ).toBe(before.totalDocs)
  })
})
