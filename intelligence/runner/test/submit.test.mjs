import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { dryRunCms } from '../lib/cms.mjs'
import { submitItem } from '../lib/submit.mjs'
import { candidate, curation, draft, verification } from './fixtures.mjs'
import { contract, evalCases, grade } from './helpers.mjs'

// Submit (prompts/submit.md) and its evals (evals/submit.yaml): routing, the envelope, validation,
// retries and the follow-up reports.

const validate = contract.validator('schemas/submission.schema.json')
const validReport = contract.validator('schemas/report.schema.json')
const runId = 'intel-test-run'
const item = (over = {}) => ({
  candidate: candidate(over.candidate),
  verification: verification(over.verification),
  curation: curation(over.curation),
  draft: over.draft === null ? undefined : draft(over.draft),
})

/** A CMS double whose submitSuggestion answers `answers` in order ('transient-error', 'created'…). */
function cmsWith(answers = ['created']) {
  const cms = dryRunCms(null)
  const queue = [...answers]
  const submitted = []
  cms.submitSuggestion = async (args) => {
    submitted.push(args)
    const next = queue.shift() ?? 'created'
    if (next === 'transient-error') throw new Error('fetch failed: 503')
    if (next === 'duplicate') return { status: 'duplicate', id: 7 }
    return { status: 'created', id: 41 }
  }
  return Object.assign(cms, { submitted })
}

describe('submit', () => {
  it('sends a valid suggestion with summary, categories and provenance', async () => {
    const cms = cmsWith()
    const result = await submitItem(item(), { cms, runId, validate, contract })
    assert.equal(result.outcome, 'created')
    assert.deepEqual(validate(result.calls[0]), [])
    assert.equal(cms.submitted[0].summary, draft().summary)
    assert.deepEqual(cms.submitted[0].categories, ['community'])
    assert.equal(cms.submitted[0].externalId, candidate().externalId)
    assert.equal(cms.writes.length, 0)
  })

  it('reports image candidates as links with their credit, never uploads them', async () => {
    const image = {
      imageUrl: `https://www.madisonpubliclibrary.org/${'x'.repeat(240)}.jpg`,
      pageUrl: 'https://www.madisonpubliclibrary.org/events/1',
      credit: 'c'.repeat(200),
    }
    const cms = cmsWith()
    const result = await submitItem(item({ draft: { imageCandidates: [image] } }), {
      cms,
      runId,
      validate,
      contract,
    })
    const report = cms.writes.find((w) => w.tool === 'reportItem').arguments
    assert.deepEqual(report.flags, ['image-candidate'])
    assert.deepEqual([report.targetCollection, report.targetId], ['events', 41])
    assert.equal(report.evidence[0].url, image.pageUrl)
    assert.ok(report.evidence[0].says.includes(image.imageUrl))
    assert.deepEqual(validReport(report), [])
    assert.ok(!('imageCandidates' in cms.submitted[0]))
    assert.equal(result.outcome, 'created')
  })

  it('follows a suggestion with missing facts with a review note on it', async () => {
    const cms = cmsWith()
    await submitItem(item({ draft: { missing: ['address not confirmed'] } }), {
      cms,
      runId,
      validate,
      contract,
    })
    const [note] = cms.writes
    assert.equal(note.arguments.kind, 'needs-review')
    assert.match(note.arguments.summary, /address not confirmed/)
  })

  it('reports an update or a cancellation against the known document, never a new draft', async () => {
    const cms = cmsWith()
    const cancel = item({
      curation: { decision: 'cancel', targetCollection: 'events', targetId: 12 },
      draft: null,
    })
    const result = await submitItem(cancel, { cms, runId, validate, contract })
    assert.equal(result.outcome, 'reported')
    assert.deepEqual(cms.submitted, [])
    assert.deepEqual(validReport(cms.writes[0].arguments), [])
    assert.equal(cms.writes[0].arguments.kind, 'cancel')
    assert.equal(cms.writes[0].arguments.targetId, 12)
  })
})

describe('submit evals', () => {
  const { cases } = evalCases('submit')
  for (const c of cases.filter((x) => x.expected.route !== 'none')) {
    it(`${c.id}: ${c.why.slice(0, 80)}`, async () => {
      const given = c.given ?? {}
      const built = {
        candidate: candidate({
          ...c.input,
          sourceStatus: c.input.sourceStatus ?? 'scheduled',
          externalId: c.input.externalId ?? `${c.input.sourceId}:eval`,
          contentHash: c.input.contentHash ?? 'a'.repeat(64),
        }),
        verification: verification(given.verification),
        curation: curation(given.curation),
        // Only what the case gives: a missing field must fail validation, as in SB2
        draft: given.draft ? { ...given.draft } : undefined,
      }
      if (c.input.sourceUrl === null) built.candidate.sourceUrl = null
      const cms = cmsWith(given.run?.mcpAnswers)
      // The gate picks the route from pipeline.yaml and safety.yaml, as in a run
      const result = await submitItem(built, { cms, runId, validate, contract })
      if (c.expected.reportKind) {
        const report = cms.writes.find((w) => w.tool === 'reportItem')
        assert.equal(report?.arguments.kind, c.expected.reportKind)
      } else {
        assert.equal(result.calls[0].tool, c.expected.route)
        assert.equal(result.calls[0].action, 'call')
      }
      if (c.expected.retries !== undefined)
        assert.equal(cms.submitted.length - 1, c.expected.retries)
      for (const grader of c.graders ?? []) {
        const verdict = grade(grader, result.calls[0])
        if (verdict !== null) assert.ok(verdict, `${grader.check} ${grader.field}`)
      }
    })
  }
})
