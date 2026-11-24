import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import { contract, evalCases, intelligenceDir } from './helpers.mjs'
import { item, located, setup } from './placeHelpers.mjs'

// Door Creek Park, the shelter and the park around it, counts as inside the area, not as nearby
// (the owner's decision, #1009). Named with no address it is placed by the area's words; the
// shelter's address is placed by the boundary. coverage.md defines the tier once.

const tierRow = (tier) =>
  contract.coverage.split('\n').find((line) => line.startsWith(`| \`${tier}\``)) ?? ''

describe('the tier of Door Creek Park', () => {
  it('is core in the policy, and the park is not listed as nearby', () => {
    assert.match(tierRow('core'), /Door Creek Park/)
    assert.doesNotMatch(tierRow('catchment'), /Door Creek Park/)
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
})
