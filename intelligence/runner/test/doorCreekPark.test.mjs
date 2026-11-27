import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import { pointPlace } from '../lib/boundary.mjs'
import { INSIDE, PARK_SOUTH_ACCESS } from './geoFixtures.mjs'
import { contract, evalCases, intelligenceDir } from './helpers.mjs'
import { boundary, item, located, setup } from './placeHelpers.mjs'

// The Door Creek Park shelter and the northern part of the park are inside the area, not nearby
// (the owner's decisions, #1009 and #1547); the park's southern end is outside the City's boundary.
// Named with no address, the park is placed by the area's words; an address is placed by the
// boundary. coverage.md defines the tiers once.

const tierRow = (tier) =>
  contract.coverage.split('\n').find((line) => line.startsWith(`| \`${tier}\``)) ?? ''

describe('the tier of Door Creek Park', () => {
  it('is core for the shelter and the northern part in the policy, and the park is not listed as nearby', () => {
    assert.match(tierRow('core'), /Door Creek Park/)
    assert.match(tierRow('core'), /shelter/)
    assert.match(tierRow('core'), /northern part/)
    assert.match(tierRow('core'), /southern end/)
    assert.doesNotMatch(tierRow('catchment'), /Door Creek Park/)
  })

  it('says how an item that names only the park is read', () => {
    assert.match(contract.coverage, /naming only\s+"Door Creek\s+Park" keeps `core`/)
  })

  it('has a shelter inside and a southern access point outside the City’s boundary copy', () => {
    assert.equal(pointPlace(boundary, INSIDE), 'inside')
    assert.equal(pointPlace(boundary, PARK_SOUTH_ACCESS), 'outside')
  })

  it('is a place word, so a text that names the park is read as about the area', () => {
    assert.ok(contract.area.places.includes('door creek'))
  })

  it('is core in every eval case that names the park without an address', () => {
    const files = readdirSync(path.join(intelligenceDir, 'evals')).map((f) =>
      f.replace('.yaml', ''),
    )
    let seen = 0
    for (const file of files) {
      for (const c of evalCases(file).cases) {
        const named = /^Door Creek Park(, Madison)?$/.test(c.input?.locationText ?? '')
        const tiers = [c.expected?.coverage, c.given?.verification?.coverage].filter(Boolean)
        if (!named) continue
        seen++
        for (const tier of tiers) assert.equal(tier, 'core', `${c.id}: ${tier}`)
      }
    }
    assert.ok(seen >= 6, `only ${seen} cases name the park`)
  })
})

describe('an item at Door Creek Park', () => {
  it('named with no address keeps verify’s core by the word match, and asks nothing', async () => {
    const { place, geocode } = setup()
    const out = await place(located(null, { coverage: 'core', flags: [] }), item('Door Creek Park'))
    assert.deepEqual(
      [out.placement.method, out.coverage, out.placement.overrode, out.flags],
      ['word-match', 'core', false, []],
    )
    assert.deepEqual(geocode.asked, [])
  })

  it('at the shelter’s address is inside by the boundary, and core', async () => {
    for (const coverage of ['core', 'catchment']) {
      const { place, geocode } = setup()
      const v = located('7035 Littlemore Dr', { coverage, flags: [] })
      const out = await place(v, item('Door Creek Park Shelter, 7035 Littlemore Dr, Madison, WI'))
      assert.deepEqual(
        [out.placement.method, out.placement.inside, out.coverage, out.flags],
        ['boundary', true, 'core', []],
        coverage,
      )
      assert.deepEqual(geocode.asked, ['7035 Littlemore Dr'])
    }
  })

  it('at the park’s southern access point is outside by the boundary, never core', async () => {
    for (const coverage of ['core', 'catchment']) {
      const { place, geocode } = setup()
      const v = located('7202 Cottage Grove Rd', { coverage, flags: [] })
      const out = await place(v, item('Door Creek Park, 7202 Cottage Grove Rd, Madison, WI'))
      assert.equal(out.placement.method, 'boundary', coverage)
      assert.equal(out.placement.inside, false, coverage)
      assert.notEqual(out.coverage, 'core', coverage)
      assert.deepEqual(geocode.asked, ['7202 Cottage Grove Rd'])
    }
  })
})
