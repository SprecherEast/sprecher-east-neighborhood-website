import { GRAPHQL_POST, REST_GET, REST_PATCH, REST_POST } from '@payloadcms/next/routes'
import type { Payload, SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  type Account,
  bootPayload,
  createAccount,
  signIn,
} from '@/platform/payload/testing/inMemoryPayload'
import { createMcpKey, mcpClient } from '@/platform/payload/testing/mcpRequest'

/**
 * What an agent key, the key acting as itself, a resident and a visitor can't do (#336), over
 * REST, GraphQL and MCP on Payload booted on in-memory SQLite. Adapted from the reviewer's
 * probes on #357.
 */

let config: SanitizedConfig
let payload: Payload
let admin: Account
let agent: Account
let other: Account
let mcp: ReturnType<typeof mcpClient>
let myRun = 0
let otherRun = 0
let keyId = 0

const KEY = 'probe-key-for-tests-0123456789abcdef'
const SECRET = 'OTHER-AGENT-SECRET'
const RUN = {
  agentName: 'Scout',
  pipelineVersion: 1,
  repoCommit: 'a'.repeat(40),
  startedAt: '2026-10-24T11:00:00.000Z',
  status: 'running' as const,
}
const AS_KEY = { Authorization: `payload-mcp-api-keys API-Key ${KEY}` }

type Method = 'GET' | 'POST' | 'PATCH'
const HANDLERS = { GET: REST_GET, POST: REST_POST, PATCH: REST_PATCH }
async function rest(method: Method, path: string, headers: object, body?: unknown) {
  const request = new Request(`http://localhost:3000/api/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const slug = path.split('?')[0].split('/')
  const response = await HANDLERS[method](Promise.resolve(config))(request, {
    params: Promise.resolve({ slug }),
  })
  return { status: response.status, text: await response.text() }
}
async function graphql(query: string, headers: object) {
  const request = new Request('http://localhost:3000/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ query }),
  })
  return (await GRAPHQL_POST(Promise.resolve(config))(request)).text()
}
const tool = (name: string, args: Record<string, unknown>) => mcp.tool(name, args, KEY)
const storedRun = (id: number) =>
  payload.findByID({ collection: 'agent-runs', id, depth: 0, overrideAccess: true })

beforeAll(async () => {
  ;({ payload, config } = await bootPayload())
  mcp = mcpClient(config)
  admin = await createAccount(payload, 'admin', 'ana')
  agent = await createAccount(payload, 'agent', 'scout')
  other = await createAccount(payload, 'agent', 'other')
  keyId = (await createMcpKey(payload, admin, agent.id, KEY)).id as number
  const create = (user: Account, runId: string) =>
    payload.create({
      collection: 'agent-runs',
      data: { ...RUN, runId },
      user,
      overrideAccess: false,
    })
  myRun = (await create(agent, 'mine-1')).id
  otherRun = (await create(other, 'other-1')).id
  await payload.create({
    collection: 'agent-review-items',
    data: { run: otherRun, kind: 'needs-review', summary: SECRET, sourceUrl: 'https://e.com/1' },
    user: other,
    overrideAccess: false,
  })
}, 60_000)

describe('an MCP API key acting as itself', () => {
  it.each([
    'users',
    'form-submissions',
    'payload-mcp-api-keys',
    'payload-preferences',
    'payload-locked-documents',
    'payload-jobs',
    'agent-runs',
    'agent-review-items',
  ])('is refused %s over REST', async (path) => {
    expect((await rest('GET', path, AS_KEY)).status).toBe(403)
  })

  it('can’t create content or re-bind itself to another account', async () => {
    const event = {
      title: 'K',
      slug: 'k',
      date: '2026-11-09',
      sourceName: 'x',
      sourceUrl: 'https://e.com',
    }
    expect((await rest('POST', 'events', AS_KEY, event)).status).toBe(403)
    expect(
      (await rest('PATCH', `payload-mcp-api-keys/${keyId}`, AS_KEY, { user: admin.id })).status,
    ).toBe(403)
    const key = await payload.findByID({
      collection: 'payload-mcp-api-keys',
      id: keyId,
      depth: 0,
      overrideAccess: true,
    })
    expect(key.user).toBe(agent.id)
  })

  it('reads nothing private over GraphQL', async () => {
    const text = await graphql(
      '{ Users { docs { email } } AgentReviewItems { docs { summary } } }',
      AS_KEY,
    )
    expect(text).not.toMatch(/example\.com|OTHER-AGENT/)
  })
})

describe('an agent key over MCP', () => {
  it('can’t read or change another agent’s run, even in bulk', async () => {
    expect((await tool('findAgentRuns', { id: otherRun })).text).toMatch(/not found/i)
    const where = JSON.stringify({ id: { exists: true } })
    await tool('updateAgentRuns', { where, status: 'failed' })
    await tool('updateAgentRuns', { id: otherRun, status: 'failed' })
    expect((await storedRun(otherRun)).status).toBe('running')
    expect((await storedRun(myRun)).status).toBe('failed')
    const report = { runId: 'other-1', kind: 'needs-review', summary: 's', evidence: [], flags: [] }
    expect((await tool('reportItem', { ...report, sourceUrl: 'https://e.com' })).isError).toBe(true)
  })

  it('can’t rewrite its run’s identity after it starts', async () => {
    await tool('updateAgentRuns', {
      id: myRun,
      runId: 'renamed',
      agentName: 'Renamed',
      pipelineVersion: 9,
      repoCommit: 'b'.repeat(40),
      startedAt: '2020-01-01T00:00:00.000Z',
      agent: other.id,
      status: 'succeeded',
    })
    expect(await storedRun(myRun)).toMatchObject({
      ...RUN,
      runId: 'mine-1',
      agent: agent.id,
      status: 'succeeded',
    })
  })

  it('is refused without a key, with a wrong one, or once disabled', async () => {
    expect((await mcp.call('tools/list', {}, '')).status).toBe(401)
    expect((await mcp.call('tools/list', {}, 'wrong-key-0123456789')).status).toBe(401)
    const owner = await createAccount(payload, 'agent', 'disabled')
    const key = 'disabled-key-for-tests-0123456789abcdef'
    const doc = await createMcpKey(payload, admin, owner.id, key)
    expect((await mcp.call('tools/list', {}, key)).status).toBe(200)
    const data = { enableAPIKey: false }
    await payload.update({
      collection: 'payload-mcp-api-keys',
      id: doc.id,
      data,
      user: admin,
      overrideAccess: false,
    })
    expect((await mcp.call('tools/list', {}, key)).status).toBe(401)
  })
})

describe('a resident', () => {
  it('reaches no runs, review items or keys, and can’t make a key or use MCP', async () => {
    const resident = await createAccount(payload, 'resident', 'rita')
    const token = await signIn(payload, resident)
    const asResident = { Authorization: `JWT ${token}` }
    for (const path of ['agent-runs', 'agent-review-items', 'payload-mcp-api-keys']) {
      expect((await rest('GET', path, asResident)).status).toBe(403)
    }
    const key = {
      user: resident.id,
      enableAPIKey: true,
      apiKey: 'resident-key-0123456789abcdefghij',
    }
    expect((await rest('POST', 'payload-mcp-api-keys', asResident, key)).status).toBe(403)
    expect((await rest('POST', 'agent-runs', asResident, { ...RUN, runId: 'r' })).status).toBe(403)
    expect((await mcp.call('tools/list', {}, token ?? '')).status).toBe(401)
  })
})
