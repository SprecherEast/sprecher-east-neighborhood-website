import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { compileSafetyRules, classifySafety } from '../lib/safety.mjs'
import { contract } from './helpers.mjs'
import { classify, isSafety, item, titled } from './safetyHelpers.mjs'

// What counts as a safety item (#1007): the stages' answers, safety.yaml's terms and sources,
// every text field, and the disguises a source or a model could try.

describe('classifySafety: the stages’ answers', () => {
  it('lets an item through only when verify and curate both say false and nothing matches', () => {
    assert.equal(classify(item()).safety, false)
  })

  it('treats either stage saying true as safety', () => {
    assert.equal(classify(item({ verification: { safety: true } })).safety, true)
    assert.equal(classify(item({ curation: { safety: true } })).safety, true)
  })

  for (const value of [undefined, null, 'false', 'False', 'no', 0, '', [], {}, 'safe']) {
    for (const stage of ['verification', 'curation']) {
      it(`fails closed when ${stage}.safety is ${JSON.stringify(value) ?? 'missing'}`, () => {
        const built = item()
        built[stage].safety = value
        assert.equal(classify(built).safety, true)
      })
    }
  }

  it('fails closed on a misspelled field, a missing section or an unreadable item', () => {
    const misspelled = item()
    misspelled.curation = { ...misspelled.curation, safety: undefined, Safety: true }
    assert.equal(classify(misspelled).safety, true)
    for (const section of ['verification', 'curation', 'candidate']) {
      assert.equal(classify({ ...item(), [section]: undefined }).safety, true, section)
    }
    for (const bad of [null, 'accept', 7, []]) assert.equal(classify(bad).safety, true)
    const throwing = item()
    Object.defineProperty(throwing.candidate, 'title', {
      get() {
        throw new Error('boom')
      },
    })
    assert.equal(classify(throwing).safety, true)
  })

  it('still honors the stages when the definition has no terms, and fails closed with none', () => {
    const empty = compileSafetyRules({ version: 1, topics: [] })
    assert.equal(classifySafety(empty, item()).safety, false)
    assert.equal(classifySafety(empty, item({ curation: { safety: true } })).safety, true)
    assert.equal(classifySafety(undefined, item()).safety, true)
  })
})

const terms = contract.safetyDefinition.topics.flatMap((t) => t.terms)

describe('classifySafety: the terms', () => {
  const found = [
    'Police investigate shooting near the park',
    'POLICE INVESTIGATE SHOOTING',
    'Break-in reported on Sprecher Road',
    'Burglaries up this month',
    'Tornado warning for Dane County',
    'Traffic signal outage at Sprecher Road and Cottage Grove Road',
    'Boil water advisory',
    'Public safety update',
    'Hazardous road conditions tonight',
    // The review's examples (M1 to M3)
    'A man with a weapon near the school',
    "Man shot on Madison's east side",
    'Death investigation underway',
    'Arson at a vacant house',
    'Bomb threat at the school',
    'School lockdown lifted',
    'Shelter in place order for the area',
    'Missing teen last seen on Sprecher Road',
    'Two injuries reported',
    'Fatalities in the crash',
    'Firefighters respond to a house',
    'Special Weather Statement for Dane County',
    'Severe thunderstorm watch',
    'Excessive heat watch',
    'Hit and run on Cottage Grove Road',
    'Suspicious package reported',
    'Stolen car found',
    'Accident on the interstate',
    'Emergencies handled overnight',
    'Several advisories issued',
  ]
  for (const text of found) {
    it(`holds "${text}" in the title, the text or the place`, () => {
      assert.equal(isSafety(text), true)
      assert.equal(classify(item({ candidate: { sourceText: text } })).safety, true)
      assert.equal(classify(item({ candidate: { locationText: text } })).safety, true)
    })
  }

  it('does not call ordinary items safety items', () => {
    for (const text of [
      'Silent Book Club',
      'Free coat drive at east side libraries',
      'Sidewalk and lighting on Sprecher Road',
      'Common Council',
      'Fireworks and a picnic',
    ]) {
      assert.equal(isSafety(text), false, text)
    }
  })

  it('matches every listed term, and its plural, in a sentence', () => {
    for (const term of terms) {
      assert.equal(isSafety(`Notice: ${term} today`), true, term)
      const plural = term.endsWith('y') ? `${term.slice(0, -1)}ies` : `${term}s`
      assert.equal(isSafety(`Notice: ${plural} today`), true, plural)
    }
  })

  it('matches regular and irregular forms of the listed terms', () => {
    for (const text of [
      'injuries',
      'emergencies',
      'fatalities',
      'advisories',
      'burglaries',
      'robberies',
      'arrested',
      'evacuating',
      'flooded',
      'crashes',
      'incidents',
    ]) {
      assert.equal(isSafety(`Notice: ${text} today`), true, text)
    }
  })

  it('has four or more topics, each with terms', () => {
    const { topics } = contract.safetyDefinition
    assert.ok(topics.length >= 4)
    for (const topic of topics) assert.ok(topic.terms.length > 0, topic.id)
  })

  it('names topics from the definition, never the item’s own words', () => {
    const result = classify(titled('Shooting near the park, XYZZY-UNIQUE'))
    assert.ok(result.topics.length > 0)
    assert.ok(!JSON.stringify(result).includes('XYZZY'))
  })
})
