import type { Payload, SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
  bootPayload,
  createAccount,
  type Account,
} from '@/platform/payload/testing/inMemoryPayload'
import { createMcpKey, mcpClient } from '@/platform/payload/testing/mcpRequest'

import { bearerChallenge } from '../../domain/oauth/metadata'
import { hashToken } from '../../domain/oauth/secrets'
import { exchange, RESOURCE, registerClient, signIn, onlyDoc } from '../../testing/oauthFlow'

/**
 * An OAuth access token at `/api/mcp` (#1501): it acts as the client's agent account with the
 * access an API key has, nothing else is let in, and the API-key path is unchanged. Every
 * refusal is a 401 that points at the protected-resource metadata.
 */

vi.mock('server-only', () => ({}))

let config: SanitizedConfig
let payload: Payload
let admin: Account
let agent: Account
let clientId: string
let mcp: ReturnType<typeof mcpClient>

const ORIGIN = new URL(RESOURCE).origin
const KEY = 'oauth-suite-key-0123456789abcdef'

beforeAll(async () => {
  ;({ payload, config } = await bootPayload())
  mcp = mcpClient(config)
  admin = await createAccount(payload, 'admin', 'ana')
  agent = await createAccount(payload, 'agent', 'scout')
  clientId = await registerClient(payload, admin, agent)
  await createMcpKey(payload, admin, agent.id, KEY)
  await payload.create({
    collection: 'categories',
    data: { title: 'Story time', slug: 'story-time' },
  })
  await payload.create({
    collection: 'agent-runs',
    data: {
      runId: 'oauth-run',
      agentName: 'Scout',
      pipelineVersion: 1,
      repoCommit: 'a'.repeat(40),
      status: 'running',
      startedAt: '2026-10-24T11:00:00.000Z',
    },
    user: agent,
    overrideAccess: false,
  })
}, 60_000)

const accessToken = async () => (await signIn(payload, admin, clientId)).body.access_token
const toolNames = async (token: string | null) => {
  const { status, body } = await mcp.call('tools/list', {}, token)
  return {
    status,
    names: (body?.result?.tools ?? []).map((t: { name: string }) => t.name).sort() as string[],
  }
}
const row = async (kind: string, token: string) =>
  onlyDoc(
    await payload.find({
      collection: 'oauth-tokens',
      where: { tokenHash: { equals: hashToken(token, payload.secret) }, kind: { equals: kind } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
  )

describe('a valid access token', () => {
  it('offers the same tools as an API key for the same agent', async () => {
    const viaToken = await toolNames(await accessToken())
    const viaKey = await toolNames(KEY)
    expect(viaToken.status).toBe(200)
    expect(viaToken.names).toEqual(viaKey.names)
    expect(viaToken.names).toContain('submitSuggestion')
  })

  it('offers no way to create or change content, only to read it and to suggest drafts', async () => {
    const { names } = await toolNames(await accessToken())
    expect(names.filter((name) => /^(create|update|delete)/.test(name))).toEqual([
      'createAgentRuns',
      'updateAgentRuns',
    ])
    expect(names).toEqual(expect.arrayContaining(['findPosts', 'findEvents', 'submitSuggestion']))
  })

  it('reads published content as the agent account', async () => {
    const found = await mcp.tool('findPosts', {}, await accessToken())
    expect(found.isError).toBe(false)
  })

  it('can suggest a draft but never publish', async () => {
    const token = await accessToken()
    const { text, isError } = await mcp.tool(
      'submitSuggestion',
      {
        collection: 'events',
        title: 'Cleanup day',
        bodyMarkdown: 'Bring gloves.',
        summary: 'A park cleanup.',
        categories: ['story-time'],
        startsAt: '2027-05-01T15:00:00-05:00',
        externalId: 'city:oauth-1',
        contentHash: 'b'.repeat(64),
        audience: ['families'],
        runId: 'oauth-run',
        sourceName: 'City',
        sourceUrl: 'https://example.com/e',
      },
      token,
    )
    expect(isError, text).toBe(false)
    const { id, status } = JSON.parse(text) as { id: number; status: string }
    expect(status).toBe('created')
    const stored = await payload.findByID({
      collection: 'events',
      id,
      draft: true,
      overrideAccess: true,
    })
    expect(stored).toMatchObject({ _status: 'draft', moderationStatus: 'suggested' })
  })
})

describe('a request that is not let in', () => {
  const expectChallenge = (result: Awaited<ReturnType<typeof mcp.call>>) => {
    expect(result.status).toBe(401)
    expect(result.headers.get('WWW-Authenticate')).toBe(bearerChallenge(ORIGIN))
  }

  it('without a token gets a 401 that points at the protected-resource metadata', async () => {
    expectChallenge(await mcp.call('tools/list', {}, null))
  })

  it('with an unknown token, a wrong API key or a malformed header gets the same', async () => {
    expectChallenge(await mcp.call('tools/list', {}, 'sea_unknown'))
    expectChallenge(await mcp.call('tools/list', {}, 'not-a-key'))
    expectChallenge(await mcp.call('tools/list', {}, ''))
  })

  it('refuses a refresh token presented as an access token', async () => {
    const { body } = await signIn(payload, admin, clientId)
    expectChallenge(await mcp.call('tools/list', {}, body.refresh_token))
  })

  it('refuses a token issued for another audience', async () => {
    const token = await accessToken()
    const stored = await row('access', token)
    await payload.update({
      collection: 'oauth-tokens',
      id: stored.id,
      data: {},
      overrideAccess: true,
    })
    await payload.db.updateOne({
      collection: 'oauth-tokens',
      id: stored.id,
      data: { resource: 'https://sprechereast.com/api/graphql' },
    })
    expectChallenge(await mcp.call('tools/list', {}, token))
  })

  it('refuses an expired token', async () => {
    const token = await accessToken()
    const stored = await row('access', token)
    await payload.db.updateOne({
      collection: 'oauth-tokens',
      id: stored.id,
      data: { expiresAt: new Date(Date.now() - 1000).toISOString() },
    })
    expectChallenge(await mcp.call('tools/list', {}, token))
  })

  it('refuses a token an admin revoked, and signs out the refresh token with it', async () => {
    const { body } = await signIn(payload, admin, clientId)
    const stored = await row('access', body.access_token)
    await payload.update({
      collection: 'oauth-tokens',
      id: stored.id,
      data: { revokedAt: new Date().toISOString() },
      user: admin,
      overrideAccess: false,
    })
    expectChallenge(await mcp.call('tools/list', {}, body.access_token))
    const refreshed = await exchange({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: body.refresh_token,
    })
    expect(refreshed.body.error).toBe('invalid_grant')
  })

  it('refuses every token of a client an admin switched off', async () => {
    const own = await registerClient(payload, admin, agent, { name: 'Switch' })
    const { body } = await signIn(payload, admin, own)
    expect((await mcp.call('tools/list', {}, body.access_token)).status).toBe(200)
    const found = await payload.find({
      collection: 'oauth-clients',
      where: { clientId: { equals: own } },
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
    expectChallenge(await mcp.call('tools/list', {}, body.access_token))
  })

  it('refuses a token whose account is no longer an agent', async () => {
    const promoted = await createAccount(payload, 'agent', 'drift')
    const own = await registerClient(payload, admin, promoted, { name: 'Drift' })
    const { body } = await signIn(payload, admin, own)
    expect((await mcp.call('tools/list', {}, body.access_token)).status).toBe(200)
    await payload.db.updateOne({ collection: 'users', id: promoted.id, data: { role: 'editor' } })
    expectChallenge(await mcp.call('tools/list', {}, body.access_token))
  })

  it('counts a client`s requests, and answers 429 past the limit', async () => {
    const busy = await createAccount(payload, 'agent', 'busy')
    const own = await registerClient(payload, admin, busy, { name: 'Busy' })
    const token = (await signIn(payload, admin, own)).body.access_token
    const statuses: number[] = []
    for (let i = 0; i < 61; i++) statuses.push((await mcp.call('tools/list', {}, token)).status)
    expect(statuses.slice(0, 60).every((s) => s === 200)).toBe(true)
    expect(statuses[60]).toBe(429)
  }, 60_000)
})

describe('the API-key path', () => {
  it('still works unchanged, and a refused key now also points at the metadata', async () => {
    expect((await mcp.call('tools/list', {}, KEY)).status).toBe(200)
    const denied = await mcp.call('tools/list', {}, 'agent-key-that-does-not-exist-0123456789')
    expect(denied.status).toBe(401)
  })
})
