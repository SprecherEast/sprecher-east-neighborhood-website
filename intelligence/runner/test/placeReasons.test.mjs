import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createPlacer } from '../lib/place.mjs'
import { boundary, geocoder, item, located, record, setup } from './placeHelpers.mjs'

// The exact words placement stores for an editor, and the limits of one run (#1009; coverage.md,
// Review passes, check 2; runner README, "Placement by the City's boundary").

const reasonOf = async (v, text = null, options = {}) => {
  const { place } = setup(options.setup)
  return (await place(v, item(text), options.place)).placement.reason
}
const answering = (status) => geocoder(() => ({ status }))

describe('the reason an item keeps the word match', () => {
  it('is said in one fixed phrase for each way it can happen', async () => {
    const long = `1 ${'A'.repeat(100)} St`
    const similar = located('7035 Littlemore Dr', { flags: ['similar-name'] })
    const twoStreets = located('7035 Littlemore Dr and 100 Inside Edge Rd')
    const noStreet = located(null)
    noStreet.location.name = 'Hall'
    const elsewhere = located('7035 Littlemore Dr')
    elsewhere.location.municipality = 'Madison, AL'
    const cases = [
      [located('7035 Littlemore Dr'), { setup: { boundary: null } }, 'no boundary is loaded'],
      [
        located('7035 Littlemore Dr'),
        { setup: { record: { ...record, verified: false } } },
        'the boundary record is not verified',
      ],
      [
        located('7035 Littlemore Dr'),
        { setup: { record: undefined } },
        'the boundary record is not verified',
      ],
      [located('7035 Littlemore Dr'), { setup: { geocode: null } }, 'no locator is configured'],
      [elsewhere, {}, 'the municipality is not Madison, Wisconsin'],
      [similar, {}, 'the item is flagged as a similar name or as an injection'],
      [twoStreets, {}, 'more than one street address in the item'],
      [noStreet, {}, 'no street address in the item'],
      [located(long), {}, 'the address is not a plain street address'],
      [
        located('7035 Littlemore Dr'),
        { setup: { geocode: answering('none') } },
        'the locator found no match for the address',
      ],
      [
        located('7035 Littlemore Dr'),
        { setup: { geocode: answering('unsure') } },
        'the locator’s best match was not sure enough',
      ],
      [
        located('7035 Littlemore Dr'),
        { setup: { geocode: answering('ambiguous') } },
        'the locator found the address in more than one place',
      ],
      [
        located('7035 Littlemore Dr'),
        { setup: { geocode: answering('odd') } },
        'the locator gave no usable answer',
      ],
      [
        located('7035 Littlemore Dr'),
        { setup: { geocode: answering('failed') } },
        'the locator failed',
      ],
    ]
    for (const [v, options, reason] of cases) assert.equal(await reasonOf(v, null, options), reason)
  })

  it('says why a later address was not asked, after a failure, at the limit and at the deadline', async () => {
    const failing = setup({ geocode: answering('failed') })
    await failing.place(located('1 A St'), item())
    await failing.place(located('2 B St'), item())
    const third = await failing.place(located('3 C St'), item())
    assert.equal(third.placement.reason, 'the locator failed earlier in this run')
    const limited = setup({ record: { ...record, geocoder: { ...record.geocoder, maxPerRun: 1 } } })
    await limited.place(located('7035 Littlemore Dr'), item())
    const second = await limited.place(located('100 Inside Edge Rd'), item())
    assert.equal(second.placement.reason, 'the run’s limit of 1 locator requests was reached')
    const late = setup()
    const out = await late.place(located('7035 Littlemore Dr'), item(), {
      deadline: Date.now() - 1,
    })
    assert.equal(out.placement.reason, 'the run is out of time for another locator request')
  })
})

describe('what the placement says when the boundary decides', () => {
  it('says inside, and what it changed, for an address inside', async () => {
    const { place } = setup()
    const v = located('7035 Littlemore Dr', { coverage: 'catchment' })
    const out = await place(v, item())
    assert.equal(out.placement.reason, 'the address is inside the City’s boundary for the area')
    assert.equal(
      out.coverageReason,
      `The City’s boundary puts the address inside the area, so it is core (verify said catchment). ${v.coverageReason}`,
    )
  })

  it('says outside, and what it changed, for an address outside', async () => {
    const { place } = setup()
    const v = located('200 Outside Edge Rd', { coverage: 'core' })
    const out = await place(v, item())
    assert.equal(out.placement.reason, 'the address is outside the City’s boundary for the area')
    assert.equal(
      out.coverageReason,
      `The City’s boundary puts the address outside the area, so it is not core (verify said core). ${v.coverageReason}`,
    )
  })
})

describe('an item the placer cannot read', () => {
  it('keeps the word match, says so in fixed words, and tells the run once', async () => {
    const { place, problems } = setup()
    const out = await place({ coverage: 'unknown', flags: [] }, item())
    assert.deepEqual(out.placement, {
      method: 'word-match',
      inside: null,
      reason: 'placing the item failed',
      overrode: false,
    })
    assert.deepEqual(problems, ['Placing an item failed; it is placed by word match.'])
  })

  it('needs no listener for a problem', async () => {
    const place = createPlacer({ boundary, record, geocode: answering('failed') })
    assert.equal(
      (await place(located('7035 Littlemore Dr'), item())).placement.method,
      'word-match',
    )
    assert.equal(
      (await place({ coverage: 'unknown', flags: [] }, item())).placement.method,
      'word-match',
    )
  })
})

describe('the limits of one run', () => {
  it('counts only failures in a row: an answer in between starts the count again', async () => {
    let calls = 0
    const geocode = geocoder(() => (++calls === 2 ? { status: 'none' } : { status: 'failed' }))
    const { place } = setup({ geocode })
    for (const street of ['1 A St', '2 B St', '3 C St', '4 D St', '5 E St'])
      await place(located(street), item())
    assert.equal(geocode.asked.length, 4)
  })

  it('asks for nothing when the record has no locator settings, and says why', async () => {
    const { place, geocode } = setup({ record: { verified: true } })
    const out = await place(located('7035 Littlemore Dr'), item())
    assert.equal(geocode.asked.length, 0)
    assert.equal(out.placement.reason, 'the run’s limit of 0 locator requests was reached')
  })

  it('is out of time when the deadline is closer than one timeout, and not before', async (t) => {
    const now = 1_000_000
    t.mock.method(Date, 'now', () => now)
    const timeout = record.geocoder.timeoutSeconds * 1000
    for (const [deadline, asked] of [
      [now + timeout, 1],
      [now + timeout - 1, 0],
      [now + timeout + 1, 1],
    ]) {
      const { place, geocode } = setup()
      await place(located('7035 Littlemore Dr'), item(), { deadline })
      assert.equal(geocode.asked.length, asked, String(deadline - now))
    }
  })

  it('does not count time against a record without a timeout until the limit stops it', async (t) => {
    const now = 1_000_000
    t.mock.method(Date, 'now', () => now)
    for (const [deadline, reason] of [
      [now, 'the run’s limit of 0 locator requests was reached'],
      [now - 1, 'the run is out of time for another locator request'],
    ]) {
      const { place } = setup({ record: { verified: true } })
      const out = await place(located('7035 Littlemore Dr'), item(), { deadline })
      assert.equal(out.placement.reason, reason, String(deadline - now))
    }
  })
})
