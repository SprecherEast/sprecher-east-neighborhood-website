import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { cmsOperations, dryRunCms, withoutSuggestions } from '../lib/cms.mjs'
import { robotsChecker } from '../lib/fetchSource.mjs'
import { runPipeline } from '../lib/pipeline.mjs'
import { checkUpcomingEvents, lowEventsWarning } from '../lib/upcoming.mjs'
import { accepting, feedsHttp } from './fixtures.mjs'
import { contract, contractOn } from './helpers.mjs'

// The low-water mark (#995): how many upcoming events the site shows, counted at the end of
// each run, and a warning in the run log and the digest when there are fewer than the mark.

const mark = contract.pipeline.lowWater.upcomingEvents
const now = () => new Date('2026-10-25T17:00:00Z')
const runLog = contract.validator('schemas/agent-run.schema.json')

const events = (n) => Array.from({ length: n }, (_, i) => JSON.stringify({ id: i + 1 })).join('\n')

describe('the mark', () => {
  it('is set once in pipeline.yaml, as a whole number of events', () => {
    assert.ok(Number.isInteger(mark) && mark >= 1)
  })
})

describe('counting upcoming events', () => {
  it('asks for published, uncancelled events dated today or later, at most the mark', async () => {
    const calls = []
    const ops = cmsOperations(async (name, args) => {
      calls.push({ name, args })
      return { text: `Found events\n${events(3)}`, isError: false }
    })
    assert.equal(await ops.upcomingEvents({ today: '2026-11-26', limit: mark }), 3)
    assert.equal(calls[0].name, 'findEvents')
    assert.equal(calls[0].args.limit, mark)
    assert.deepEqual(JSON.parse(calls[0].args.where), {
      and: [
        { date: { greater_than_equal: '2026-11-26' } },
        { _status: { equals: 'published' } },
        { cancelled: { not_equals: true } },
      ],
    })
  })

  it('is counted by a dry run without a key as unknown, never as zero', async () => {
    assert.equal(await dryRunCms(null).upcomingEvents({ today: '2026-11-26', limit: mark }), null)
  })

  it('is on the client a run hands every stage but suggesting', () => {
    const cms = withoutSuggestions(dryRunCms(null))
    assert.equal(typeof cms.upcomingEvents, 'function')
  })

  it('reports low under the mark, not low at the mark, unknown when the site can’t say', async () => {
    const count = (n) =>
      checkUpcomingEvents({ cms: { upcomingEvents: async () => n }, mark, today: '2026-11-26' })
    assert.deepEqual(await count(mark - 1), { count: mark - 1, mark, low: true })
    assert.deepEqual(await count(mark), { count: mark, mark, low: false })
    assert.deepEqual(await count(null), { count: null, mark, low: null })
    const failing = {
      upcomingEvents: async () => {
        throw new Error('boom')
      },
    }
    const failed = await checkUpcomingEvents({ cms: failing, mark, today: '2026-11-26' })
    assert.deepEqual([failed.count, failed.low], [null, null])
    assert.match(failed.error, /boom/)
  })

  it('words the warning in plain language, within the run log’s limit', () => {
    const text = lowEventsWarning({ count: 2, mark: 6, low: true })
    assert.match(text, /2 upcoming events/)
    assert.match(text, /6/)
    assert.ok(text.length <= 500)
    assert.equal(lowEventsWarning({ count: 6, mark: 6, low: false }), null)
    assert.equal(lowEventsWarning({ count: null, mark: 6, low: null }), null)
  })
})

describe('a run', () => {
  const run = async (upcoming) => {
    const cms = dryRunCms(null)
    cms.taxonomy = async () => []
    cms.upcomingEvents = upcoming
    const http = feedsHttp()
    const result = await runPipeline({
      contract: contractOn('2026-10-25'),
      cms,
      ask: accepting,
      state: { sources: {}, seen: {} },
      http,
      robots: robotsChecker(http),
      repoCommit: 'a'.repeat(40),
      now,
    })
    return { ...result, cms }
  }
  const sent = (cms) => cms.writes.filter((w) => w.tool === 'updateAgentRuns').at(-1).arguments

  it('puts the low warning in the run log and the digest, and still validates as a run log', async () => {
    const { log, upcoming, cms } = await run(async () => 2)
    assert.deepEqual(upcoming, { count: 2, mark, low: true })
    assert.ok(sent(cms).errors.some((e) => /2 upcoming events/.test(e)))
    assert.deepEqual(runLog(log), [])
  })

  it('says nothing and counts nothing as an error when the list is full', async () => {
    const { upcoming, cms } = await run(async () => mark)
    assert.equal(upcoming.low, false)
    assert.ok(!sent(cms).errors.some((e) => /upcoming events/.test(e)))
  })

  it('does not make a run partial only because the list is low', async () => {
    const { log: full } = await run(async () => mark)
    const { log: low } = await run(async () => 0)
    assert.equal(low.status, full.status)
  })

  it('carries on when the count fails, and says it could not count', async () => {
    const { upcoming, log } = await run(async () => {
      throw new Error('find tool down')
    })
    assert.equal(upcoming.count, null)
    assert.notEqual(log.status, 'failed')
  })
})
