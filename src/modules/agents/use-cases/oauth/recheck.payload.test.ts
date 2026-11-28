import type { Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { Account } from '@/platform/payload/testing/inMemoryPayload'

import {
  approve,
  authorizeParams,
  bootOAuth,
  codeFrom,
  exchange,
  onlyDoc,
  pkce,
  REDIRECT,
  registerClient,
} from '../../testing/oauthFlow'

/**
 * The code exchange and the refresh read the client's record again (#1499): a record narrowed
 * after the approval refuses the code, and a refresh never gets more than the token holds, even
 * when the record was widened since.
 */

vi.mock('server-only', () => ({}))

let payload: Payload
let admin: Account
let agent: Account

beforeAll(async () => {
  ;({ payload, admin, agent } = await bootOAuth())
}, 60_000)

/** Changes what a client's record allows, as an admin does in Admin */
const setScopes = async (clientId: string, scopes: ('read' | 'suggest')[]) => {
  const doc = onlyDoc(
    await payload.find({
      collection: 'oauth-clients',
      where: { clientId: { equals: clientId } },
      overrideAccess: true,
    }),
  )
  await payload.update({
    collection: 'oauth-clients',
    id: doc.id,
    data: { scopes },
    user: admin,
    overrideAccess: false,
  })
}

describe('the exchange and the refresh check the record again', () => {
  it('refuses a code whose scopes the record no longer allows, and issues no token', async () => {
    const id = await registerClient(payload, admin, agent, { scopes: ['read', 'suggest'] })
    const { verifier, challenge: c } = pkce()
    const decided = await approve(authorizeParams(id, c, { scope: 'read suggest' }), admin)
    if (decided.kind !== 'redirect') throw new Error('refused')
    await setScopes(id, ['read'])
    const answer = await exchange({
      grant_type: 'authorization_code',
      client_id: id,
      code: codeFrom(decided.url),
      code_verifier: verifier,
      redirect_uri: REDIRECT,
    })
    expect(answer.body.error).toBe('invalid_scope')
    expect(answer.body.access_token).toBeUndefined()
    expect(answer.body.refresh_token).toBeUndefined()
  })

  it('refuses a refresh that asks for more than the token holds, and a plain one still gives read', async () => {
    const id = await registerClient(payload, admin, agent, { scopes: ['read'] })
    const { verifier, challenge: c } = pkce()
    const decided = await approve(authorizeParams(id, c, { scope: 'read' }), admin)
    if (decided.kind !== 'redirect') throw new Error('refused')
    const tokens = await exchange({
      grant_type: 'authorization_code',
      client_id: id,
      code: codeFrom(decided.url),
      code_verifier: verifier,
      redirect_uri: REDIRECT,
    })
    expect(tokens.body.scope).toBe('read')
    await setScopes(id, ['read', 'suggest'])
    const stretched = await exchange({
      grant_type: 'refresh_token',
      client_id: id,
      refresh_token: tokens.body.refresh_token ?? '',
      scope: 'read suggest',
    })
    expect(stretched.body.error).toBe('invalid_scope')
    expect(stretched.body.access_token).toBeUndefined()
    const plain = await exchange({
      grant_type: 'refresh_token',
      client_id: id,
      refresh_token: tokens.body.refresh_token ?? '',
    })
    expect(plain.body.scope).toBe('read')
  })
})
