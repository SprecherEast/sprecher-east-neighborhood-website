import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { bootPayload, createAccount } from '@/platform/payload/testing/inMemoryPayload'
import { createMcpKey, mcpClient } from '@/platform/payload/testing/mcpRequest'

/**
 * A `<SectionTabs>` tag in an agent's suggestion (#1333), over real MCP requests: it becomes a
 * section tabs block whose tabs hold their own rich text, and a tag that breaks the block's rules
 * refuses the call with the reason and stores nothing.
 */

let payload: Payload
let mcp: ReturnType<typeof mcpClient>

const KEY = 'section-tabs-key-for-tests-0123456789abcdef'
const RUN_ID = 'scout-2026-11-19'
let next = 0
const suggestion = (bodyMarkdown: string) => ({
  collection: 'posts',
  title: `Section tabs explainer ${++next}`,
  summary: 'A plan, one tab at a time.',
  categories: ['development'],
  startsAt: null,
  endsAt: null,
  allDay: null,
  venue: null,
  externalId: `mpl:section-tabs-${next}`,
  contentHash: next.toString(16).padStart(64, 'd'),
  audience: ['everyone'],
  runId: RUN_ID,
  sourceName: 'City of Madison',
  sourceUrl: 'https://example.com/plan',
  bodyMarkdown,
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
      startedAt: '2026-11-19T11:00:00.000Z',
    },
    user: agent,
    overrideAccess: false,
  })
  await payload.create({
    collection: 'categories',
    data: { title: 'Development', slug: 'development' },
  })
}, 60_000)

const TAG = [
  '<SectionTabs>',
  '<Tab label="Overview">',
  '',
  '### The short version',
  '',
  'A new ramp is proposed.',
  '',
  '</Tab>',
  '<Tab label="What’s next">',
  '',
  'A meeting is planned.',
  '',
  '</Tab>',
  '</SectionTabs>',
].join('\n')

describe('a <SectionTabs> tag in a suggestion', () => {
  it('is stored as a section tabs block with each tab’s rich text, as an unpublished draft', async () => {
    const answered = await call(suggestion(`Intro.\n\n${TAG}\n\nOutro.`))
    expect(answered.isError).toBe(false)
    const { id } = JSON.parse(answered.text) as { id: number }
    const doc = await payload.findByID({
      collection: 'posts',
      id,
      draft: true,
      overrideAccess: true,
    })
    expect(doc._status).toBe('draft')
    const content = JSON.stringify(doc.content)
    expect(content).toContain('"blockType":"sectionTabs"')
    expect(content).toContain('The short version')
    expect(content).toContain('A meeting is planned.')
  })

  it('is refused with the reason when a tab has no content, and nothing is stored', async () => {
    const before = await payload.count({ collection: 'posts', overrideAccess: true })
    const answered = await call(
      suggestion(TAG.replace(/(<Tab label="What’s next">)[\s\S]*?(<\/Tab>)/, '$1\n\n$2')),
    )
    expect(answered.isError).toBe(true)
    expect(answered.text).toMatch(/Invalid <SectionTabs>.*has no content/)
    expect((await payload.count({ collection: 'posts', overrideAccess: true })).totalDocs).toBe(
      before.totalDocs,
    )
  })
})
