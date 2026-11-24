import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { robotsChecker } from '../lib/fetchSource.mjs'
import { fakeAdapter } from '../lib/model.mjs'
import { runPipeline } from '../lib/pipeline.mjs'
import { curation, draft, FEEDS, feedsHttp, verification } from './fixtures.mjs'
import { contract } from './helpers.mjs'
import { cmsWithLog } from './safetyHelpers.mjs'

// A whole run with each stage lying holds the item (#1007).

describe('every stage goes through the gate', () => {
  // How each stage in pipeline.yaml meets the gate. A stage added to the pipeline has to be
  // listed here, which is the moment to decide how it meets it.
  const STAGES = {
    scout: 'code: reads sources; has no way to suggest',
    verify: 'model: its answer is read by the gate as `verification.safety`',
    curate: 'model: its decision and `curation.safety` are read by the gate',
    draft: 'model: writes the text; the gate reads none and holds by source and answers',
    submit: 'code: runs the gate before any CMS write',
  }
  it('lists every stage of pipeline.yaml, and nothing else', () => {
    assert.deepEqual(contract.pipeline.stages.map((s) => s.id).sort(), Object.keys(STAGES).sort())
  })

  const EVENT = 'Silent Book Club'
  const run = async ({ title, ask }) => {
    const feeds = {
      ...FEEDS,
      'mpl-pinney-events': FEEDS['mpl-pinney-events'].replace(EVENT, title),
    }
    const http = feedsHttp(feeds)
    const cms = cmsWithLog()
    cms.taxonomy = async () => [{ slug: 'community', title: 'Community', parent: null }]
    const result = await runPipeline({
      contract,
      cms,
      ask: fakeAdapter(ask),
      state: { sources: {}, seen: {} },
      http,
      robots: robotsChecker(http),
      repoCommit: 'a'.repeat(40),
      now: () => new Date('2026-10-25T17:00:00Z'),
    })
    return { ...result, cms }
  }
  const reports = (cms) => cms.writes.filter((w) => w.tool === 'reportItem')
  /** Answers for the library event; everything else is rejected. */
  const model =
    (answers) =>
    ({ stageId, item: it }) => {
      if (!it.candidate.sourceId.startsWith('mpl-')) {
        return stageId === 'curate'
          ? curation({ decision: 'reject', reasons: ['No.'] })
          : stageId === 'verify'
            ? verification()
            : draft()
      }
      return { verify: verification(), curate: curation(), draft: draft(), ...answers }[stageId]
    }

  const lies = {
    'only verify tells': { title: EVENT, answers: { verify: verification({ safety: true }) } },
    'only curate tells': { title: EVENT, answers: { curate: curation({ safety: true }) } },
  }
  for (const [name, { title, answers }] of Object.entries(lies)) {
    it(`never submits a suggestion when ${name}`, async () => {
      const { cms, log } = await run({ title, ask: model(answers) })
      assert.deepEqual(cms.submitted, [])
      assert.equal(log.counts.proposed, 0)
      const held = reports(cms).filter((w) => /Decision: needs-review/.test(w.arguments.summary))
      assert.equal(held.length, 1)
      assert.equal(log.counts.needsReview, 1)
    })
  }

  it('counts an update from the decision the gate let through', async () => {
    const answers = {
      curate: curation({ decision: 'update', targetCollection: 'events', targetId: 5 }),
    }
    const { cms, log } = await run({ title: EVENT, ask: model(answers) })
    assert.deepEqual(cms.submitted, [])
    assert.equal(log.counts.updates, 1)
    assert.equal(log.counts.needsReview, 0)
  })

  it('still submits the same item when nothing marks it as safety', async () => {
    const { cms, log } = await run({ title: EVENT, ask: model({}) })
    assert.equal(cms.submitted.length, 1)
    assert.equal(log.counts.proposed, 1)
  })

  it('holds an item whose model answers omit the safety field, after the retry', async () => {
    const { cms } = await run({
      title: EVENT,
      ask: model({ curate: { ...curation(), safety: undefined } }),
    })
    assert.deepEqual(cms.submitted, [])
    assert.ok(reports(cms).some((w) => w.arguments.kind === 'needs-review'))
  })
})
