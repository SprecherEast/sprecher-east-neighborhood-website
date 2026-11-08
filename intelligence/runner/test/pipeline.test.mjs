import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { cmsOperations, docsIn, dryRunCms } from '../lib/cms.mjs'
import { fakeAdapter } from '../lib/model.mjs'
import { runPipeline } from '../lib/pipeline.mjs'
import { takeTurns } from '../lib/process.mjs'
import { robotsChecker } from '../lib/fetchSource.mjs'
import { curation, draft, feedsHttp, verification } from './fixtures.mjs'
import { contract } from './helpers.mjs'

// A whole run over the four pilot feeds, with a fake model and a dry-run CMS: scout, the model
// stages, submit and the run log, and what a second run does with the state the first left.

const now = () => new Date('2026-10-25T17:00:00Z')
const runLog = contract.validator('schemas/agent-run.schema.json')
const COMMIT = 'a'.repeat(40)

/** A model that accepts the library event and the Sprecher Road item, and rejects the rest. */
const model = (calls = []) =>
  fakeAdapter(({ stageId, item, message }) => {
    calls.push({ stageId, message })
    const accept = /Silent Book Club|Sprecher Road/.test(item.candidate.title)
    if (stageId === 'verify') return verification()
    if (stageId === 'curate')
      return accept
        ? curation()
        : curation({ decision: 'reject', reasons: ['Not about the area.'] })
    const post = item.candidate.kind === 'legislation'
    return post
      ? draft({
          collection: 'posts',
          title: 'Sidewalks and lights for Sprecher Road',
          startsAt: null,
          endsAt: null,
          allDay: null,
          venue: null,
          address: null,
        })
      : draft()
  })

const run = async ({
  state = { sources: {}, seen: {} },
  http = feedsHttp(),
  ask = model(),
  pipeline,
} = {}) => {
  const cms = dryRunCms(null)
  cms.taxonomy = async () => [{ slug: 'community', title: 'Community', parent: null }]
  const result = await runPipeline({
    contract: pipeline
      ? { ...contract, pipeline: { ...contract.pipeline, ...pipeline } }
      : contract,
    cms,
    ask,
    state,
    http,
    robots: robotsChecker(http),
    repoCommit: COMMIT,
    now,
  })
  return { ...result, cms, state }
}

describe('a run', () => {
  it('takes candidates in turns by source, so a small budget samples each source', () => {
    const c = (sourceId, n) => ({ sourceId, externalId: `${sourceId}:${n}` })
    const turns = takeTurns([c('a', 1), c('a', 2), c('a', 3), c('b', 1), c('c', 1), c('c', 2)])
    assert.deepEqual(
      turns.map((t) => t.externalId),
      ['a:1', 'b:1', 'c:1', 'a:2', 'c:2', 'a:3'],
    )
  })

  it('tells the model what the registry says about each item’s source, as the item schema allows', async () => {
    const items = []
    const validateItem = contract.validator('schemas/item.schema.json')
    const ask = fakeAdapter(({ stageId, item }) => {
      if (stageId === 'verify') items.push(structuredClone(item))
      return stageId === 'verify' ? verification() : curation({ decision: 'reject' })
    })
    await run({ ask })
    const library = items.find((i) => i.candidate.sourceId === 'mpl-pinney-events')
    assert.deepEqual(library.source, {
      id: 'mpl-pinney-events',
      owner: 'Madison Public Library',
      reliability: 'official',
      scope: contract.registry.sources.find((s) => s.id === 'mpl-pinney-events').scope,
    })
    for (const item of items) assert.deepEqual(validateItem(item), [])
  })

  it('suggests the accepted items, logs a valid run, and records what it handled', async () => {
    const calls = []
    const { log, cms, state } = await run({ ask: model(calls) })
    assert.deepEqual(runLog(log), [])
    assert.equal(log.status, 'succeeded')
    // The transportation commission and the citywide fee schedule never reach the model
    assert.equal(log.counts.seen, 4)
    assert.equal(log.counts.proposed, 2)
    assert.equal(log.counts.rejected, 2)
    const suggestions = cms.writes.filter((w) => w.tool === 'submitSuggestion')
    assert.deepEqual(suggestions.map((s) => s.arguments.collection).sort(), ['events', 'posts'])
    assert.equal(Object.keys(state.seen).length, 4)
    assert.equal(state.sources['mpl-pinney-events'].etag, '"v1"')
    // The model saw the taxonomy and never the key or the run log
    assert.ok(calls.some((c) => c.message.includes('"taxonomy":[{"slug":"community"')))
    assert.ok(calls.every((c) => !/Bearer|SPRECHER_EAST_MCP_KEY/.test(c.message)))
    const update = cms.writes.find((w) => w.tool === 'updateAgentRuns').arguments
    assert.equal(update.runId, undefined)
    assert.equal(update.status, 'succeeded')
  })

  describe('the promotion guard (#870)', () => {
    /** A model that accepts the library event whatever verify found, and says verify's `overrides`. */
    const acceptingWith = (overrides) =>
      fakeAdapter(({ stageId, item }) => {
        if (stageId === 'verify') return verification(overrides)
        if (stageId === 'curate')
          return /Silent Book Club/.test(item.candidate.title)
            ? curation()
            : curation({ decision: 'reject', reasons: ['Not about the area.'] })
        return draft()
      })
    const reports = (cms) => cms.writes.filter((w) => w.tool === 'reportItem')
    const suggestions = (cms) => cms.writes.filter((w) => w.tool === 'submitSuggestion')

    it('reports needs-review instead of submitting an accept on a low-confidence item', async () => {
      const { cms, log } = await run({ ask: acceptingWith({ confidence: 0.4 }) })
      assert.equal(suggestions(cms).length, 0)
      assert.ok(reports(cms).some((w) => /Silent Book Club/.test(w.arguments.summary)))
      assert.ok(reports(cms).every((w) => w.arguments.kind === 'needs-review'))
      assert.equal(log.counts.proposed, 0)
      assert.equal(log.counts.needsReview, 1)
    })

    for (const flag of ['ambiguous-location', 'conflicting-sources', 'prompt-injection']) {
      it(`reports needs-review instead of submitting an accept flagged ${flag}`, async () => {
        const { cms } = await run({ ask: acceptingWith({ flags: [flag] }) })
        assert.equal(suggestions(cms).length, 0)
        const [report] = reports(cms)
        assert.equal(report.arguments.kind, 'needs-review')
        assert.deepEqual(report.arguments.flags, [flag])
        assert.match(report.arguments.summary, /Decision: needs-review/)
      })
    }

    it('lets a flag that is not blocking through, and a clean accept at the threshold', async () => {
      const threshold = contract.pipeline.escalation.verifyBelowConfidence
      const { cms } = await run({
        ask: acceptingWith({ confidence: threshold, flags: ['image-candidate'] }),
      })
      assert.equal(suggestions(cms).length, 1)
    })

    it('reads the blocking flags from the pipeline settings', async () => {
      const { cms } = await run({
        ask: acceptingWith({ flags: ['image-candidate'] }),
        pipeline: { promotionGuard: { blockingFlags: ['image-candidate'] } },
      })
      assert.equal(suggestions(cms).length, 0)
    })
  })

  it('sends nothing to the model the second time: the feeds answer 304', async () => {
    const first = await run()
    const calls = []
    const second = await run({ state: first.state, ask: model(calls) })
    assert.equal(calls.length, 0)
    assert.ok(second.log.sourcesChecked.every((s) => s.status === 'not-modified'))
  })

  it('stops at the draft cap and keeps the rest for the next run', async () => {
    const { log, state } = await run({
      pipeline: { budgets: { ...contract.pipeline.budgets, maxDraftsPerRun: 1 } },
    })
    assert.equal(log.counts.proposed, 1)
    assert.equal(log.counts.deferred, 1)
    assert.equal(log.status, 'partial')
    // The deferred item's source keeps its old ETag, so it is fetched again
    // (the four HTML pages here have no items, so all four save theirs too, #390)
    const kept = Object.keys(state.sources)
    assert.equal(kept.length, 7)
  })

  it('logs a disabled run and fetches nothing when the kill switch is off', async () => {
    const http = feedsHttp()
    const { log, cms } = await run({ http, pipeline: { enabled: false } })
    assert.equal(log.status, 'disabled')
    assert.equal(http.requested.length, 0)
    assert.deepEqual(
      cms.writes.map((w) => w.tool),
      ['createAgentRuns'],
    )
  })

  it('keeps items for the next run when the model is down, and stops after three failures', async () => {
    const down = async () => {
      throw new Error('OpenClaw: gateway not reachable')
    }
    const { log, state } = await run({ ask: down })
    assert.equal(log.status, 'partial')
    assert.equal(log.counts.seen, 0)
    assert.equal(log.counts.deferred, 4)
    assert.equal(Object.keys(state.seen).length, 0)
    assert.match(log.errors[0], /gateway not reachable/)
  })

  it('sends an item whose answers keep failing their schema to review', async () => {
    const bad = fakeAdapter(({ stageId }) => (stageId === 'verify' ? { confidence: 2 } : {}))
    const { log, cms } = await run({ ask: bad })
    assert.equal(log.counts.needsReview, 4)
    const report = cms.writes.find((w) => w.tool === 'reportItem').arguments
    assert.equal(report.kind, 'needs-review')
    assert.match(report.summary, /verify stage failed/)
  })
})

describe('the CMS client', () => {
  it('reads documents from a find answer, and builds the taxonomy with parent slugs', async () => {
    const answer =
      'Collection: categories\nTotal: 2 documents\nPage: 1 of 1\n{"id":1,"title":"Parks","slug":"parks","parent":null}\n{"id":2,"title":"Nature walks","slug":"nature-walks","parent":1}'
    assert.equal(docsIn(answer).length, 2)
    const cms = cmsOperations(async () => ({ text: answer, isError: false }))
    assert.deepEqual(await cms.taxonomy(), [
      { slug: 'parks', title: 'Parks', parent: null },
      { slug: 'nature-walks', title: 'Nature walks', parent: 'parks' },
    ])
  })

  it('raises a tool error instead of reading it as data', async () => {
    const cms = cmsOperations(async () => ({ text: 'Unknown category: zoo.', isError: true }))
    await assert.rejects(cms.submitSuggestion({}), /Unknown category: zoo/)
  })
})
