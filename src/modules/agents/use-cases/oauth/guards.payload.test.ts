import type { Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { Account } from '@/platform/payload/testing/inMemoryPayload'

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
  registerClient,
  signIn,
  viewerOf,
} from '../../testing/oauthFlow'

/**
 * Two guards that were only ever true by accident of another check (#1501): the token address
 * asks again whether the account is still an agent, and the approval asks again whether the person
 * pressing the button is still an admin. Each case changes the account in the database, as an
 * admin would in Admin, after the grant or the page was made.
 */

vi.mock('server-only', () => ({}))

let payload: Payload
let admin: Account
let clientId: string

beforeAll(async () => {
  ;({ payload, admin, clientId } = await bootOAuth())
}, 60_000)

const setRole = (account: Account, role: Account['role']) =>
  payload.db.updateOne({ collection: 'users', id: account.id, data: { role } })

describe('an account that stops being an agent', () => {
  it('can no longer refresh: the token address answers invalid_grant', async () => {
    const own = await createAgentClient('refresh')
    const first = (await signIn(payload, admin, own.clientId)).body
    await setRole(own.agent, 'guest')
    const renewed = await exchange({
      grant_type: 'refresh_token',
      client_id: own.clientId,
      refresh_token: first.refresh_token,
    })
    expect(renewed.status).toBe(400)
    expect(renewed.body.error).toBe('invalid_grant')
  })

  it('can no longer trade a code that was approved while it was one', async () => {
    const own = await createAgentClient('code')
    const { verifier, challenge } = pkce()
    const decided = await approve(authorizeParams(own.clientId, challenge), admin)
    if (decided.kind !== 'redirect') throw new Error('expected a redirect')
    await setRole(own.agent, 'editor')
    const traded = await exchange({
      grant_type: 'authorization_code',
      client_id: own.clientId,
      code: codeFrom(decided.url),
      code_verifier: verifier,
      redirect_uri: REDIRECT,
    })
    expect(traded.body.error).toBe('invalid_grant')
    expect(traded.body.access_token).toBeUndefined()
  })

  async function createAgentClient(name: string) {
    const { createAccount } = await import('@/platform/payload/testing/inMemoryPayload')
    const own = await createAccount(payload, 'agent', `agent-${name}`)
    return { agent: own, clientId: await registerClient(payload, admin, own) }
  }
})

describe('an admin who is no longer one when the button is pressed', () => {
  it('is refused, though the ticket made for them is still good', async () => {
    const { challenge } = pkce()
    const begun = await begin(authorizeParams(clientId, challenge), viewerOf(admin))
    if (begun.kind !== 'consent') throw new Error('expected the approval')
    const { request, ticket } = begun.view
    // Pressed by the same account (the ticket is theirs), no longer an admin
    const demoted = { id: admin.id, isAdmin: false }
    expect((await decide(request, ticket, 'approve', demoted)).kind).toBe('refused')
    expect((await decide(request, ticket, 'deny', demoted)).kind).toBe('refused')
    expect((await decide(request, ticket, 'approve', null)).kind).toBe('refused')
    // And still good for the admin themselves: the refusal above was the role
    expect((await decide(request, ticket, 'approve', viewerOf(admin))).kind).toBe('redirect')
  })
})

describe('a client moved to another agent account', () => {
  it('stops its old tokens for good, even if it is moved back', async () => {
    const { createAccount } = await import('@/platform/payload/testing/inMemoryPayload')
    const first = await createAccount(payload, 'agent', 'agent-before')
    const second = await createAccount(payload, 'agent', 'agent-after')
    const id = await registerClient(payload, admin, first)
    const issued = (await signIn(payload, admin, id)).body
    const doc = (
      await payload.find({
        collection: 'oauth-clients',
        where: { clientId: { equals: id } },
        overrideAccess: true,
      })
    ).docs[0]
    const move = (agentId: number) =>
      payload.update({
        collection: 'oauth-clients',
        id: doc?.id ?? 0,
        data: { agent: agentId },
        user: admin,
        overrideAccess: false,
      })
    await move(second.id)
    const rows = await payload.find({
      collection: 'oauth-tokens',
      where: { client: { equals: doc?.id } },
      limit: 20,
      depth: 0,
      overrideAccess: true,
    })
    expect(rows.docs.length).toBeGreaterThan(0)
    expect(rows.docs.every((row) => row.revokedAt)).toBe(true)
    await move(first.id)
    const renewed = await exchange({
      grant_type: 'refresh_token',
      client_id: id,
      refresh_token: issued.refresh_token,
    })
    expect(renewed.body.error).toBe('invalid_grant')
    // The tool signs in again and acts as the account the client has now
    expect((await signIn(payload, admin, id)).status).toBe(200)
  })
})

describe('a client edited without changing its agent account', () => {
  it('keeps its tokens: renaming it and saving the same account again end nothing', async () => {
    const { createAccount } = await import('@/platform/payload/testing/inMemoryPayload')
    const account = await createAccount(payload, 'agent', 'agent-stays')
    const id = await registerClient(payload, admin, account)
    const issued = (await signIn(payload, admin, id)).body
    const doc = (
      await payload.find({
        collection: 'oauth-clients',
        where: { clientId: { equals: id } },
        overrideAccess: true,
      })
    ).docs[0]
    for (const data of [{ name: 'Claude, renamed' }, { agent: account.id }]) {
      await payload.update({
        collection: 'oauth-clients',
        id: doc?.id ?? 0,
        data,
        user: admin,
        overrideAccess: false,
      })
    }
    const rows = await payload.find({
      collection: 'oauth-tokens',
      where: { client: { equals: doc?.id } },
      limit: 20,
      depth: 0,
      overrideAccess: true,
    })
    expect(rows.docs.length).toBeGreaterThan(0)
    expect(rows.docs.some((row) => row.revokedAt)).toBe(false)
    const renewed = await exchange({
      grant_type: 'refresh_token',
      client_id: id,
      refresh_token: issued.refresh_token,
    })
    expect(renewed.status).toBe(200)
  })
})
