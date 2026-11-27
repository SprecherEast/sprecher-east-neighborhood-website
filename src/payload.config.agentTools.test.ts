import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  type Account,
  bootPayload,
  createAccount,
  NO_REVALIDATE,
} from '@/platform/payload/testing/inMemoryPayload'
import { createMcpKey, mcpClient } from '@/platform/payload/testing/mcpRequest'

/**
 * The agents' two MCP tools (#336) over real requests to Payload on in-memory SQLite, with the
 * arguments of `intelligence/schemas/` (#344): `submitSuggestion` stores only unpublished
 * suggested drafts and reports duplicates, and `reportItem` writes only to the agent's own run.
 * Every argument is size-capped.
 */

let payload: Payload
let mcp: ReturnType<typeof mcpClient>
let runDocId = 0
let agent: Account

const KEY = 'tools-key-for-tests-0123456789abcdef'
const RUN_ID = 'scout-2026-10-24'
const RUN = { pipelineVersion: 1, repoCommit: 'a'.repeat(40), status: 'running' as const }
const SOURCE = { sourceName: 'Madison Public Library', sourceUrl: 'https://example.com/e/1' }
let next = 0
const suggestion = (extra: Record<string, unknown> = {}) => ({
  collection: 'events',
  title: `Story time ${++next}`,
  bodyMarkdown: '## Story time\n\nBring a **blanket**. [Details](https://example.com/e/1)',
  summary: 'Stories and songs for little ones at the library.',
  categories: ['story-time'],
  startsAt: '2026-11-07T16:00:00-06:00',
  endsAt: '2026-11-07T17:00:00-06:00',
  venue: 'Pinney Library',
  externalId: `mpl:${next}`,
  contentHash: next.toString(16).padStart(64, 'a'),
  audience: ['families'],
  runId: RUN_ID,
  ...SOURCE,
  ...extra,
})

const call = (name: string, args: Record<string, unknown>) => mcp.tool(name, args, KEY)
const answer = async (name: string, args: Record<string, unknown>) =>
  JSON.parse((await call(name, args)).text) as { status: string; id: number }
const run = () =>
  payload.findByID({ collection: 'agent-runs', id: runDocId, depth: 0, overrideAccess: true })
/** The review items stored for the test's run, oldest first. */
const items = async () =>
  (
    await payload.find({
      collection: 'agent-review-items',
      where: { run: { equals: runDocId } },
      sort: 'createdAt',
      depth: 0,
      overrideAccess: true,
    })
  ).docs
const createRun = (user: Account, runId: string) =>
  payload.create({
    collection: 'agent-runs',
    data: { ...RUN, runId, agentName: runId, startedAt: '2026-10-24T11:00:00.000Z' },
    user,
    overrideAccess: false,
  })

beforeAll(async () => {
  const booted = await bootPayload()
  payload = booted.payload
  mcp = mcpClient(booted.config)
  const admin = await createAccount(payload, 'admin', 'ana')
  agent = await createAccount(payload, 'agent', 'scout')
  await createMcpKey(payload, admin, agent.id, KEY)
  runDocId = (await createRun(agent, RUN_ID)).id
  // The category every suggestion names; categories and images: agentSuggestionCards.test.ts
  await payload.create({
    collection: 'categories',
    data: { title: 'Story time', slug: 'story-time' },
  })
}, 60_000)

describe('submitSuggestion', () => {
  it('stores an event as an unpublished suggested draft, with its schedule and source', async () => {
    const result = await answer('submitSuggestion', suggestion())
    expect(result.status).toBe('created')
    const event = await payload.findByID({
      collection: 'events',
      id: result.id,
      draft: true,
      overrideAccess: true,
    })
    expect(event).toMatchObject({
      _status: 'draft',
      moderationStatus: 'suggested',
      date: '2026-11-07T00:00:00.000Z',
      timeStart: '4:00 PM',
      timeEnd: '5:00 PM',
      locationName: 'Pinney Library',
      audience: ['families'],
      ...SOURCE,
    })
    expect(JSON.stringify(event.content)).toContain('blanket')
    const published = await payload.count({
      collection: 'events',
      where: { and: [{ id: { equals: result.id } }, { _status: { equals: 'published' } }] },
      overrideAccess: true,
    })
    expect(published.totalDocs).toBe(0)
  })

  it('stores a post’s Markdown as its content', async () => {
    const post = { collection: 'posts', startsAt: null, endsAt: null, allDay: null, venue: null }
    const result = await answer('submitSuggestion', suggestion(post))
    const stored = await payload.findByID({
      collection: 'posts',
      id: result.id,
      overrideAccess: true,
    })
    expect(stored).toMatchObject({ _status: 'draft', moderationStatus: 'suggested' })
    expect(JSON.stringify(stored.content)).toContain('"tag":"h2"')
  })

  it('answers duplicate, with the stored id, for the same source ID or fingerprint', async () => {
    const first = suggestion()
    const created = await answer('submitSuggestion', first)
    const byId = { ...suggestion({ title: 'Other' }), externalId: first.externalId }
    const byHash = { ...suggestion({ title: 'Other' }), contentHash: first.contentHash }
    expect(await answer('submitSuggestion', byId)).toEqual({ status: 'duplicate', id: created.id })
    expect(await answer('submitSuggestion', byHash)).toEqual({
      status: 'duplicate',
      id: created.id,
    })
  })

  it('refuses an event without a start, and another agent’s run', async () => {
    expect((await call('submitSuggestion', suggestion({ startsAt: null }))).isError).toBe(true)
    const other = await createAccount(payload, 'agent', 'other')
    await createRun(other, 'other-run')
    const refused = await call('submitSuggestion', suggestion({ runId: 'other-run' }))
    expect(refused.isError).toBe(true)
  })
})

describe('reportItem', () => {
  const report = {
    runId: RUN_ID,
    kind: 'needs-review',
    summary: 'Check the date.',
    evidence: [],
    flags: [],
    sourceUrl: 'https://example.com/x',
  }

  it('adds an item to the run and never changes the content it points at', async () => {
    const target = await payload.create({
      collection: 'events',
      data: { title: 'Fall fest', slug: 'fall-fest', date: '2026-11-01', _status: 'published' },
      overrideAccess: true,
      context: NO_REVALIDATE,
    })
    const cancel = {
      ...report,
      kind: 'cancel',
      targetCollection: 'events',
      targetId: target.id,
      summary: 'The city calendar says Fall fest is cancelled.',
      evidence: [
        {
          url: 'https://example.com/fall-fest',
          says: 'Cancelled due to weather',
          retrievedAt: '2026-10-24T10:00:00Z',
        },
      ],
      flags: ['cancelled'],
    }
    expect(await answer('reportItem', cancel)).toMatchObject({ status: 'reported' })
    const after = await payload.findByID({
      collection: 'events',
      id: target.id,
      overrideAccess: true,
      // The event's join to its posts is read on request, so it is left out of both sides
      joins: false,
    })
    expect(after).toEqual({ ...target, relatedPosts: undefined })
    expect((await items()).at(-1)).toMatchObject({
      run: runDocId,
      kind: 'cancel',
      targetCollection: 'events',
      targetId: target.id,
      flags: ['cancelled'],
      evidence: [expect.objectContaining({ says: 'Cancelled due to weather' })],
    })
  })

  it('needs the collection with a target id, and a target for a cancellation', async () => {
    expect((await call('reportItem', { ...report, targetId: 3 })).isError).toBe(true)
    expect((await call('reportItem', { ...report, kind: 'cancel' })).isError).toBe(true)
  })

  it('keeps both of two reports sent at the same time', async () => {
    const before = (await items()).length
    const results = await Promise.all([
      answer('reportItem', { ...report, summary: 'First at once.' }),
      answer('reportItem', { ...report, summary: 'Second at once.' }),
    ])
    expect(results.map((r) => r.status)).toEqual(['reported', 'reported'])
    const summaries = (await items()).map((item) => item.summary)
    expect(summaries).toHaveLength(before + 2)
    expect(summaries).toEqual(expect.arrayContaining(['First at once.', 'Second at once.']))
  })

  it('can’t be changed or removed by the agent, even through its run', async () => {
    const [item] = await items()
    const as = { user: agent, overrideAccess: false }
    await expect(
      payload.update({
        collection: 'agent-review-items',
        id: item.id,
        data: { summary: 'x' },
        ...as,
      }),
    ).rejects.toThrow()
    await expect(
      payload.delete({ collection: 'agent-review-items', id: item.id, ...as }),
    ).rejects.toThrow()
    await call('updateAgentRuns', { id: runDocId, reviewItems: [] })
    await call('updateAgentRuns', { id: runDocId, status: 'succeeded' })
    expect((await run()).status).toBe('succeeded')
    expect((await items())[0]).toMatchObject({ id: item.id, summary: item.summary })
  })
})

// Every cap and format is checked against the contract in `tools/schemas.contract.test.ts`; these
// show a refused call stores nothing
describe('an oversized or invalid argument', () => {
  it('stores no suggestion', async () => {
    const before = await payload.count({ collection: 'events', overrideAccess: true })
    for (const bad of [{ title: 'x'.repeat(121) }, { externalId: 'no-source-prefix' }]) {
      expect((await call('submitSuggestion', suggestion(bad))).isError).toBe(true)
    }
    expect(await payload.count({ collection: 'events', overrideAccess: true })).toEqual(before)
  })

  it('stores no report', async () => {
    const before = (await items()).length
    const report = { runId: RUN_ID, kind: 'needs-review', evidence: [], flags: [] }
    for (const bad of [
      { summary: 'x'.repeat(1_001), sourceUrl: 'https://e.com' },
      { summary: 'Check', sourceUrl: null },
    ]) {
      expect((await call('reportItem', { ...report, ...bad })).isError).toBe(true)
    }
    expect(await items()).toHaveLength(before)
  })

  it('accepts a rejection without a source link', async () => {
    const rejected = { runId: RUN_ID, kind: 'rejected-invalid', summary: 'No date anywhere.' }
    const args = { ...rejected, evidence: [], flags: ['needs-date'], sourceUrl: null }
    expect(await answer('reportItem', args)).toMatchObject({ status: 'reported' })
  })
})
