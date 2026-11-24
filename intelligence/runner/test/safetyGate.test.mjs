import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { loadContract } from '../lib/contract.mjs'
import { gateItem } from '../lib/gate.mjs'
import { fakeAdapter } from '../lib/model.mjs'
import { runStage, runVerify } from '../lib/stages.mjs'
import { curation, verification } from './fixtures.mjs'
import { contract, intelligenceDir } from './helpers.mjs'
import { item, titled } from './safetyHelpers.mjs'

// The gate (#1007): the one place that decides what may be accepted and where it goes.

describe('gateItem', () => {
  it('holds an accept the model flagged as safety, whatever else passes', () => {
    const gated = gateItem(contract, item({ curation: { safety: true } }))
    assert.equal(gated.curation.decision, 'needs-review')
    assert.equal(gated.route, 'reportItem')
    assert.equal(gated.suggest, false)
    assert.match(gated.curation.reasons[0], /^Held for review, not accepted: safety item/)
  })

  it('holds an accept the model called not-safety when the text says otherwise', () => {
    const gated = gateItem(contract, titled('Police report: shooting on Sprecher Road'))
    assert.equal(gated.curation.decision, 'needs-review')
    assert.equal(gated.route, 'reportItem')
  })

  it('holds every accept from a listed safety source, with clean text and clean answers', () => {
    for (const sourceId of contract.safetyDefinition.sources) {
      const gated = gateItem(contract, item({ candidate: { sourceId, title: 'Notice' } }))
      assert.equal(gated.route, 'reportItem', sourceId)
    }
  })

  it('leaves a clean accept alone and routes it to a suggestion', () => {
    const built = item()
    const gated = gateItem(contract, built)
    assert.equal(gated.curation, built.curation)
    assert.equal(gated.route, 'submitSuggestion')
    assert.equal(gated.suggest, true)
  })

  it('still applies the confidence and flag guard, with the same wording', () => {
    const gated = gateItem(contract, item({ verification: { confidence: 0.1 } }))
    assert.equal(gated.curation.decision, 'needs-review')
    assert.match(
      gated.curation.reasons[0],
      /^Held for review, not accepted: verification confidence/,
    )
  })

  it('never suggests for any decision but a clean accept', () => {
    for (const decision of ['reject', 'duplicate', 'update', 'cancel', 'needs-review']) {
      for (const safety of [true, false]) {
        const built = item({
          curation: { decision, safety, targetCollection: 'posts', targetId: 4 },
        })
        const gated = gateItem(contract, built)
        assert.equal(gated.curation.decision, decision)
        assert.equal(gated.suggest, false, `${decision} ${safety}`)
      }
    }
    for (const decision of ['update', 'cancel']) {
      const built = item({
        curation: { decision, safety: true, targetCollection: 'posts', targetId: 4 },
      })
      assert.equal(gateItem(contract, built).route, 'reportItem')
    }
  })

  it('holds a decision it does not know, in any spelling', () => {
    for (const decision of [
      'ACCEPT',
      'Accept',
      'accept ',
      ' accept',
      'accepted',
      'publish',
      '',
      null,
      5,
      undefined,
    ]) {
      const built = item()
      built.curation.decision = decision
      const gated = gateItem(contract, built)
      assert.equal(gated.route, 'reportItem', String(decision))
      assert.equal(gated.curation.decision, 'needs-review', String(decision))
    }
  })

  it('holds an item with no curation, or one that is not an object', () => {
    for (const bad of [undefined, null, 'accept', 7, [], { safety: false }]) {
      const gated = gateItem(contract, { ...item(), curation: bad })
      assert.equal(gated.route, 'reportItem')
      assert.equal(gated.curation.decision, 'needs-review')
      assert.ok(gated.curation.reasons.length >= 1)
    }
  })

  it('does not change the item it was given', () => {
    const built = item({ curation: { safety: true } })
    const before = JSON.stringify(built)
    gateItem(contract, built)
    assert.equal(JSON.stringify(built), before)
  })

  describe('a change to pipeline.yaml cannot switch it off', () => {
    const real = contract.pipeline
    const changes = {
      'needs-review routed to a suggestion': {
        routes: { ...real.routes, 'needs-review': 'submitSuggestion' },
      },
      'update and cancel routed to a suggestion': {
        routes: { ...real.routes, update: 'submitSuggestion', cancel: 'submitSuggestion' },
      },
      'reject routed to a suggestion': { routes: { ...real.routes, reject: 'submitSuggestion' } },
      'no routes': { routes: undefined },
      'no promotion guard': { promotionGuard: undefined },
      'no blocking flags': { promotionGuard: { blockingFlags: [] } },
      'no escalation threshold': { escalation: undefined },
      'a threshold of zero': { escalation: { verifyBelowConfidence: 0, to: 'high' } },
      'review disabled by a stray key': { review: false, humanReview: 'off' },
    }
    for (const [name, change] of Object.entries(changes)) {
      it(`holds a safety item with ${name}`, () => {
        const changed = { ...contract, pipeline: { ...real, ...change } }
        for (const built of [
          item({ curation: { safety: true } }),
          titled('Police investigate a shooting'),
          item({ verification: { safety: true } }),
        ]) {
          const gated = gateItem(changed, built)
          assert.equal(gated.suggest, false)
          assert.notEqual(gated.curation.decision, 'accept')
        }
      })
    }

    it('holds every accept when the definition or the decision list is missing', () => {
      assert.equal(gateItem({ ...contract, safety: undefined }, item()).route, 'reportItem')
      assert.equal(gateItem({ ...contract, safety: null }, item()).route, 'reportItem')
      assert.equal(gateItem({ ...contract, schemas: {} }, item()).route, 'reportItem')
    })

    it('keeps a clean accept moving with a changed guard, so the gate is not the only brake', () => {
      const changed = { ...contract, pipeline: { ...real, promotionGuard: { blockingFlags: [] } } }
      assert.equal(gateItem(changed, item()).suggest, true)
    })
  })
})

describe('the settings are checked when the runner starts', () => {
  /** A copy of intelligence/ (without the runner) with `file` rewritten by `change`. */
  function copyWith(file, change) {
    const dir = mkdtempSync(path.join(tmpdir(), 'intel-'))
    cpSync(intelligenceDir, dir, {
      recursive: true,
      filter: (source) => !source.includes(`${path.sep}runner`) && !source.includes('node_modules'),
    })
    const target = path.join(dir, file)
    writeFileSync(target, change(readFileSync(target, 'utf8')))
    return dir
  }

  it('loads the real settings', () => {
    assert.doesNotThrow(() => loadContract(copyWith('pipeline.yaml', (text) => text)))
  })

  it('refuses a pipeline.yaml that routes a held decision to a suggestion', () => {
    const dir = copyWith('pipeline.yaml', (text) =>
      text.replace('needs-review: reportItem', 'needs-review: submitSuggestion'),
    )
    assert.throws(() => loadContract(dir), /pipeline\.yaml/)
  })

  it('refuses a pipeline.yaml that points at another safety file', () => {
    const dir = copyWith('pipeline.yaml', (text) =>
      text.replace('safety: safety.yaml', 'safety: area.yaml'),
    )
    assert.throws(() => loadContract(dir), /pipeline\.yaml/)
  })

  it('refuses a safety source id that names no registered source', () => {
    const dir = copyWith('safety.yaml', (text) => `${text.trimEnd()}\n  - no-such-source\n`)
    assert.throws(() => loadContract(dir), /no-such-source|safety\.yaml/)
  })

  it('refuses a safety.yaml with no topics', () => {
    const dir = copyWith('safety.yaml', () => 'version: 1\nmeaning: x\ntopics: []\nsources: []\n')
    assert.throws(() => loadContract(dir), /safety\.yaml/)
  })
})

describe('once a stage says safety, it stays safety', () => {
  const stageItem = item()
  const answers = (list) => {
    const queue = [...list]
    return fakeAdapter(() => queue.shift())
  }

  it('keeps a first safety answer when verify is rerun at high effort', async () => {
    const ask = answers([
      verification({ confidence: 0.3, safety: true }),
      verification({ confidence: 0.9, safety: false }),
    ])
    const result = await runVerify(contract, ask, stageItem)
    assert.equal(result.escalated, true)
    assert.equal(result.output.safety, true)
  })

  it('keeps a safety answer from a first answer that failed its schema', async () => {
    const invalid = { ...curation(), safety: true, decision: 'accepted' }
    const result = await runStage(
      contract,
      answers([invalid, curation({ safety: false })]),
      'curate',
      stageItem,
    )
    assert.equal(result.attempts, 2)
    assert.equal(result.output.safety, true)
  })

  it('does not invent a safety answer', async () => {
    const result = await runStage(
      contract,
      answers([curation({ safety: false })]),
      'curate',
      stageItem,
    )
    assert.equal(result.output.safety, false)
  })
})
