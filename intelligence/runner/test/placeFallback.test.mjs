import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { verification } from './fixtures.mjs'
import { INSIDE } from './geoFixtures.mjs'
import { geocoder, item, located, record, setup } from './placeHelpers.mjs'

// An item the boundary can't place keeps the word match and says so, and the placement never
// touches the safety answer (#1009).

describe('an item the boundary can’t place', () => {
  const word = async (v, c, options) => {
    const setupResult = setup(options)
    return { ...setupResult, out: await setupResult.place(v, c) }
  }

  it('keeps the word match for an item with no address, and says so', async () => {
    const { out, geocode } = await word(
      located(null, { coverage: 'core' }),
      item('Door Creek Park'),
    )
    assert.deepEqual(
      [out.placement.method, out.placement.inside, out.placement.overrode],
      ['word-match', null, false],
    )
    assert.equal(out.coverage, 'core')
    assert.deepEqual(geocode.asked, [])
    assert.match(out.placement.reason, /no street address/)
  })

  it('says unplaced when there is no place text at all', async () => {
    const v = verification({
      location: { name: null, address: null, municipality: null, verified: false },
      coverage: 'unknown',
    })
    const { out } = await word(v, item(null))
    assert.deepEqual([out.placement.method, out.coverage], ['unplaced', 'unknown'])
  })

  it('keeps the word match when the locator finds nothing, is unsure or is ambiguous', async () => {
    for (const status of ['none', 'unsure', 'ambiguous']) {
      const { out } = await word(located('7035 Littlemore Dr', { coverage: 'catchment' }), item(), {
        geocode: geocoder(() => ({ status })),
      })
      assert.equal(out.placement.method, 'word-match')
      assert.equal(out.coverage, 'catchment')
      assert.match(out.placement.reason, /locator/)
    }
  })

  it('keeps the word match when the locator fails, and reports it once in the run', async () => {
    const { place, problems, geocode } = setup({
      geocode: geocoder(() => ({ status: 'failed', error: 'down' })),
    })
    const a = await place(located('7035 Littlemore Dr'), item())
    const b = await place(located('100 Inside Edge Rd'), item())
    assert.equal(a.placement.method, 'word-match')
    assert.equal(b.placement.method, 'word-match')
    assert.equal(problems.length, 1)
    assert.match(problems[0], /locator/)
    assert.equal(geocode.asked.length, 2)
  })

  it('stops asking for the rest of the run after two failures in a row', async () => {
    const geocode = geocoder(() => ({ status: 'failed', error: 'down' }))
    const { place } = setup({ geocode })
    const methods = []
    for (const street of ['1 A St', '2 A St', '3 A St', '4 A St']) {
      methods.push((await place(located(street), item())).placement.method)
    }
    assert.deepEqual(geocode.asked, ['1 A St', '2 A St'])
    assert.ok(methods.every((m) => m === 'word-match'))
  })

  it('keeps asking when a success comes between failures', async () => {
    const answers = ['failed', 'match', 'failed', 'match']
    const geocode = geocoder(() => {
      const status = answers.shift()
      return status === 'match' ? { status, point: INSIDE } : { status, error: 'down' }
    })
    const { place } = setup({ geocode })
    for (const street of ['1 A St', '2 A St', '3 A St', '4 A St'])
      await place(located(street), item())
    assert.equal(geocode.asked.length, 4)
  })

  it('asks at most the run’s limit', async () => {
    const small = { ...record, geocoder: { ...record.geocoder, maxPerRun: 2 } }
    const { place, geocode, problems } = setup({ record: small })
    const out = []
    for (const street of ['1 A St', '2 A St', '3 A St'])
      out.push(await place(located(street), item()))
    assert.equal(geocode.asked.length, 2)
    assert.match(out[2].placement.reason, /limit/)
    assert.equal(problems.length, 0)
  })

  it('doesn’t geocode two addresses in one text, as it can’t tell which is the place', async () => {
    const { out, geocode } = await word(located('100 Main St and 200 State St'), item())
    assert.equal(out.placement.method, 'word-match')
    assert.deepEqual(geocode.asked, [])
    assert.match(out.placement.reason, /more than one/)
  })

  it('doesn’t geocode an address in another municipality or one flagged as a similar name', async () => {
    for (const v of [
      located('7035 Littlemore Dr', {
        location: {
          name: 'X',
          address: '7035 Littlemore Dr',
          municipality: 'Madison, AL',
          verified: true,
        },
      }),
      located('7035 Littlemore Dr', {
        location: {
          name: 'X',
          address: '7035 Littlemore Dr',
          municipality: 'Village of Cottage Grove',
          verified: true,
        },
      }),
      located('7035 Littlemore Dr', { flags: ['similar-name'] }),
      located('7035 Littlemore Dr', { flags: ['prompt-injection'] }),
    ]) {
      const { out, geocode } = await word(v, item())
      assert.equal(out.placement.method, 'word-match')
      assert.deepEqual(geocode.asked, [])
    }
  })

  it('geocodes when the municipality is Madison in any usual form or isn’t given', async () => {
    for (const municipality of ['Madison', 'Madison, WI', 'Madison, Wisconsin', null]) {
      const v = located('7035 Littlemore Dr', {
        location: { name: 'X', address: '7035 Littlemore Dr', municipality, verified: true },
      })
      const { out } = await word(v, item())
      assert.equal(out.placement.method, 'boundary', String(municipality))
    }
  })

  it('keeps the word match when there is no usable boundary, geocoder or verified record', async () => {
    const v = located('7035 Littlemore Dr', { coverage: 'catchment' })
    for (const options of [
      { boundary: null },
      { geocode: null },
      { record: { ...record, verified: false } },
    ]) {
      const { out } = await word(v, item(), options)
      assert.equal(out.placement.method, 'word-match')
      assert.equal(out.coverage, 'catchment')
    }
  })
})

describe('a placement that goes wrong', () => {
  it('keeps the item and its word match when the locator’s answer can’t be used', async () => {
    const geocode = geocoder(() => ({ status: 'match', point: 'not a point' }))
    const { place, problems } = setup({ geocode })
    const v = located('7035 Littlemore Dr', { coverage: 'catchment' })
    const out = await place(v, item())
    assert.deepEqual([out.placement.method, out.coverage], ['word-match', 'catchment'])
    assert.equal(problems.length, 1)
  })
})

describe('the placement and the safety answer', () => {
  it('never changes the safety answer, whatever the boundary says', async () => {
    const { place } = setup()
    for (const safety of [true, false]) {
      for (const address of ['7035 Littlemore Dr', '200 Outside Edge Rd', '1 Nowhere St', null]) {
        const out = await place(located(address, { coverage: 'core', safety }), item())
        assert.equal(out.safety, safety)
      }
    }
  })
})
