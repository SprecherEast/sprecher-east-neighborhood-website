import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { newErrorLog } from '../lib/errorLog.mjs'

// The run log's `errors` list (#1434): real errors stop at a cap, and the notes a run adds at the
// end (the background note, the low-events note) always have their place and are not errors.

describe('the run log’s errors and notes', () => {
  it('keeps an error as text of at most 500 characters', () => {
    const log = newErrorLog()
    log.addError('x'.repeat(600))
    assert.equal(log.errors[0].length, 500)
  })

  it('stops real errors before the cap, so a note still fits', () => {
    const log = newErrorLog(10, 2)
    for (let i = 0; i < 30; i++) log.addError(`error ${i}`)
    assert.equal(log.errors.length, 8)
    log.addNote('Background: a note')
    log.addNote('Low: another')
    assert.equal(log.errors.length, 10)
    assert.ok(log.errors.includes('Background: a note'))
  })

  it('knows which entries are notes, so a console line can leave them out', () => {
    const log = newErrorLog()
    log.addError('a real error')
    log.addNote('Background: a note')
    assert.deepEqual(log.notes, ['Background: a note'])
    assert.deepEqual(log.errors, ['a real error', 'Background: a note'])
  })

  it('does not count notes as errors for the run’s status', () => {
    const log = newErrorLog()
    log.addNote('Background: a note')
    assert.equal(log.problemCount(), 0)
    log.addError('real')
    assert.equal(log.problemCount(), 1)
  })
})
