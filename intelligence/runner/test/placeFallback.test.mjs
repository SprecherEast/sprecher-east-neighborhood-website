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
      assert.equal(
        out.placement.reason,
        {
          none: 'the locator found no match for the address',
          unsure: 'the locator’s best match was not sure enough',
          ambiguous: 'the locator found the address in more than one place',
        }[status],
      )
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

describe('the run’s limits on the locator', () => {
  it('asks nothing once the run is out of time', async () => {
    const { place, geocode } = setup()
    const out = await place(located('7035 Littlemore Dr'), item(), { deadline: Date.now() - 1 })
    assert.equal(out.placement.method, 'word-match')
    assert.match(out.placement.reason, /time/)
    assert.deepEqual(geocode.asked, [])
  })

  it('asks when there is time, and when no deadline is given', async () => {
    const { place, geocode } = setup()
    await place(located('7035 Littlemore Dr'), item(), { deadline: Date.now() + 600_000 })
    await place(located('100 Inside Edge Rd'), item())
    assert.equal(geocode.asked.length, 2)
  })

  it('asks nothing when the remaining time is shorter than one request', async () => {
    const { place, geocode } = setup()
    const short = Date.now() + record.geocoder.timeoutSeconds * 1000 - 1000
    await place(located('7035 Littlemore Dr'), item(), { deadline: short })
    assert.deepEqual(geocode.asked, [])
  })

  it('logs a failing locator once, short, and without a street address', async () => {
    const error = `${'x'.repeat(1000)} 7035 Littlemore Dr`
    const { place, problems } = setup({ geocode: geocoder(() => ({ status: 'failed', error })) })
    await place(located('7035 Littlemore Dr'), item())
    assert.equal(problems.length, 1)
    assert.ok(problems[0].length < 300)
    assert.doesNotMatch(problems[0], /Littlemore/)
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

  it('logs a fixed line when placing fails: nothing from the error, which could hold the address', async () => {
    const geocode = geocoder(() => ({ status: 'match', point: '7035 Littlemore Dr' }))
    const { place, problems } = setup({ geocode })
    await place(located('7035 Littlemore Dr'), item())
    assert.deepEqual(problems, ['Placing an item failed; it is placed by word match.'])
  })
})

describe('the placement and the safety answer', () => {
  it('never changes the safety answer, whatever the boundary says and whatever tier verify gave', async () => {
    const { place } = setup()
    for (const safety of [true, false]) {
      for (const coverage of ['core', 'catchment', 'unknown', 'citywide', 'outside']) {
        for (const address of ['7035 Littlemore Dr', '200 Outside Edge Rd', '1 Nowhere St', null]) {
          for (const verified of [true, false]) {
            const v = located(address, { coverage, safety })
            v.location.verified = verified
            const out = await place(v, item())
            assert.equal(out.safety, safety, `${coverage} ${address} ${verified}`)
          }
        }
      }
    }
  })
})
