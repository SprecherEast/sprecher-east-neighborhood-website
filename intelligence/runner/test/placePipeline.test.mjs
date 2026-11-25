import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { staleBoundaryProblem } from '../lib/boundary.mjs'
import { loadContract } from '../lib/contract.mjs'
import { robotsChecker } from '../lib/fetchSource.mjs'
import { fakeAdapter } from '../lib/model.mjs'
import { runPipeline } from '../lib/pipeline.mjs'
import { curation, draft, feedsHttp, verification } from './fixtures.mjs'
import { INSIDE, JUST_OUTSIDE } from './geoFixtures.mjs'
import { contract, contractOn, intelligenceCopy } from './helpers.mjs'
import { cmsWithLog } from './safetyHelpers.mjs'

// The boundary test inside a whole run (#1009): the placement reaches the next stage and the
// editor, a locator that is down costs nothing but the placement, a bad copy stops the start,
// and a safety item stays held wherever the boundary puts it.

const now = () => new Date('2026-10-25T17:00:00Z')
const EVENT = 'Silent Book Club'

const run = async ({ ask, geocode, pipelineContract = contractOn('2026-10-25') }) => {
  const http = feedsHttp()
  const cms = cmsWithLog()
  cms.taxonomy = async () => [{ slug: 'community', title: 'Community', parent: null }]
  const result = await runPipeline({
    contract: pipelineContract,
    cms,
    ask: fakeAdapter(ask),
    state: { sources: {}, seen: {} },
    http,
    robots: robotsChecker(http),
    geocode,
    repoCommit: 'a'.repeat(40),
    now,
  })
  return { ...result, cms }
}
const library = (it) => it.candidate.title.includes(EVENT)
const model =
  ({ verify = verification(), curate = curation(), seen = [] } = {}) =>
  ({ stageId, item }) => {
    if (!library(item)) {
      return stageId === 'curate'
        ? curation({ decision: 'reject', reasons: ['No.'] })
        : stageId === 'verify'
          ? verification()
          : draft()
    }
    seen.push({ stageId, item: structuredClone(item) })
    return { verify, curate, draft: draft() }[stageId]
  }
const point = (p) => async () => ({ status: 'match', point: p })
const reports = (cms) => cms.writes.filter((w) => w.tool === 'reportItem')

describe('a run with the boundary test', () => {
  it('hands curate the placement, and a tier that agrees with it goes through', async () => {
    const seen = []
    const { cms, log } = await run({
      ask: model({ verify: verification({ coverage: 'core' }), seen }),
      geocode: point(INSIDE),
    })
    const curateItem = seen.find((s) => s.stageId === 'curate').item
    assert.equal(curateItem.verification.placement.method, 'boundary')
    assert.equal(curateItem.verification.placement.inside, true)
    assert.deepEqual(contract.validator('schemas/item.schema.json')(curateItem), [])
    assert.equal(cms.submitted.length, 1)
    assert.equal(log.counts.proposed, 1)
    assert.equal(log.status, 'succeeded')
  })

  it('holds for review a tier the boundary disagrees with, and tells the editor how it was placed', async () => {
    const { cms, log } = await run({
      ask: model({ verify: verification({ coverage: 'core' }) }),
      geocode: point(JUST_OUTSIDE),
    })
    assert.deepEqual(cms.submitted, [])
    assert.equal(log.counts.needsReview, 1)
    const [report] = reports(cms)
    assert.match(report.arguments.summary, /Placed by the boundary: outside the area/)
    assert.deepEqual(report.arguments.flags, ['ambiguous-location'])
  })

  it('says in a report that the item was placed by word match when nothing resolved', async () => {
    const { cms } = await run({
      ask: model({ verify: verification({ confidence: 0.3 }) }),
      geocode: async () => ({ status: 'none' }),
    })
    assert.match(reports(cms)[0].arguments.summary, /Placed by word match/)
  })

  it('goes on with the word match when the locator is down, and says so once in the run log', async () => {
    const { cms, log } = await run({
      ask: model(),
      geocode: async () => ({ status: 'failed', error: 'down' }),
    })
    assert.equal(cms.submitted.length, 1)
    assert.equal(log.status, 'partial')
    assert.equal(log.errors.filter((e) => /locator/.test(e)).length, 1)
  })

  it('asks the locator nothing once the run has less time than one request needs', async () => {
    const asked = []
    const budgets = { ...contract.pipeline.budgets, maxMinutesPerRun: 0.05 }
    const { cms, log } = await run({
      ask: model(),
      geocode: async (street) => {
        asked.push(street)
        return { status: 'match', point: INSIDE }
      },
      pipelineContract: {
        ...contractOn('2026-10-25'),
        pipeline: { ...contract.pipeline, budgets },
      },
    })
    assert.deepEqual(asked, [])
    assert.equal(cms.submitted.length, 1)
    assert.equal(log.status, 'succeeded')
  })

  it('runs with no geocoder at all as before, by word match', async () => {
    const { cms, log } = await run({ ask: model() })
    assert.equal(cms.submitted.length, 1)
    assert.equal(log.status, 'succeeded')
  })

  it('tells the run log when the copy of the boundary is older than its limit', async () => {
    const { log } = await run({
      ask: model(),
      pipelineContract: {
        ...contract,
        boundary: { ...contract.boundary, fetchedAt: '2020-01-01' },
      },
    })
    assert.ok(log.errors.some((e) => /boundary.*days old/.test(e)))
    assert.equal(log.status, 'partial')
  })

  it('reports the age only when it is over the limit', () => {
    const { maxAgeDays } = contract.area.boundary
    const at = (days) => new Date(Date.parse('2026-11-24T12:00:00Z') + days * 86_400_000)
    assert.equal(staleBoundaryProblem(contract.boundary, contract.area.boundary, at(0)), null)
    const edge = Date.parse(`${contract.boundary.fetchedAt}T12:00:00Z`) + maxAgeDays * 86_400_000
    assert.equal(
      staleBoundaryProblem(contract.boundary, contract.area.boundary, new Date(edge)),
      null,
    )
    assert.match(
      staleBoundaryProblem(contract.boundary, contract.area.boundary, new Date(edge + 86_400_000)),
      /days old/,
    )
  })
})

describe('a safety item and the boundary', () => {
  const held = (cms) =>
    reports(cms).filter((w) => /Decision: needs-review/.test(w.arguments.summary))

  const TIERS = ['core', 'catchment', 'unknown', 'citywide', 'outside']
  for (const [where, p] of [
    ['inside', INSIDE],
    ['outside', JUST_OUTSIDE],
  ]) {
    for (const coverage of TIERS) {
      for (const stage of ['verify', 'curate']) {
        it(`stays held when ${stage} says safety, the address is ${where} the area and verify said ${coverage}`, async () => {
          const answers =
            stage === 'verify'
              ? { verify: verification({ coverage, safety: true }) }
              : { verify: verification({ coverage }), curate: curation({ safety: true }) }
          const { cms, log } = await run({ ask: model(answers), geocode: point(p) })
          assert.deepEqual(cms.submitted, [])
          assert.equal(held(cms).length, 1)
          assert.equal(log.counts.proposed, 0)
        })
      }
    }
  }

  it('keeps the safety answer exactly as verify gave it, in the item the gate reads', async () => {
    const seen = []
    await run({
      ask: model({ verify: verification({ coverage: 'core', safety: true }), seen }),
      geocode: point(INSIDE),
    })
    const final = seen.find((s) => s.stageId === 'curate').item
    assert.equal(final.verification.safety, true)
  })

  it('holds a source that is always held, with the address inside the area', async () => {
    const always = { ...contract, safety: { sources: new Set(['mpl-pinney-events']) } }
    const { cms } = await run({
      ask: model({ verify: verification({ coverage: 'core' }) }),
      geocode: point(INSIDE),
      pipelineContract: always,
    })
    assert.deepEqual(cms.submitted, [])
  })
})

describe('the start refuses a boundary that can’t be used', () => {
  const copyWith = (change) => intelligenceCopy({ 'boundary.json': change })
  const refuses = (change, pattern) => assert.throws(() => loadContract(copyWith(change)), pattern)

  it('loads the real one', () => assert.doesNotThrow(() => loadContract(copyWith((t) => t))))
  it('refuses a file that isn’t JSON', () => refuses('not json', /boundary\.json/))
  it('refuses a ring that isn’t closed', () =>
    refuses((text) => {
      const data = JSON.parse(text)
      data.geometry.coordinates[0].pop()
      return JSON.stringify(data)
    }, /closed/))
  it('refuses the wrong feature', () =>
    refuses((text) => JSON.stringify({ ...JSON.parse(text), naId: 1 }), /naId/))
  it('refuses a polygon with a coordinate that isn’t a number', () =>
    refuses((text) => text.replace('43.1036515', '"north"'), /boundary\.json/))
  it('refuses a date that isn’t a date, which only the schema of the copy can see', () =>
    refuses((text) => JSON.stringify({ ...JSON.parse(text), fetchedAt: 'yesterday' }), /fetchedAt/))
  it('refuses an area.yaml that points at no file', () =>
    assert.throws(
      () =>
        loadContract(
          intelligenceCopy({
            'area.yaml': (t) => t.replace('file: boundary.json', 'file: nope.json'),
          }),
        ),
      /nope\.json/,
    ))
})
