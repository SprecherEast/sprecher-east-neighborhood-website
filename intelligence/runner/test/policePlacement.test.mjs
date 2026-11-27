import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { gateItem } from '../lib/gate.mjs'
import { curation } from './fixtures.mjs'
import { contract } from './helpers.mjs'
import { geocoder, item, located, setup } from './placeHelpers.mjs'
import { item as gated } from './safetyHelpers.mjs'

// A block address from the incident reports feed (#993; coverage.md, Review passes, check 2): the
// locator is sent the public house number and street of the block's first address, never the word
// "block", and a block is placed by that point only, so a change of tier it causes is always
// flagged for a person. Same rules as any address otherwise.

const POINTS = {
  '7000 Littlemore Dr': [-89.254140370164, 43.095074776666],
  '5200 Cottage Grove Rd': [-89.3, 43.07],
  '100 W. Main Street': [-89.384, 43.0747],
}
const known = () =>
  geocoder((street) =>
    POINTS[street] ? { status: 'match', point: POINTS[street] } : { status: 'none' },
  )

describe('a block address', () => {
  it('sends the locator the first address of the block, not the word "block"', async () => {
    const { place, geocode } = setup({ geocode: known() })
    await place(located('7000 block Littlemore Dr'), item())
    await place(located('100 block of W. Main Street'), item())
    assert.deepEqual(geocode.asked, ['7000 Littlemore Dr', '100 W. Main Street'])
  })

  it('reads the block address from the candidate when verify gave none', async () => {
    const { place, geocode } = setup({ geocode: known() })
    const out = await place(
      located(null, { coverage: 'unknown' }),
      item('7000 block Littlemore Dr'),
    )
    assert.deepEqual(geocode.asked, ['7000 Littlemore Dr'])
    assert.equal(out.placement.method, 'boundary')
    assert.equal(out.placement.inside, true)
  })

  it('on a street inside the area, is core by the boundary and says so', async () => {
    const { place } = setup({ geocode: known() })
    const out = await place(located('7000 block Littlemore Dr', { coverage: 'core' }), item())
    assert.equal(out.placement.method, 'boundary')
    assert.equal(out.placement.inside, true)
    assert.equal(out.coverage, 'core')
    assert.equal(out.placement.overrode, false)
  })

  it('on a street of the same name elsewhere, is not core even when verify said core', async () => {
    const { place } = setup({ geocode: known() })
    const out = await place(
      located('5200 block Cottage Grove Rd', {
        coverage: 'core',
        coverageReason: 'Cottage Grove Road bounds the area.',
      }),
      item(),
    )
    assert.equal(out.placement.method, 'boundary')
    assert.equal(out.placement.inside, false)
    assert.notEqual(out.coverage, 'core')
    assert.equal(out.placement.overrode, true)
    assert.ok(out.flags.includes('ambiguous-location'))
  })

  it('never raises a tier on a block without a flag for a person', async () => {
    for (const coverage of ['catchment', 'unknown']) {
      const { place } = setup({ geocode: known() })
      const out = await place(located('7000 block Littlemore Dr', { coverage }), item())
      assert.equal(out.coverage, 'core', coverage)
      assert.equal(out.placement.overrode, true, coverage)
      assert.ok(out.flags.includes('ambiguous-location'), coverage)
    }
  })

  it('keeps the word match when the locator does not know the block', async () => {
    const { place } = setup({ geocode: known() })
    const out = await place(located('900 block Nowhere Rd', { coverage: 'unknown' }), item())
    assert.equal(out.placement.method, 'word-match')
    assert.equal(out.placement.inside, null)
  })

  it('with no address at all is unplaced and sends nothing', async () => {
    const { place, geocode } = setup({ geocode: known() })
    const out = await place(
      {
        coverage: 'unknown',
        flags: [],
        location: { name: null, address: null, municipality: null, verified: false },
      },
      item(null),
    )
    assert.equal(out.placement.method, 'unplaced')
    assert.deepEqual(geocode.asked, [])
  })

  it('sends nothing when the text names another place before the block', async () => {
    const { place, geocode } = setup({ geocode: known() })
    await place(located('Fitchburg, WI, 7000 block Littlemore Dr'), item())
    assert.deepEqual(geocode.asked, [])
  })

  it('sends a plain street only: a block of a street with no type is not sent', async () => {
    const { place, geocode } = setup({ geocode: known() })
    await place(located('7000 block Littlemore'), item())
    assert.deepEqual(geocode.asked, [])
  })
})

describe('a police report is always held for a person', () => {
  it('whatever its placement and both stages answered, it goes to review and never to a suggestion', () => {
    const source = contract.registry.sources.find((s) => s.id === 'madison-police-incident-reports')
    assert.ok(contract.safety.sources.has(source.id))
    const built = gated({
      candidate: { sourceId: source.id, externalId: `${source.id}:x`, kind: 'news' },
      verification: { coverage: 'core', safety: false, confidence: 0.99 },
      curation: curation({ decision: 'accept', safety: false }),
    })
    const out = gateItem(contract, built)
    assert.equal(out.route, 'reportItem')
    assert.equal(out.suggest, false)
    assert.notEqual(out.curation.decision, 'accept')
  })
})
