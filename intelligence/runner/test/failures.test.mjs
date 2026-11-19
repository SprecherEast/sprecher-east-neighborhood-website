import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { dryRunCms } from '../lib/cms.mjs'
import { fetchDirect } from '../lib/fetchSource.mjs'
import { AdapterError, childEnv, openclawAdapter } from '../lib/model.mjs'
import { runPipeline } from '../lib/pipeline.mjs'
import { scoutSource } from '../lib/scout.mjs'
import { accepting, FEEDS, feedsHttp } from './fixtures.mjs'
import { atNoon, budgets, contract } from './helpers.mjs'

// What happens when things go wrong: the CMS or the model is down mid-run, a follow-up report
// fails, a feed has more items than the cap, a redirect leads somewhere it shouldn't.

const run = async (cms, { ask = accepting, state = { sources: {}, seen: {} } } = {}) => {
  cms.taxonomy ??= async () => [{ slug: 'community', title: 'Community', parent: null }]
  const http = feedsHttp()
  const result = await runPipeline({
    contract,
    cms,
    ask,
    state,
    http,
    robots: async () => true,
    repoCommit: 'a'.repeat(40),
    now: () => new Date('2026-10-25T17:00:00Z'),
  })
  return { ...result, state }
}

describe('when the CMS fails', () => {
  it('keeps the item for the next run when the known lookup fails, and closes the run log', async () => {
    const cms = dryRunCms(null)
    cms.taxonomy = async () => [{ slug: 'community', title: 'Community', parent: null }]
    cms.known = async () => {
      throw new Error('fetch failed: 502')
    }
    const { log, state } = await run(cms)
    assert.equal(log.status, 'partial')
    assert.equal(log.counts.seen, 0)
    assert.equal(Object.keys(state.seen).length, 0)
    // No source with items saves its fetch state; the HTML pages here have none to keep (#390)
    const withItems = [
      'legistar-events',
      'mpl-pinney-events',
      'legistar-matters',
      'madison365-news',
    ]
    assert.deepEqual(
      Object.keys(state.sources).filter((id) => withItems.includes(id)),
      [],
    )
    // ...while the four HTML pages, with nothing pending, do
    assert.equal(Object.keys(state.sources).length, 4)
    assert.ok(cms.writes.some((w) => w.tool === 'updateAgentRuns'))
  })

  it('counts a stored suggestion even when its follow-up report fails', async () => {
    const cms = dryRunCms(null)
    cms.reportItem = async () => {
      throw new Error('fetch failed: 503')
    }
    const { log, state } = await run(cms)
    assert.equal(log.counts.proposed, 2)
    assert.equal(log.counts.deferred, 0)
    assert.equal(Object.keys(state.seen).length, 4)
    assert.ok(log.errors.some((e) => /follow-up report not sent/.test(e)))
  })

  it('still answers the run when the final log update fails', async () => {
    const cms = dryRunCms(null)
    cms.updateRun = async () => {
      throw new Error('fetch failed: 500')
    }
    const { log, state } = await run(cms)
    assert.equal(log.status, 'succeeded')
    assert.equal(Object.keys(state.seen).length, 4)
  })

  it('logs a failed run when the taxonomy can’t be read, having handled nothing', async () => {
    const cms = dryRunCms(null)
    cms.taxonomy = async () => {
      throw new Error('fetch failed')
    }
    const { log, state } = await run(cms)
    assert.equal(log.status, 'failed')
    assert.equal(Object.keys(state.seen).length, 0)
  })
})

describe('when the model fails', () => {
  it('defers items on an empty or broken OpenClaw answer, never sending them for review', async () => {
    const empty = async () => {
      throw new AdapterError('OpenClaw returned an empty answer')
    }
    const cms = dryRunCms(null)
    const { log } = await run(cms, { ask: empty })
    assert.equal(log.counts.needsReview, 0)
    assert.equal(log.counts.seen, 0)
    assert.ok(log.counts.deferred > 0)
    assert.ok(!cms.writes.some((w) => w.tool === 'reportItem'))
  })

  it('never gives the model process the CMS key', () => {
    const env = childEnv({
      PATH: '/bin',
      SPRECHER_EAST_MCP_KEY: 'secret',
      OTHER_API_KEY: 'x',
      OPENCLAW_GATEWAY_PASSWORD: 'p',
    })
    assert.deepEqual(Object.keys(env).sort(), ['OPENCLAW_GATEWAY_PASSWORD', 'PATH'])
  })

  it('reads token counts where OpenClaw 2026.10 reports them, cached tokens as input', async () => {
    const envelope = {
      status: 'ok',
      result: {
        payloads: [{ text: '{"ok":true}' }],
        meta: { agentMeta: { usage: { input: 3061, output: 9, cacheRead: 100 } } },
      },
    }
    const ask = openclawAdapter({
      command: [
        process.execPath,
        '-e',
        `process.stdout.write(${JSON.stringify(JSON.stringify(envelope))})`,
      ],
    })
    const answer = await ask({ message: 'x' })
    assert.equal(answer.text, '{"ok":true}')
    assert.deepEqual(answer.usage, { input: 3161, output: 9 })
  })

  it('reports OpenClaw failures without its command line', async () => {
    const ask = openclawAdapter({
      command: [process.execPath, '-e', 'process.stderr.write("boom");process.exit(3)'],
    })
    await assert.rejects(
      ask({ message: 'x' }),
      (error) =>
        error instanceof AdapterError &&
        /exited with 3: boom/.test(error.message) &&
        !error.message.includes('-e'),
    )
  })
})

describe('the per-source cap', () => {
  const matters = contract.registry.sources.find((s) => s.id === 'legistar-matters')
  const many = JSON.stringify(
    Array.from({ length: 5 }, (_, i) => ({
      MatterId: 900 + i,
      MatterTitle: `Sprecher Road item ${i}`,
      MatterLastModifiedUtc: `2026-10-2${i}T10:00:00`,
    })).reverse(),
  )
  const options = {
    budgets: { ...budgets, maxItemsPerSource: 3 },
    validate: contract.validator('schemas/candidate.schema.json'),
    now: atNoon('2026-10-25'),
  }

  it('keeps a cursor source’s oldest changes and moves its cursor only past them', async () => {
    const http = async () => new Response(many)
    const result = await scoutSource(matters, {
      area: contract.area,
      ...options,
      state: { sources: {}, seen: {} },
      http,
    })
    assert.deepEqual(
      result.candidates.map((c) => c.externalId),
      ['legistar-matters:900', 'legistar-matters:901', 'legistar-matters:902'],
    )
    assert.equal(result.fetchState.cursor, '2026-10-22T10:00:00')
    assert.equal(result.deferred, 0)
  })

  it('reports another source’s extra items as deferred, so its ETag isn’t saved', async () => {
    const library = contract.registry.sources.find((s) => s.id === 'mpl-pinney-events')
    const ics = FEEDS['mpl-pinney-events']
      .replace('RRULE', 'X')
      .replace('END:VEVENT', 'RRULE:FREQ=DAILY;COUNT=6\r\nEND:VEVENT')
    const result = await scoutSource(library, {
      area: contract.area,
      ...options,
      state: { sources: {}, seen: {} },
      http: async () => new Response(ics),
    })
    assert.equal(result.candidates.length, 3)
    assert.equal(result.deferred, 3)
  })
})

describe('redirects', () => {
  const answers = (list) => {
    const queue = [...list]
    return async () => {
      const [status, location] = queue.shift()
      return new Response(status === 200 ? 'ok' : null, {
        status,
        headers: location ? { location } : {},
      })
    }
  }

  it('stops at a redirect to a gate or to plain http, and checks robots.txt at every hop', async () => {
    assert.equal(
      (
        await fetchDirect('https://a.example/feed', {
          http: answers([[302, 'https://tollbit.a.example/x']]),
        })
      ).status,
      'blocked',
    )
    assert.equal(
      (
        await fetchDirect('https://a.example/feed', {
          http: answers([[301, 'http://a.example/feed']]),
        })
      ).status,
      'error',
    )
    const robots = async (url) => !url.includes('/private')
    const result = await fetchDirect('https://a.example/feed', {
      http: answers([[302, '/private/feed']]),
      robots,
    })
    assert.equal(result.status, 'blocked')
    assert.match(result.error, /robots/)
  })
})
