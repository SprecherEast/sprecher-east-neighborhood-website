import type { Payload, SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
  bootPayload,
  createAccount,
  type Account,
} from '@/platform/payload/testing/inMemoryPayload'
import { mcpClient } from '@/platform/payload/testing/mcpRequest'

import { bearerChallenge, insufficientScopeChallenge } from '../domain/oauth/metadata'
import { exchange, onlyDoc, registerClient, RESOURCE, signIn } from '../testing/oauthFlow'

/**
 * Per-client scopes at `/api/mcp` (#1499): two clients (OAuth or key) with different scopes get
 * different results for the same call, a scope only narrows, and one client can be narrowed,
 * expired or switched off without touching the others. Every call runs through the real REST
 * handler, as an AI tool's request does.
 */

vi.mock('server-only', () => ({}))

let config: SanitizedConfig
let payload: Payload
let admin: Account
let mcp: ReturnType<typeof mcpClient>

const ORIGIN = new URL(RESOURCE).origin
const PAST = '2020-01-01T00:00:00.000Z'
const FUTURE = '2099-01-01T00:00:00.000Z'
const READ = ['findCategories', 'findEvents', 'findPosts']
const SUGGEST = [
  'createAgentRuns',
  'findAgentRuns',
  'reportItem',
  'submitSuggestion',
  'updateAgentRuns',
]

const suggestion = (n: number) => ({
  collection: 'events',
  title: `Cleanup ${n}`,
  bodyMarkdown: 'Bring gloves.',
  summary: 'A park cleanup.',
  categories: ['story-time'],
  startsAt: '2027-05-01T15:00:00-05:00',
  externalId: `city:scope-${n}`,
  contentHash: String(n).repeat(64).slice(0, 64),
  audience: ['families'],
  runId: 'scope-run-suggester',
  sourceName: 'City',
  sourceUrl: 'https://example.com/e',
})

type Client = { agent: Account; clientId: string; token: string; refresh: string }
const connect = async (name: string, scopes: ('read' | 'suggest')[], asked?: string) => {
  const agent = await createAccount(payload, 'agent', name)
  await payload.create({
    collection: 'agent-runs',
    data: {
      runId: `scope-run-${name}`,
      agentName: name,
      pipelineVersion: 1,
      repoCommit: 'a'.repeat(40),
      status: 'running',
      startedAt: '2026-10-24T11:00:00.000Z',
    },
    user: agent,
    overrideAccess: false,
  })
  const clientId = await registerClient(payload, admin, agent, { scopes, name })
  const { body } = await signIn(payload, admin, clientId, asked ?? scopes.join(' '))
  return { agent, clientId, token: body.access_token, refresh: body.refresh_token } as Client
}
const clientDoc = async (clientId: string) =>
  onlyDoc(
    await payload.find({
      collection: 'oauth-clients',
      where: { clientId: { equals: clientId } },
      limit: 1,
      overrideAccess: true,
    }),
  )
const setClient = async (clientId: string, data: Record<string, unknown>) =>
  payload.update({
    collection: 'oauth-clients',
    id: (await clientDoc(clientId)).id,
    data,
    user: admin,
    overrideAccess: false,
  })
const names = (token: string) => mcp.tools(token)

let reader: Client
let suggester: Client

beforeAll(async () => {
  ;({ payload, config } = await bootPayload())
  mcp = mcpClient(config)
  admin = await createAccount(payload, 'admin', 'ana')
  await payload.create({
    collection: 'categories',
    data: { title: 'Story time', slug: 'story-time' },
  })
  reader = await connect('reader', ['read'])
  suggester = await connect('suggester', ['read', 'suggest'])
}, 120_000)

describe('two clients with different scopes', () => {
  it('are offered different tools', async () => {
    expect((await names(reader.token)).tools).toEqual(READ)
    expect((await names(suggester.token)).tools).toEqual([...READ, ...SUGGEST].sort())
  })

  it('get different results for the same call: one suggests, the other is told what it lacks', async () => {
    const refused = await mcp.call(
      'tools/call',
      { name: 'submitSuggestion', arguments: suggestion(1) },
      reader.token,
    )
    expect(refused.status).toBe(403)
    expect(refused.headers.get('WWW-Authenticate')).toBe(
      insufficientScopeChallenge(ORIGIN, 'suggest'),
    )
    const allowed = await mcp.tool('submitSuggestion', suggestion(2), suggester.token)
    expect(allowed.isError, allowed.text).toBe(false)
  })

  it('refuse every tool of a scope the client lacks, with the scope named', async () => {
    for (const name of SUGGEST) {
      const refused = await mcp.call('tools/call', { name, arguments: {} }, reader.token)
      expect(refused.status, name).toBe(403)
      expect(refused.headers.get('WWW-Authenticate')).toContain('scope="suggest"')
    }
  })

  it('both read the same published content', async () => {
    for (const client of [reader, suggester]) {
      const found = await mcp.tool('findCategories', {}, client.token)
      expect(found.isError).toBe(false)
    }
  })

  it('never reach a draft: the account’s own access stays the final word', async () => {
    await payload.create({
      collection: 'events',
      data: {
        title: 'Hidden draft',
        slug: 'hidden-draft',
        date: '2027-06-01T00:00:00.000Z',
        _status: 'draft',
      },
      draft: true,
    })
    for (const client of [reader, suggester]) {
      const found = await mcp.tool('findEvents', {}, client.token)
      expect(found.text).not.toContain('Hidden draft')
    }
  })

  it('cannot create, change or delete events, posts or categories, whatever the scopes', async () => {
    for (const tool of ['createEvents', 'updatePosts', 'deleteCategories', 'publishEvents']) {
      const refused = await mcp.call('tools/call', { name: tool, arguments: {} }, suggester.token)
      expect(refused.status, tool).not.toBe(403)
      expect(JSON.stringify(refused.body)).toMatch(/not found|unknown|disabled|error/i)
    }
    const { tools } = await names(suggester.token)
    expect(tools.filter((t) => /^(create|update|delete)/.test(t))).toEqual([
      'createAgentRuns',
      'updateAgentRuns',
    ])
  })
})

describe('what a token is given', () => {
  it('is no more than the client’s record allows, whatever it asks for', async () => {
    const asked = await connect('narrow', ['read'], 'read suggest')
    expect(asked.token).toBeTruthy()
    expect((await names(asked.token)).tools).toEqual(READ)
  })

  it('is no more than the token was given, when the record is widened later', async () => {
    const small = await connect('small', ['read'])
    await setClient(small.clientId, { scopes: ['read', 'suggest'] })
    expect((await names(small.token)).tools).toEqual(READ)
    const refused = await mcp.call('tools/call', { name: 'reportItem', arguments: {} }, small.token)
    expect(refused.status).toBe(403)
  })
})

describe('narrowing, expiring and switching off one client', () => {
  it('applies a narrowed record on the very next request, to the token already issued', async () => {
    const wide = await connect('wide', ['read', 'suggest'])
    expect((await names(wide.token)).tools).toEqual([...READ, ...SUGGEST].sort())
    await setClient(wide.clientId, { scopes: ['read'] })
    expect((await names(wide.token)).tools).toEqual(READ)
    expect(
      (await mcp.call('tools/call', { name: 'submitSuggestion', arguments: {} }, wide.token))
        .status,
    ).toBe(403)
  })

  it('stops a switched-off client at once and leaves the others working', async () => {
    const doomed = await connect('doomed', ['read'])
    await setClient(doomed.clientId, { enabled: false })
    const stopped = await mcp.call('tools/list', {}, doomed.token)
    expect(stopped.status).toBe(401)
    expect(stopped.headers.get('WWW-Authenticate')).toBe(bearerChallenge(ORIGIN))
    expect((await names(reader.token)).status).toBe(200)
    expect((await names(suggester.token)).status).toBe(200)
  })

  it('stops an expired client, its refresh token too, and leaves the others working', async () => {
    const brief = await connect('brief', ['read'])
    await setClient(brief.clientId, { expiresAt: PAST })
    expect((await mcp.call('tools/list', {}, brief.token)).status).toBe(401)
    const refreshed = await exchange({
      grant_type: 'refresh_token',
      client_id: brief.clientId,
      refresh_token: brief.refresh,
    })
    expect(refreshed.body.error).toMatch(/^invalid_(client|grant)$/)
    expect((await names(reader.token)).status).toBe(200)
    // An admin who sets a later time lets the client work again
    await setClient(brief.clientId, { expiresAt: FUTURE })
    expect((await names(brief.token)).status).toBe(200)
  })
})
