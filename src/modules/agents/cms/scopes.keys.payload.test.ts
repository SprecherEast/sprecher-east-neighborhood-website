import type { Payload, SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
  bootPayload,
  createAccount,
  type Account,
} from '@/platform/payload/testing/inMemoryPayload'
import { createMcpKey, mcpClient } from '@/platform/payload/testing/mcpRequest'

/**
 * Scopes on an MCP API key (#1499), the same rules as on an OAuth client
 * (`scopes.payload.test.ts`): a key's scopes narrow its own boxes, never widen them, an expired or
 * switched-off key stops, and no key is saved with none. Every call runs through the real REST
 * handler.
 */

vi.mock('server-only', () => ({}))

let config: SanitizedConfig
let payload: Payload
let admin: Account
let mcp: ReturnType<typeof mcpClient>

const READ = ['findCategories', 'findEvents', 'findPosts']
const SUGGEST = [
  'createAgentRuns',
  'findAgentRuns',
  'reportItem',
  'submitSuggestion',
  'updateAgentRuns',
]
/** Leaves the scopes out, as the Admin form can: the default fills them in */
const NO_SCOPES = {} as { scopes: never }
const PAST = '2020-01-01T00:00:00.000Z'
const names = (token: string) => mcp.tools(token)

beforeAll(async () => {
  ;({ payload, config } = await bootPayload())
  mcp = mcpClient(config)
  admin = await createAccount(payload, 'admin', 'ana')
}, 60_000)

describe('an API key', () => {
  const key = (n: number) => `scope-suite-key-${n}-0123456789abcdef`
  const keyOf = async (n: number, extra: Parameters<typeof createMcpKey>[4]) =>
    createMcpKey(
      payload,
      admin,
      (await createAccount(payload, 'agent', `key${n}`)).id,
      key(n),
      extra,
    )

  it('with read only is offered the read tools and told what it lacks', async () => {
    await keyOf(1, { scopes: ['read'] })
    expect((await names(key(1))).tools).toEqual(READ)
    const refused = await mcp.call(
      'tools/call',
      { name: 'submitSuggestion', arguments: {} },
      key(1),
    )
    expect(refused.status).toBe(403)
  })

  it('with every scope has what it had before scopes, and nothing more', async () => {
    await keyOf(2, { scopes: ['read', 'suggest'] })
    expect((await names(key(2))).tools).toEqual([...READ, ...SUGGEST].sort())
  })

  it('never has a tool whose own box is not ticked, whatever its scopes', async () => {
    const owner = await createAccount(payload, 'agent', 'key3')
    await payload.create({
      collection: 'payload-mcp-api-keys',
      data: {
        user: owner.id,
        label: 'Boxes',
        enableAPIKey: true,
        apiKey: key(3),
        events: { find: true },
        'payload-mcp-tool': { reportItem: true, submitSuggestion: false },
        scopes: ['read', 'suggest'],
      },
      user: admin,
      overrideAccess: false,
    })
    expect((await names(key(3))).tools).toEqual(['findEvents', 'reportItem'])
  })

  it('is refused after its expiry, and another key is not', async () => {
    await keyOf(4, { scopes: ['read'], expiresAt: PAST })
    const refused = await mcp.call('tools/list', {}, key(4))
    expect(refused.status).toBe(401)
    expect((await names(key(2))).status).toBe(200)
  })

  it('stops at once when an admin switches it off, and another key keeps working', async () => {
    const doc = await keyOf(5, { scopes: ['read'] })
    expect((await names(key(5))).status).toBe(200)
    await payload.update({
      collection: 'payload-mcp-api-keys',
      id: doc.id,
      data: { enableAPIKey: false },
      user: admin,
      overrideAccess: false,
    })
    expect((await mcp.call('tools/list', {}, key(5))).status).toBe(401)
    expect((await names(key(2))).status).toBe(200)
  })

  it('applies a narrowed record on its next request', async () => {
    const doc = await keyOf(6, { scopes: ['read', 'suggest'] })
    expect((await names(key(6))).tools).toContain('submitSuggestion')
    await payload.update({
      collection: 'payload-mcp-api-keys',
      id: doc.id,
      data: { scopes: ['read'] },
      user: admin,
      overrideAccess: false,
    })
    expect((await names(key(6))).tools).toEqual(READ)
  })

  it('cannot be saved with no scope, so a record never grants by being empty', async () => {
    await expect(
      payload.create({
        collection: 'payload-mcp-api-keys',
        data: {
          user: (await createAccount(payload, 'agent', 'key7')).id,
          label: 'None',
          enableAPIKey: true,
          apiKey: key(7),
          scopes: [],
        },
        user: admin,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('starts with read only when an admin picks no scope', async () => {
    const owner = await createAccount(payload, 'agent', 'key8')
    const doc = await payload.create({
      collection: 'payload-mcp-api-keys',
      data: { user: owner.id, label: 'Default', enableAPIKey: true, apiKey: key(8), ...NO_SCOPES },
      user: admin,
      overrideAccess: false,
    })
    expect(doc.scopes).toEqual(['read'])
  })
})
