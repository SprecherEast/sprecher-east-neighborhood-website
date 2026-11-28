import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { guardPromotion } from '../lib/stages.mjs'

const pipeline = {
  escalation: { verifyBelowConfidence: 0.6 },
  promotionGuard: { blockingFlags: ['missing-date'] },
}
const accept = { decision: 'accept', reasons: ['Looks right.'] }

describe('guardPromotion', () => {
  it('leaves an accept with enough confidence and no blocking flag alone', () => {
    assert.equal(guardPromotion(pipeline, { confidence: 0.9, flags: [] }, accept), accept)
  })

  it('leaves every other decision untouched, even at low confidence', () => {
    const reject = { decision: 'reject', reasons: ['No.'] }
    assert.equal(
      guardPromotion(pipeline, { confidence: 0.1, flags: ['missing-date'] }, reject),
      reject,
    )
  })

  it('holds an accept whose confidence is missing or not a number', () => {
    for (const confidence of [undefined, Number.NaN]) {
      const held = guardPromotion(pipeline, { confidence, flags: [] }, accept)
      assert.equal(held.decision, 'needs-review')
    }
  })

  it('keeps only readable reasons, each cut to 300 characters', () => {
    const odd = { decision: 'accept', reasons: [null, '', 7, 'x'.repeat(400), 'fine'] }
    const held = guardPromotion(pipeline, { confidence: 0.2, flags: [] }, odd)
    assert.equal(held.reasons.length, 3)
    assert.match(held.reasons[0], /^Held for review/)
    assert.deepEqual(held.reasons.slice(1), ['x'.repeat(300), 'fine'])
  })

  it('keeps at most five reasons, the new one first', () => {
    const many = { decision: 'accept', reasons: ['1', '2', '3', '4', '5'] }
    const held = guardPromotion(pipeline, { confidence: 0.2, flags: [] }, many)
    assert.equal(held.reasons.length, 5)
    assert.match(held.reasons[0], /^Held for review/)
  })
})
