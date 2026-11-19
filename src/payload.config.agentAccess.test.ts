import { REST_GET } from '@payloadcms/next/routes'
import type { Payload, SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  type Account,
  bootPayload,
  createAccount,
  NO_REVALIDATE,
  paragraph,
  testPassword,
} from '@/platform/payload/testing/inMemoryPayload'
import { createMcpKey, mcpClient } from '@/platform/payload/testing/mcpRequest'

/**
 * Agent access through Payload's MCP plugin at `/api/mcp` (#336), with real requests to Payload
 * booted on an in-memory SQLite database: an agent's key can find published events, posts and
 * categories, use its two tools and keep its own run history, and nothing else. The tools
 * themselves are tested in `payload.config.agentTools.test.ts`.
 */

let config: SanitizedConfig
let payload: Payload
let admin: Account
let agent: Account
let mcp: ReturnType<typeof mcpClient>

const KEY = 'agent-key-for-tests-0123456789abcdef'
const SOURCE = { sourceName: 'City of Madison', sourceUrl: 'https://www.cityofmadison.com/e/7' }
const RUN = {
  agentName: 'Scout',
  pipelineVersion: 1,
  repoCommit: 'a'.repeat(40),
  startedAt: '2026-10-24T11:00:00.000Z',
  status: 'running' as const,
}

beforeAll(async () => {
  ;({ payload, config } = await bootPayload())
  mcp = mcpClient(config)
  admin = await createAccount(payload, 'admin', 'ana')
  agent = await createAccount(payload, 'agent', 'scout')
  await createMcpKey(payload, admin, agent.id, KEY)

  // A published post by a named author, a published event and a suggested draft
  const published = { _status: 'published' as const }
  await payload.create({
    collection: 'posts',
    data: {
      title: 'Road work',
      slug: 'road-work',
      authors: [admin.id],
      content: paragraph('Lanes closed on Sprecher Rd.'),
      ...published,
    },
    overrideAccess: true,
    context: NO_REVALIDATE,
  })
  await payload.create({
    collection: 'events',
    data: { title: 'Park cleanup', slug: 'park-cleanup', date: '2026-11-07', ...published },
    overrideAccess: true,
    context: NO_REVALIDATE,
  })
  await payload.create({
    collection: 'events',
    data: { title: 'Hidden draft', slug: 'hidden-draft', date: '2026-11-08', ...SOURCE },
    user: agent,
    overrideAccess: true,
  })
}, 60_000)

const text = async (name: string, args: Record<string, unknown> = {}) =>
  (await mcp.tool(name, args, KEY)).text

describe('an agent key over /api/mcp', () => {
  it('is offered only find, its two tools and its own runs', async () => {
    const { body } = await mcp.call('tools/list', {}, KEY)
    const names = (body.result.tools as { name: string }[]).map((t) => t.name).sort()
    expect(names).toEqual(
      [
        'createAgentRuns',
        'findAgentRuns',
        'findCategories',
        'findEvents',
        'findPosts',
        'reportItem',
        'submitSuggestion',
        'updateAgentRuns',
      ].sort(),
    )
  })

  it('finds published events only, never a draft', async () => {
    expect(await text('findEvents', { limit: 50 })).toContain('Park cleanup')
    expect(await text('findEvents', { limit: 50 })).not.toContain('Hidden draft')
    expect(await text('findEvents', { draft: true, limit: 50 })).not.toContain('Hidden draft')
    expect(await text('findCategories')).toContain('Total:')
  })

  it('never shows personal data, even when it asks for it', async () => {
    const answer = await text('findPosts', { depth: 3, limit: 50 })
    expect(answer).toContain('Road work')
    expect(answer).not.toMatch(/ana|example\.com|populatedAuthors|authors/i)
    const where = JSON.stringify({ 'authors.email': { equals: 'ana@example.com' } })
    expect(await text('findPosts', { where })).not.toContain('Road work')
  })

  it('keeps run history that only it can see, recorded as its own', async () => {
    const other = await createAccount(payload, 'agent', 'other-agent')
    await payload.create({
      collection: 'agent-runs',
      data: { ...RUN, runId: 'other-1', agentName: 'Other' },
      user: other,
      overrideAccess: false,
    })
    const sourcesChecked = [
      {
        sourceId: 'city-calendar',
        fetchStrategy: 'direct',
        cursor: '2026-10-24T10:00:00Z',
        status: 'ok',
        error: null,
      },
    ]
    const created = await text('createAgentRuns', {
      ...RUN,
      runId: 'scout-1',
      sourcesChecked,
      agent: admin.id,
    })
    expect(created).toContain(`"agent":${agent.id}`)
    const runs = await text('findAgentRuns', { limit: 50 })
    expect(runs).not.toContain('Other')
    // A restarted run finds where it stopped: its run id, commit and source cursors
    const [mine] = runs
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as Record<string, unknown>)
    expect(mine).toMatchObject({
      runId: 'scout-1',
      pipelineVersion: 1,
      repoCommit: RUN.repoCommit,
      sourcesChecked: [
        expect.objectContaining({ sourceId: 'city-calendar', cursor: '2026-10-24T10:00:00Z' }),
      ],
    })
  })
})

describe('an agent account outside MCP', () => {
  it('can’t update, publish or delete content', async () => {
    const { docs } = await payload.find({
      collection: 'events',
      where: { slug: { equals: 'park-cleanup' } },
      overrideAccess: true,
    })
    const id = docs[0].id
    const data = { title: 'Changed', _status: 'published' as const }
    await expect(
      payload.update({ collection: 'events', id, data, user: agent, overrideAccess: false }),
    ).rejects.toThrow()
    await expect(
      payload.delete({ collection: 'events', id, user: agent, overrideAccess: false }),
    ).rejects.toThrow()
  })

  it('can’t read accounts or contact messages', async () => {
    for (const collection of ['users', 'form-submissions'] as const) {
      await expect(
        payload.find({ collection, user: agent, overrideAccess: false }),
      ).rejects.toThrow()
    }
  })

  it('can’t sign in with a password', async () => {
    const data = { email: agent.email, password: testPassword('scout') }
    await expect(payload.login({ collection: 'users', data })).rejects.toThrow()
  })
})

describe('API keys', () => {
  it('bind only to agent accounts', async () => {
    await expect(
      createMcpKey(payload, admin, admin.id, 'admin-key-for-tests-0123456789abcdef'),
    ).rejects.toThrow(/invalid: User/)
  })

  it('stop working once the account is no longer an agent', async () => {
    const former = await createAccount(payload, 'agent', 'former')
    const key = 'former-key-for-tests-0123456789abcdef'
    await createMcpKey(payload, admin, former.id, key)
    await payload.update({
      collection: 'users',
      id: former.id,
      data: { role: 'editor' },
      overrideAccess: true,
    })
    expect((await mcp.call('tools/list', {}, key)).status).toBe(401)
  })

  it('reach no account over REST when used as the key itself', async () => {
    const request = new Request(`http://localhost:3000/api/users/${admin.id}`, {
      headers: { Authorization: `payload-mcp-api-keys API-Key ${KEY}` },
    })
    const response = await REST_GET(Promise.resolve(config))(request, {
      params: Promise.resolve({ slug: ['users', String(admin.id)] }),
    })
    expect(response.status).not.toBe(200)
    expect(await response.text()).not.toContain('ana@example.com')
  })

  it('are limited per key, then answer 429', async () => {
    const key = 'busy-key-for-tests-0123456789abcdef'
    const busy = await createAccount(payload, 'agent', 'busy')
    await createMcpKey(payload, admin, busy.id, key)
    const statuses: number[] = []
    for (let i = 0; i < 61; i++) statuses.push((await mcp.call('tools/list', {}, key)).status)
    expect(statuses.slice(0, 60).every((s) => s === 200)).toBe(true)
    expect(statuses[60]).toBe(429)
  })
})
