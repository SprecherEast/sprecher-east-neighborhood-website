import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isSafety } from './safetyHelpers.mjs'

// What the definition catches (#1007): the endings a term takes, and the words the police feed
// and the weather service really use.

describe('word forms derived from the terms', () => {
  it('finds -f and -fe terms as -ves', () => {
    assert.equal(isSafety('Man with knives near school'), true)
    assert.equal(isSafety('Wolves seen near the school'), false)
  })

  it('finds agent nouns: -er and -ers, -man and -men', () => {
    for (const text of [
      'A policeman at the door',
      'Policemen on the corner',
      'Gunmen near the school',
      'Firemen on the block',
      'Burglars on the east side',
      'Robbers on the east side',
      'Thieves target scrap metal',
      'Shoplifters at the market',
      'Attacker fled on foot',
      'Kidnapper sought',
    ]) {
      assert.equal(isSafety(text), true, text)
    }
    assert.equal(isSafety('Fireman Sam story hour'), true)
    assert.equal(isSafety('A salesman at the fair'), false)
  })

  it('finds the crime words of the police feed in their forms', () => {
    for (const text of [
      'Man steals items, attempts to punch store employee',
      'Man stole a vehicle',
      'Woman punched, pistol-whipped',
      'Passerby breaks up fight',
      'Man hurts employees',
      'Five arrested for attacking stranger',
      'Attempt to identify bicycle thief',
      'Fight call on State Street',
      'Gas station armed robberies',
      'Shoplifting at the market',
      'Offender sought',
      'Suspect at gunpoint',
      'Hostage situation downtown',
      'Shootout on the north side',
      'Pedestrian hit near the park',
      'Thin ice on the lake',
    ]) {
      assert.equal(isSafety(text), true, text)
    }
  })

  it('finds the weather-service alerts seen in Wisconsin', () => {
    for (const text of [
      'Extreme Cold Watch for Dane County',
      'Freeze Watch tonight',
      'Frost Advisory until 9 AM',
      'Dense Fog Advisory',
      'Air Quality Alert for Dane County',
      'Winter Weather Advisory',
      'Lake Effect Snow Warning',
      'Red Flag Warning',
      'Severe Thunderstorm Watch',
      'Flood Watch',
    ]) {
      assert.equal(isSafety(text), true, text)
    }
  })

  it('leaves ordinary words alone', () => {
    for (const text of [
      'Wolves seen near the school',
      'A salesman at the fair',
      'Bike swap at the library',
      'Story hour for toddlers',
      'Neighborhood potluck',
    ]) {
      assert.equal(isSafety(text), false, text)
    }
  })
})
