import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { item, located, setup } from './placeHelpers.mjs'

// Where an item is, by the City's boundary when its address resolves, and what that does to the
// tier verify gave it (#1009).

describe('an address that resolves', () => {
  it('places an address inside the area by the boundary and leaves a matching tier alone', async () => {
    const { place, geocode } = setup()
    const v = located('7035 Littlemore Dr', { coverage: 'core' })
    const out = await place(v, item())
    assert.equal(out.placement.method, 'boundary')
    assert.equal(out.placement.inside, true)
    assert.equal(out.placement.overrode, false)
    assert.equal(out.coverage, 'core')
    assert.deepEqual(out.flags, v.flags)
    assert.deepEqual(geocode.asked, ['7035 Littlemore Dr'])
  })

  it('places an address just outside the area by the boundary, and leaves a matching tier alone', async () => {
    const { place } = setup()
    for (const coverage of ['catchment', 'citywide', 'outside']) {
      const out = await place(located('200 Outside Edge Rd', { coverage }), item())
      assert.deepEqual([out.placement.method, out.placement.inside], ['boundary', false])
      assert.equal(out.coverage, coverage)
      assert.equal(out.placement.overrode, false)
    }
  })

  it('raises a catchment tier to core for an address inside, without a hold', async () => {
    const { place } = setup()
    const out = await place(
      located('100 Inside Edge Rd', { coverage: 'catchment', flags: [] }),
      item(),
    )
    assert.equal(out.coverage, 'core')
    assert.equal(out.placement.overrode, true)
    assert.deepEqual(out.flags, [])
    assert.match(out.coverageReason, /boundary/)
    assert.ok(out.coverageReason.length <= 500)
  })

  it('cuts a long reason to 500 characters, with the boundary’s words first', async () => {
    const { place } = setup()
    const v = located('200 Outside Edge Rd', { coverage: 'core' })
    v.coverageReason = 'x'.repeat(2000)
    const out = await place(v, item())
    assert.equal(out.coverageReason.length, 500)
    assert.match(out.coverageReason, /^The City’s boundary puts the address outside/)
  })

  it('raises an unknown tier to core only when verify confirmed the address', async () => {
    const { place } = setup()
    const confirmed = located('100 Inside Edge Rd', { coverage: 'unknown', flags: [] })
    const sure = await place(confirmed, item())
    assert.deepEqual([sure.coverage, sure.flags, sure.placement.overrode], ['core', [], true])

    const unconfirmed = located('100 Inside Edge Rd', {
      coverage: 'unknown',
      flags: ['unverified-claim'],
    })
    unconfirmed.location.verified = false
    const out = await place(unconfirmed, item())
    // Never easier to accept than verify's own judgment: it goes to a person
    assert.equal(out.coverage, 'core')
    assert.deepEqual(out.flags, ['unverified-claim', 'ambiguous-location'])
    assert.equal(out.placement.overrode, true)
  })

  it('raises catchment to core even when the address was not confirmed', async () => {
    const { place } = setup()
    const v = located('100 Inside Edge Rd', { coverage: 'catchment', flags: [] })
    v.location.verified = false
    assert.deepEqual((await place(v, item())).flags, [])
  })

  it('takes the boundary over a tier that contradicts it, and holds it for a person', async () => {
    const { place } = setup()
    for (const coverage of ['citywide', 'outside']) {
      const out = await place(located('100 Inside Edge Rd', { coverage, flags: [] }), item())
      assert.equal(out.coverage, 'core')
      assert.equal(out.placement.overrode, true)
      assert.deepEqual(out.flags, ['ambiguous-location'])
    }
  })

  it('never leaves core on an address the boundary puts outside, and holds it for a person', async () => {
    const { place } = setup()
    const out = await place(
      located('200 Outside Edge Rd', { coverage: 'core', flags: ['past'] }),
      item(),
    )
    assert.equal(out.coverage, 'unknown')
    assert.equal(out.placement.overrode, true)
    assert.deepEqual(out.flags, ['past', 'ambiguous-location'])
  })

  it('says a disagreement once in the flags even when the flag is already there', async () => {
    const { place } = setup()
    const out = await place(
      located('200 Outside Edge Rd', { coverage: 'core', flags: ['ambiguous-location'] }),
      item(),
    )
    assert.deepEqual(out.flags, ['ambiguous-location'])
  })

  it('falls back to the candidate’s own location text when verify found no address', async () => {
    const { place, geocode } = setup()
    const out = await place(
      located(null, { coverage: 'core' }),
      item('7035 Littlemore Dr, Madison, WI'),
    )
    assert.equal(out.placement.method, 'boundary')
    assert.deepEqual(geocode.asked, ['7035 Littlemore Dr'])
  })

  it('asks once for an address seen twice in a run', async () => {
    const { place, geocode } = setup()
    await place(located('7035 Littlemore Dr'), item())
    await place(located('7035 Littlemore Dr'), item())
    assert.equal(geocode.asked.length, 1)
  })

  it('ignores a placement the model wrote, and does not change what it was given', async () => {
    const { place } = setup()
    const lie = { method: 'boundary', inside: true, reason: 'x', overrode: false }
    const v = located('200 Outside Edge Rd', { coverage: 'outside', placement: lie })
    const before = structuredClone(v)
    const out = await place(v, item())
    assert.equal(out.placement.inside, false)
    assert.deepEqual(v, before)
  })
})
