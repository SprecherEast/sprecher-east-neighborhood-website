import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { placementNote } from '../lib/submit.mjs'
import { clip } from '../lib/text.mjs'

// What an editor reads about how an item was placed (#1009), and the cut that keeps it short.

const placement = (over) => ({
  method: 'boundary',
  inside: true,
  reason: 'r',
  overrode: false,
  ...over,
})

describe('the placement note for an editor', () => {
  it('says nothing for an item that was never placed', () => {
    assert.equal(placementNote(undefined), '')
    assert.equal(placementNote(null), '')
  })

  it('says inside or outside by the boundary, and when it went over the word match', () => {
    assert.equal(placementNote(placement()), 'Placed by the boundary: inside the area.')
    assert.equal(
      placementNote(placement({ inside: false })),
      'Placed by the boundary: outside the area.',
    )
    assert.equal(
      placementNote(placement({ overrode: true })),
      'Placed by the boundary: inside the area, over the word match.',
    )
  })

  it('says word match, or that no place was given', () => {
    assert.equal(placementNote(placement({ method: 'word-match' })), 'Placed by word match.')
    assert.equal(placementNote(placement({ method: 'unplaced' })), 'Not placed: no place given.')
  })
})

describe('clip', () => {
  it('keeps a text within the limit and cuts a longer one with an ellipsis', () => {
    assert.equal(clip('abc', 3), 'abc')
    assert.equal(clip('abcd', 3), 'ab…')
    assert.equal(clip('', 3), '')
  })
})
