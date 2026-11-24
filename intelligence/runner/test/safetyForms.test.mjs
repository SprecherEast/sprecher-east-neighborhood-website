import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { compileSafetyRules } from '../lib/safety.mjs'

// The endings a term takes, one rule at a time, on terms of their own (#1007). `matches` is true
// when `text` (already folded: lowercase, single spaces) contains a form of `term`.

const matches = (term, text) =>
  compileSafetyRules({ topics: [{ id: 't', terms: [term] }], sources: [] }).topics[0].pattern.test(
    text,
  )

describe('the endings of a term', () => {
  it('adds -s, -es, -ed, -d and -ing', () => {
    for (const text of ['walks', 'walked', 'walking']) assert.equal(matches('walk', text), true)
    assert.equal(matches('box', 'boxes'), true)
    assert.equal(matches('bake', 'baked'), true)
    assert.equal(matches('bake', 'baking'), true)
    assert.equal(matches('bake', 'bakes'), true)
  })

  it('adds -er and -ers, after an e as -r and -rs', () => {
    assert.equal(matches('walk', 'walkers'), true)
    assert.equal(matches('walk', 'walker'), true)
    assert.equal(matches('bake', 'baker'), true)
    assert.equal(matches('bake', 'bakers'), true)
  })

  it('doubles a last consonant after one vowel before -ed, -ing, -er and -ers', () => {
    for (const text of ['stabbed', 'stabbing', 'stabber', 'stabbers'])
      assert.equal(matches('stab', text), true, text)
  })

  it('does not double it after two vowels, with no vowel, after a vowel, or after w, x or y', () => {
    assert.equal(matches('beat', 'beatted'), false)
    assert.equal(matches('mpd', 'mpdded'), false)
    assert.equal(matches('idea', 'ideaaed'), false)
    assert.equal(matches('box', 'boxxed'), false)
    assert.equal(matches('bow', 'bowwed'), false)
    assert.equal(matches('toy', 'toyyed'), false)
  })

  it('doubles nothing in a word of fewer than three letters, and invents no letter', () => {
    const missing = String(undefined)
    assert.equal(matches('tu', `tu${missing}ed`), false)
    assert.equal(matches('tu', `tu${missing}ers`), false)
  })

  it('puts the ending on the last word of a phrase', () => {
    assert.equal(matches('break in', 'break ins'), true)
    assert.equal(matches('break in', 'break inned'), false)
    assert.equal(matches('house fire', 'house fires'), true)
  })

  it('turns -y into -ies and -ied, -f and -fe into -ves, -man into -men', () => {
    assert.equal(matches('carry', 'carries'), true)
    assert.equal(matches('carry', 'carried'), true)
    assert.equal(matches('knife', 'knives'), true)
    assert.equal(matches('thief', 'thieves'), true)
    assert.equal(matches('gunman', 'gunmen'), true)
  })

  it('turns a Spanish -o into -a and -as', () => {
    assert.equal(matches('gato', 'gata'), true)
    assert.equal(matches('gato', 'gatas'), true)
  })

  it('matches nothing else', () => {
    assert.equal(matches('walk', 'walky'), false)
    assert.equal(matches('walk', 'swalk'), false)
  })
})
