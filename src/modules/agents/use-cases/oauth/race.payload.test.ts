import type { Payload, SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { mcpClient } from '@/platform/payload/testing/mcpRequest'
import {
  createAccount,
  bootPayload,
  type Account,
} from '@/platform/payload/testing/inMemoryPayload'

import {
  approve,
  authorizeParams,
  codeFrom,
  exchange,
  pkce,
  REDIRECT,
  registerClient,
  RESOURCE,
  onlyDoc,
  signIn,
  type TokenBody,
} from '../../testing/oauthFlow'

/**
 * Two requests that present the same code or refresh token at the same moment (#1501). A replay
 * ends the whole family, and it must also end what the request that got in first was given: the
 * loser's revocation can run before the winner has saved its tokens, so saving looks again. Each
 * test runs the race several times, since which request wins is not fixed, and then asks the AI
 * agent address and the token address whether anything issued still works. Nothing may.
 */

vi.mock('server-only', () => ({}))

const ROUNDS = 6

let payload: Payload
let config: SanitizedConfig
let admin: Account
let clientId: string
let mcp: ReturnType<typeof mcpClient>

beforeAll(async () => {
  ;({ payload, config } = await bootPayload())
  admin = await createAccount(payload, 'admin', 'ana')
  const agent = await createAccount(payload, 'agent', 'scout')
  clientId = await registerClient(payload, admin, agent)
  mcp = mcpClient(config)
}, 60_000)

/** Whether the AI agent address lets this access token in */
const accepted = async (token: string) => (await mcp.call('tools/list', {}, token)).status === 200

async function expectEverythingDead(issued: TokenBody[]) {
  for (const tokens of issued) {
    if (tokens.access_token) expect(await accepted(tokens.access_token)).toBe(false)
    if (tokens.refresh_token) {
      const renewed = await exchange({
        grant_type: 'refresh_token',
        client_id: clientId,
        refresh_token: tokens.refresh_token,
      })
      expect(renewed.body.error).toBe('invalid_grant')
    }
  }
}

describe('two requests with the same refresh token at once', () => {
  it('end the family: whatever the winner was given stops working', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const first = (await signIn(payload, admin, clientId)).body
      const form = {
        grant_type: 'refresh_token',
        client_id: clientId,
        refresh_token: first.refresh_token,
      }
      const results = await Promise.all([exchange(form), exchange(form)])
      expect(results.filter((r) => r.status === 200).length).toBeLessThanOrEqual(1)
      expect(results.some((r) => r.status === 400)).toBe(true)
      // The original tokens, and anything the race issued, are dead
      await expectEverythingDead([first, ...results.map((r) => r.body)])
    }
  })
})

describe('two exchanges of the same code at once', () => {
  it('end the family: whatever the winner was given stops working', async () => {
    for (let round = 0; round < ROUNDS; round++) {
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
      const results = await Promise.all([exchange(form), exchange(form)])
      expect(results.filter((r) => r.status === 200).length).toBeLessThanOrEqual(1)
      expect(results.some((r) => r.status === 400)).toBe(true)
      await expectEverythingDead(results.map((r) => r.body))
    }
  })
})

describe('saving tokens into a family that ends', () => {
  const saving = async () => {
    const { createOAuthModel } = await import('../../data/oauth/model')
    const { revokeFamily } = await import('../../data/oauth/credentials')
    const client = onlyDoc(
      await payload.find({
        collection: 'oauth-clients',
        where: { clientId: { equals: clientId } },
        overrideAccess: true,
      }),
    )
    const family = `family-${Math.random().toString(36).slice(2)}`
    const save = () =>
      createOAuthModel(payload, RESOURCE).saveToken?.(
        {
          accessToken: `sea_${family}`,
          accessTokenExpiresAt: new Date(Date.now() + 60_000),
          refreshToken: `ser_${family}`,
          refreshTokenExpiresAt: new Date(Date.now() + 120_000),
          scope: ['read'],
        },
        { id: clientId, grants: [], credentialClientId: client.id },
        { agentId: 1, consentedBy: 1, resource: RESOURCE, family },
      )
    const rowsOf = async () =>
      (
        await payload.find({
          collection: 'oauth-tokens',
          where: { family: { equals: family } },
          limit: 10,
          depth: 0,
          overrideAccess: true,
        })
      ).docs
    return { family, save, rowsOf, revokeFamily }
  }

  it('saves nothing into a family that already ended', async () => {
    const { family, save, rowsOf, revokeFamily } = await saving()
    await save()
    expect((await rowsOf()).map((row) => row.kind).sort()).toEqual(['access', 'refresh'])
    await revokeFamily(payload, family)
    await expect(save()).rejects.toMatchObject({ name: 'invalid_grant' })
    expect((await rowsOf()).length).toBe(2)
  })

  it('revokes what it saved when the family ends between its saves, and gives no tokens', async () => {
    const { family, save, rowsOf, revokeFamily } = await saving()
    const create = payload.create.bind(payload)
    let first = true
    vi.spyOn(payload, 'create').mockImplementation((async (args: never) => {
      const made = await create(args)
      // The other request's revocation lands right after this request saved its first row
      if (first) {
        first = false
        await revokeFamily(payload, family)
      }
      return made
    }) as typeof payload.create)
    await expect(save()).rejects.toMatchObject({ name: 'invalid_grant' })
    const rows = await rowsOf()
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.revokedAt)).toBe(true)
  })
})

describe('a family with one revoked row', () => {
  it('is dead in every row, checked on each use, even if the other rows were never marked', async () => {
    const issued = (await signIn(payload, admin, clientId)).body
    expect(await accepted(issued.access_token)).toBe(true)
    // One row revoked straight in the database, as the saving race can leave it: no hook runs
    // and the other rows keep their own `revokedAt` empty
    const refresh = onlyDoc(
      await payload.find({
        collection: 'oauth-tokens',
        where: { kind: { equals: 'refresh' }, revokedAt: { exists: false } },
        sort: '-id',
        limit: 1,
        depth: 0,
        overrideAccess: true,
      }),
    )
    await payload.db.updateOne({
      collection: 'oauth-tokens',
      id: refresh.id,
      data: { revokedAt: new Date().toISOString() },
    })
    expect(await accepted(issued.access_token)).toBe(false)
    const other = (await signIn(payload, admin, clientId)).body
    // Another family is untouched
    expect(await accepted(other.access_token)).toBe(true)
  })

  it('cannot be refreshed through a row that was never marked either', async () => {
    const issued = (await signIn(payload, admin, clientId)).body
    const access = onlyDoc(
      await payload.find({
        collection: 'oauth-tokens',
        where: { kind: { equals: 'access' }, revokedAt: { exists: false } },
        sort: '-id',
        limit: 1,
        depth: 0,
        overrideAccess: true,
      }),
    )
    await payload.db.updateOne({
      collection: 'oauth-tokens',
      id: access.id,
      data: { revokedAt: new Date().toISOString() },
    })
    // The model refuses it before the library goes on to spend it
    const { createOAuthModel } = await import('../../data/oauth/model')
    expect(
      await createOAuthModel(payload, RESOURCE).getRefreshToken?.(issued.refresh_token ?? ''),
    ).toBe(false)
    const renewed = await exchange({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: issued.refresh_token,
    })
    expect(renewed.body.error).toBe('invalid_grant')
  })
})
