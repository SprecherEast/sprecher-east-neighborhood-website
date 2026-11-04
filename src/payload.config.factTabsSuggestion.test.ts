import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { bootPayload, createAccount } from '@/platform/payload/testing/inMemoryPayload'
import { createMcpKey, mcpClient } from '@/platform/payload/testing/mcpRequest'
import { FACT_TABS_FIXTURE } from '@/platform/richtext/editorial/factTabsFixtures'
import { factTabsToJsx } from '@/platform/richtext/editorial/factTabsMarkdown'

/**
 * A `<FactTabs>` tag in an agent's suggestion (#664), over real MCP requests: it becomes a fact
 * tabs block with its nested chart and timeline, and a malformed, hostile or unreadable one
 * refuses the call with the reason and stores nothing.
 */

let payload: Payload
let mcp: ReturnType<typeof mcpClient>

const KEY = 'tabs-key-for-tests-0123456789abcdef'
const RUN_ID = 'scout-2026-11-05'
let next = 0
const suggestion = (extra: Record<string, unknown>) => ({
  collection: 'posts',
  title: `Fact tabs explainer ${++next}`,
  summary: 'What the 2027 budget means for the neighborhood.',
  categories: ['budget'],
  startsAt: null,
  endsAt: null,
  allDay: null,
  venue: null,
  externalId: `mpl:tabs-${next}`,
  contentHash: next.toString(16).padStart(64, 'c'),
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

describe('a <FactTabs> tag in a suggestion', () => {
  const tag = factTabsToJsx(FACT_TABS_FIXTURE) as string
  const stored = (id: number) =>
    payload.findByID({ collection: 'posts', id, draft: true, overrideAccess: true })
  const count = () => payload.count({ collection: 'posts', overrideAccess: true })

  it('is stored as a fact tabs block with its chart and timeline, as an unpublished draft', async () => {
    const answered = await call(suggestion({ bodyMarkdown: `Intro.\n\n${tag}\n\nOutro.` }))
    expect(answered.isError).toBe(false)
    const result = JSON.parse(answered.text) as { status: string; id: number }
    expect(result.status).toBe('created')
    const doc = await stored(result.id)
    expect(doc._status).toBe('draft')
    const content = JSON.stringify(doc.content)
    expect(content).toContain('"blockType":"factTabs"')
    expect(content).toContain('"blockType":"timeline"')
    expect(content).toContain('"blockType":"chart"')
  })

  it.each([
    [
      'one tab',
      (t: string) =>
        t.replace(/^<FactTabs tabs=\{\[(.*?)\]\} \/>$/, (_m, _x) => '<FactTabs tabs={[]} />'),
      /Invalid <FactTabs>/,
    ],
    [
      'a javascript: link',
      (t: string) =>
        t.replace('"heading"', '"link":{"label":"x","href":"javascript:alert(1)"},"heading"'),
      /site path|address/i,
    ],
    [
      'a stray property',
      (t: string) => t.replace('/>', 'colour="red" />'),
      /colour is not a property/,
    ],
  ])('is refused with the reason for %s, and stores nothing', async (_name, damage, reason) => {
    const before = await count()
    const answered = await call(suggestion({ bodyMarkdown: damage(tag) }))
    expect(answered.isError).toBe(true)
    expect(answered.text).toMatch(reason)
    expect(await count()).toEqual(before)
  })

  it.each([
    ['a tag with no closing />', (t: string) => t.slice(0, -3)],
    [
      'an unclosed quote',
      (t: string) => t.replace('"Day-to-day money, proposed"', '"Day-to-day money, proposed'),
    ],
  ])(
    'refuses a tag it cannot read (%s) instead of storing an empty body',
    async (_name, damage) => {
      const before = await count()
      const answered = await call(
        suggestion({ bodyMarkdown: `Intro paragraph.\n\n${damage(tag)}\n\nOutro paragraph.` }),
      )
      expect(answered.isError).toBe(true)
      expect(answered.text).toMatch(/FactTabs/)
      expect(answered.text).toMatch(/could not be read|Invalid <FactTabs>/)
      expect(await count()).toEqual(before)
    },
  )
})
