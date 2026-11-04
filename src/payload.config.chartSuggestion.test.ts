import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { bootPayload, createAccount } from '@/platform/payload/testing/inMemoryPayload'
import { createMcpKey, mcpClient } from '@/platform/payload/testing/mcpRequest'

/**
 * A `<Chart>` tag in an agent's suggestion (#640), over real MCP requests: it becomes a chart
 * block in a body longer than the old 3,000-character cap, and a malformed one refuses the call
 * with the reason and stores nothing.
 */

let payload: Payload
let mcp: ReturnType<typeof mcpClient>

const KEY = 'chart-key-for-tests-0123456789abcdef'
const RUN_ID = 'scout-2026-11-04'
let next = 0
const suggestion = (extra: Record<string, unknown>) => ({
  collection: 'posts',
  title: `Budget explainer ${++next}`,
  summary: 'What the 2027 budget means for the neighborhood.',
  categories: ['budget'],
  startsAt: null,
  endsAt: null,
  allDay: null,
  venue: null,
  externalId: `mpl:chart-${next}`,
  contentHash: next.toString(16).padStart(64, 'b'),
  audience: ['everyone'],
  runId: RUN_ID,
  sourceName: 'City of Madison',
  sourceUrl: 'https://example.com/budget',
  ...extra,
})
const call = (args: Record<string, unknown>) => mcp.tool('submitSuggestion', args, KEY)

beforeAll(async () => {
  const booted = await bootPayload()
  payload = booted.payload
  mcp = mcpClient(booted.config)
  const admin = await createAccount(payload, 'admin', 'ana')
  const agent = await createAccount(payload, 'agent', 'scout')
  await createMcpKey(payload, admin, agent.id, KEY)
  await payload.create({
    collection: 'agent-runs',
    data: {
      pipelineVersion: 1,
      repoCommit: 'a'.repeat(40),
      status: 'running',
      runId: RUN_ID,
      agentName: RUN_ID,
      startedAt: '2026-11-04T11:00:00.000Z',
    },
    user: agent,
    overrideAccess: false,
  })
  await payload.create({ collection: 'categories', data: { title: 'Budget', slug: 'budget' } })
}, 60_000)

describe('a <Chart> tag in a suggestion', () => {
  const chart =
    '<Chart kind="bar" title="Budget" summary="Up a little." unit="usd" data={[{"key":"a","label":"2026","value":4}]} />'
  const stored = (id: number) =>
    payload.findByID({ collection: 'posts', id, draft: true, overrideAccess: true })

  it('is stored as a chart block, in a body longer than 3,000 characters', async () => {
    const filler = 'Neighbors read this slowly. '.repeat(200)
    const answered = await call(suggestion({ bodyMarkdown: `${filler}\n\n${chart}` }))
    expect(answered.isError).toBe(false)
    const result = JSON.parse(answered.text) as { status: string; id: number }
    expect(result.status).toBe('created')
    expect(JSON.stringify((await stored(result.id)).content)).toContain('"blockType":"chart"')
  })

  it('is refused with the reason when malformed, and stores nothing', async () => {
    const before = await payload.count({ collection: 'posts', overrideAccess: true })
    const bad =
      '<Chart kind="bar" title="Budget" unit="usd" data={[{"key":"a","label":"A","value":-4}]} />'
    const answered = await call(suggestion({ bodyMarkdown: bad }))
    expect(answered.isError).toBe(true)
    expect(answered.text).toMatch(/Invalid <Chart>/)
    expect(answered.text).toMatch(/summary/)
    expect(await payload.count({ collection: 'posts', overrideAccess: true })).toEqual(before)
  })
})
