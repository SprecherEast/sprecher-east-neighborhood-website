import type { Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { Account } from '@/platform/payload/testing/inMemoryPayload'

import {
  approve,
  authorizeParams,
  bootOAuth,
  codeFrom,
  exchange,
  pkce,
  REDIRECT,
  registerClient,
  signIn,
} from '../../testing/oauthFlow'

/**
 * Renewing and replaying (#1501): a refresh rotates the refresh token, a replay of a refresh token
 * or a code ends the whole family, and two requests at the same moment cannot both win.
 */

vi.mock('server-only', () => ({}))

let payload: Payload
let admin: Account
let agent: Account
let clientId: string

beforeAll(async () => {
  ;({ payload, admin, agent, clientId } = await bootOAuth())
}, 60_000)

describe('refreshing', () => {
  it('renews access and rotates the refresh token, so the old one stops working', async () => {
    const first = (await signIn(payload, admin, clientId)).body
    const renewed = await exchange({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: first.refresh_token,
    })
    expect(renewed.status).toBe(200)
    expect(renewed.body.access_token).toMatch(/^sea_/)
    expect(renewed.body.access_token).not.toBe(first.access_token)
    expect(renewed.body.refresh_token).not.toBe(first.refresh_token)
    // The one scope is carried through a renewal, as it is through the first sign-in
    expect(renewed.body.scope).toBe('mcp')
    expect(first.scope).toBe('mcp')

    const again = await exchange({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: first.refresh_token,
    })
    expect(again.status).toBe(400)
    expect(again.body.error).toBe('invalid_grant')
  })

  it('treats a replayed refresh token as theft and ends the whole family', async () => {
    const first = (await signIn(payload, admin, clientId)).body
    const renewed = await exchange({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: first.refresh_token,
    })
    await exchange({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: first.refresh_token,
    })
    // The newest refresh token, which the thief or the client holds, is dead too
    const latest = await exchange({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: renewed.body.refresh_token ?? '',
    })
    expect(latest.body.error).toBe('invalid_grant')
  })

  it('refuses another client trying a refresh token', async () => {
    const other = await registerClient(payload, admin, agent, { name: 'Other' })
    const first = (await signIn(payload, admin, clientId)).body
    const stolen = await exchange({
      grant_type: 'refresh_token',
      client_id: other,
      refresh_token: first.refresh_token,
    })
    expect(stolen.body.error).toBe('invalid_grant')
  })
})

describe('a code is single use', () => {
  it('refuses a second exchange and ends what the first made', async () => {
    const { verifier, challenge } = pkce()
    const decided = await approve(authorizeParams(clientId, challenge), admin)
    if (decided.kind !== 'redirect') throw new Error('expected a redirect')
    const form = {
      grant_type: 'authorization_code',
      client_id: clientId,
      code: codeFrom(decided.url),
      code_verifier: verifier,
      redirect_uri: REDIRECT,
    }
    const first = await exchange(form)
    expect(first.status).toBe(200)
    const replay = await exchange(form)
    expect(replay.body.error).toBe('invalid_grant')
    // The refresh token the first exchange made no longer works
    const refreshed = await exchange({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: first.body.refresh_token ?? '',
    })
    expect(refreshed.body.error).toBe('invalid_grant')
  })

  it('is spent by a wrong verifier, so a code cannot be guessed at', async () => {
    const { verifier, challenge } = pkce()
    const decided = await approve(authorizeParams(clientId, challenge), admin)
    if (decided.kind !== 'redirect') throw new Error('expected a redirect')
    const form = {
      grant_type: 'authorization_code',
      client_id: clientId,
      code: codeFrom(decided.url),
      redirect_uri: REDIRECT,
    }
    const wrong = await exchange({ ...form, code_verifier: pkce().verifier })
    expect(wrong.status).toBe(400)
    const right = await exchange({ ...form, code_verifier: verifier })
    expect(right.status).toBe(400)
    expect(right.body.error).toBe('invalid_grant')
  })
})
