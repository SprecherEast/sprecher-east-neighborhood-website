import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { submitItem } from '../lib/submit.mjs'
import { contract } from './helpers.mjs'
import { cmsWithLog, item, runId } from './safetyHelpers.mjs'

// Nothing is sent before the gate (#1007): submit runs it and obeys the tool it names.

const validate = contract.validator('schemas/submission.schema.json')

describe('submitItem', () => {
  it('reports a safety item for review even when the caller asks for a suggestion', async () => {
    for (const built of [
      item({ curation: { safety: true }, draft: {} }),
      item({ candidate: { sourceId: 'madison-police-incident-reports' }, draft: {} }),
    ]) {
      const cms = cmsWithLog()
      const result = await submitItem(built, {
        cms,
        runId,
        validate,
        contract,
        route: 'submitSuggestion',
      })
      assert.deepEqual(cms.submitted, [])
      assert.equal(result.outcome, 'reported')
      assert.equal(
        cms.writes.filter((w) => w.tool === 'reportItem')[0].arguments.kind,
        'needs-review',
      )
      assert.deepEqual(validate(result.calls[0]), [])
    }
  })

  it('sends a clean accept as before', async () => {
    const cms = cmsWithLog()
    const result = await submitItem(item({ draft: {} }), { cms, runId, validate, contract })
    assert.equal(result.outcome, 'created')
    assert.equal(cms.submitted.length, 1)
  })

  it('sends nothing when the gate’s tool is none: a reject or duplicate that carries a draft', async () => {
    for (const decision of ['reject', 'duplicate']) {
      const cms = cmsWithLog()
      const built = item({ curation: { decision }, draft: {} })
      const result = await submitItem(built, { cms, runId, validate, contract })
      assert.equal(result.outcome, 'none', decision)
      assert.deepEqual([cms.submitted, cms.writes, result.calls], [[], [], []], decision)
    }
  })

  it('sends nothing for a clean accept when pipeline.yaml routes accept to none', async () => {
    const cms = cmsWithLog()
    const none = {
      ...contract,
      pipeline: { ...contract.pipeline, routes: { ...contract.pipeline.routes, accept: 'none' } },
    }
    const result = await submitItem(item({ draft: {} }), { cms, runId, validate, contract: none })
    assert.equal(result.outcome, 'none')
    assert.deepEqual([cms.submitted, cms.writes], [[], []])
  })

  it('refuses to send anything without the contract that holds the gate', async () => {
    const cms = cmsWithLog()
    await assert.rejects(() => submitItem(item({ draft: {} }), { cms, runId, validate }))
    assert.deepEqual([cms.submitted, cms.writes], [[], []])
  })
})
