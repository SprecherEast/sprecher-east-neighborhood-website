import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { contract } from './helpers.mjs'
import { classify, isSafety, item } from './safetyHelpers.mjs'

// What counts as a safety item (#1007): inflections, words the first list missed, and holds that
// come from a stated rule, never from a side effect.

const terms = contract.safetyDefinition.topics.flatMap((t) => t.terms)

describe('classifySafety: inflections and words the first list missed', () => {
  const examples = [
    // The review's examples: verbs, root words, Spanish
    'Man stabbed on Cottage Grove Road',
    'Store robbed',
    'Child kidnapped',
    'Car carjacked',
    'Burglar caught on camera',
    'Home burglarized',
    'Cars vandalized',
    'Man drowned at lake',
    'Teen dies at lake',
    'Man threatened neighbors',
    'Man with a knife near school',
    'Explosive device found',
    'House blaze on Sprecher Rd',
    'Smoke and flames seen',
    'Snowstorm coming',
    'Hail and high winds',
    'Downed power lines',
    'Chemical spill on Highway 30',
    'Boy shot near Sprecher Park',
    'Shots heard near park',
    'MPD investigating disturbance',
    'Deputies respond to a call',
    'Structure fire downtown',
    'Hombre baleado',
    'Mujer apuñalada',
    'Joven asesinado',
    'Asaltan tienda',
    'Hombre armado cerca de la escuela',
    'Robaron un auto',
    'Fuego en casa',
    'Flu shots at the clinic',
  ]
  for (const text of examples) it(`holds "${text}"`, () => assert.equal(isSafety(text), true))

  it('lists the root words those examples come from', () => {
    for (const root of [
      'stab',
      'rob',
      'kidnap',
      'carjack',
      'burglar',
      'vandal',
      'drown',
      'die',
      'dying',
      'knife',
      'explosive',
      'blaze',
      'shot',
      'mpd',
      'deputy',
      'disturbance',
      'snowstorm',
      'hail',
    ]) {
      assert.ok(terms.includes(root), root)
    }
  })

  it('does not hold everyday words the list leaves out on purpose', () => {
    for (const text of [
      'Storm drain stenciling day',
      'Election of officers',
      'Campfire stories',
      'Smoke-free housing meeting',
    ]) {
      assert.equal(isSafety(text), false, text)
    }
  })
})

describe('classifySafety: a hold comes from a rule, never from a side effect', () => {
  it('does not hold a term found inside a longer word', () => {
    for (const text of [
      'Tech troubleshooting help',
      'Groundbreaking ceremony',
      'Breaking Bread dinner',
      'Skilled trades job fair',
      'Public notice: stormwater drain stenciling',
      'Office stormwater review',
      'Kids about age 6',
      'Kimball Bar & Restaurant',
      'Sheridan Triangle potluck',
      'Class ault-ernative crafts',
      'Firefly night, Gunderson Lane, Shotwell Road',
    ]) {
      assert.equal(isSafety(text), false, text)
    }
  })

  it('holds a term of six letters or more split by single spaces, at word edges', () => {
    for (const text of [
      'po lice report',
      'sho oting downtown',
      'as sault reported',
      'p o l i c e',
      'evac uation ordered',
      'fire fighters respond',
    ]) {
      assert.equal(isSafety(text), true, text)
    }
  })

  it('does not read the stages’ reasons, so a note that says "not a safety item" holds nothing', () => {
    const notes = ['Not a safety item.', 'No crime or emergency involved.', 'Safe for all ages.']
    assert.equal(classify(item({ curation: { reasons: notes } })).safety, false)
    assert.equal(classify(item({ verification: { coverageReason: notes[1] } })).safety, false)
  })

  it('holds a term split across two fields, and a hazard the model describes in its own words', () => {
    const split = item({
      candidate: { title: 'Neighbors report a break', sourceText: 'in at the corner house' },
    })
    assert.equal(classify(split).safety, true)
    const apart = item({
      candidate: { title: 'Neighbors report a break', sourceText: 'at the corner house' },
    })
    assert.equal(classify(apart).safety, false)
    for (const field of ['whyItMatters', 'residentAction']) {
      assert.equal(
        classify(item({ curation: { [field]: 'A fire on the block' } })).safety,
        true,
        field,
      )
    }
    for (const field of ['location', 'evidence']) {
      assert.equal(classify(item({ verification: { [field]: 'Police report' } })).safety, true)
    }
  })
})
