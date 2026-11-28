import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { item, located, setup } from './placeHelpers.mjs'

// The safety answer on every path of the placer (#1009; coverage.md, Review passes, check 2):
// placement never writes it, on the failure path too, and never reads it to decide anything.

describe('an item the placer cannot read keeps its safety answer', () => {
  it('whatever the answer is, and adds none when there is none', async () => {
    for (const safety of [true, false]) {
      const { place } = setup()
      const out = await place({ coverage: 'unknown', flags: [], safety }, item())
      assert.equal(out.placement.reason, 'placing the item failed')
      assert.equal(out.safety, safety)
    }
    const { place } = setup()
    const out = await place({ coverage: 'unknown', flags: [] }, item())
    assert.equal('safety' in out, false)
  })
})

describe('a safety item is placed like any other', () => {
  it('with the same method, tier, flags, reason and requests as the same item without the flag', async () => {
    const addresses = ['7035 Littlemore Dr', '200 Outside Edge Rd', '100 Inside Edge Rd', null]
    for (const coverage of ['core', 'catchment', 'unknown'])
      for (const address of addresses) {
        const results = []
        for (const safety of [true, false]) {
          const { place, geocode } = setup()
          const out = await place(located(address, { coverage, safety }), item())
          const { safety: kept, ...rest } = out
          assert.equal(kept, safety, `${coverage} ${address}`)
          results.push([rest, geocode.asked])
        }
        assert.deepEqual(results[0], results[1], `${coverage} ${address}`)
      }
  })

  it('is sent to the locator when it has an address', async () => {
    const { place, geocode } = setup()
    const out = await place(
      located('7035 Littlemore Dr', { coverage: 'catchment', safety: true }),
      item(),
    )
    assert.deepEqual(geocode.asked, ['7035 Littlemore Dr'])
    assert.equal(out.placement.method, 'boundary')
    assert.equal(out.coverage, 'core')
    assert.equal(out.safety, true)
  })
})
