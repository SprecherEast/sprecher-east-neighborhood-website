import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { geocoder, item, located, setup } from './placeHelpers.mjs'

// Each branch of the text rule in place.mjs that no other test pins (#1009; coverage.md, Review
// passes, check 2): a unit word, a unit's length, the country, whole words, case, and trimming.

const sentCount = async (address, candidateText = null, municipality = 'Madison') => {
  const { place, geocode } = setup()
  const v = located(address)
  v.location.municipality = municipality
  await place(v, item(candidateText))
  return geocode.asked.length
}

describe('what may follow the street', () => {
  it('takes each unit word, with or without a period or a #, and a unit of up to six characters', async () => {
    for (const unit of [
      'Apt 4',
      'Unit 4B',
      'Suite 2',
      'Ste 4',
      'Ste. 4',
      'Room 12',
      'Rm 5',
      'Rm. #5',
      '#12-A',
      'Unit 123456',
      '#123456',
    ])
      assert.equal(await sentCount(`7035 Littlemore Dr, ${unit}, Madison`), 1, unit)
  })

  it('refuses a unit of seven characters or more', async () => {
    for (const unit of ['Unit 1234567', '#1234567', 'Suite ABCDEFG'])
      assert.equal(await sentCount(`7035 Littlemore Dr, ${unit}, Madison`), 0, unit)
  })

  it('takes the country in each of its usual forms, with or without a final period', async () => {
    for (const country of ['USA', 'US', 'U.S.A.', 'U.S.A', 'United States'])
      assert.equal(await sentCount(`7035 Littlemore Dr, Madison, WI, ${country}`), 1, country)
    assert.equal(await sentCount('7035 Littlemore Dr, U.S.A.'), 1)
  })
})

describe('what is recognized before the street is a whole word', () => {
  it('does not take "city of", a state or a five-digit number from inside a longer word', async () => {
    for (const text of [
      'Electricity of Madison Hall, 7035 Littlemore Dr',
      'Wisely Cafe, 7035 Littlemore Dr',
      'Order 123456, 7035 Littlemore Dr',
    ])
      assert.equal(await sentCount(text), 1, text)
  })
})

describe('which text the rule reads, and how a municipality is trimmed', () => {
  it('reads the text the street came from, not the candidate’s', async () => {
    assert.equal(await sentCount('7035 Littlemore Dr', 'Fitchburg WI, 7035 Littlemore Dr'), 1)
  })

  it('takes verify’s municipality with spaces around it', async () => {
    assert.equal(await sentCount('7035 Littlemore Dr', null, '  Madison '), 1)
  })
})

describe('the run’s memory of an address', () => {
  it('asks once for the same street in another case', async () => {
    const { place, geocode } = setup()
    await place(located('7035 Littlemore Dr'), item())
    await place(located('7035 LITTLEMORE DR'), item())
    assert.equal(geocode.asked.length, 1)
  })
})

describe('what counts as a named place when no address resolves', () => {
  const none = geocoder(() => ({ status: 'none' }))
  const method = async (name, address, text) => {
    const { place } = setup({ geocode: none })
    const v = located(address)
    v.location.name = name
    return (await place(v, item(text))).placement.method
  }

  it('is word-match for a name alone, an address alone or the candidate’s text alone', async () => {
    assert.equal(await method('Hall', null, null), 'word-match')
    assert.equal(await method(null, '7035 Littlemore Dr', null), 'word-match')
    assert.equal(await method(null, null, 'Somewhere nice'), 'word-match')
  })

  it('is unplaced when the item names no place at all', async () => {
    assert.equal(await method(null, null, null), 'unplaced')
  })
})

describe('the raise needs verified to be true itself', () => {
  it('does not raise on a value that is merely truthy', async () => {
    const { place } = setup()
    const v = located('7035 Littlemore Dr', { coverage: 'unknown', flags: [] })
    v.location.verified = 'yes'
    const out = await place(v, item())
    assert.deepEqual([out.coverage, out.flags], ['core', ['ambiguous-location']])
  })
})

describe('how the pieces after the street may be written', () => {
  it('takes a unit or a state with no space, one space or a #', async () => {
    for (const part of [
      'Apt4',
      'Apt#4',
      'Apt # 4',
      '# 4',
      '#4',
      'WI53718',
      'WI 53718',
      'Wisconsin53718',
    ])
      assert.equal(await sentCount(`7035 Littlemore Dr, ${part}, Madison`), 1, part)
  })

  it('refuses a unit word or a # with nothing after it, and what is not a country', async () => {
    for (const part of ['Apt', 'Unit', '#', 'U.S.', 'United States of America', 'M.A.D'])
      assert.equal(await sentCount(`7035 Littlemore Dr, ${part}, Madison`), 0, part)
    assert.equal(await sentCount('7035 Littlemore Dr, U.S.'), 0)
  })

  it('takes only a comma between the street and what follows, and tests the first street in the text', async () => {
    for (const text of [
      '7035 Littlemore Dr;Madison',
      '7035 Littlemore Dr-Madison',
      '7035 Littlemore Dr, Madison; WI',
      '7035 Littlemore Dr, Fitchburg, 7035 Littlemore Dr',
    ])
      assert.equal(await sentCount(text), 0, text)
  })

  it('takes a municipality of Madison with a state or a ZIP written without or with extra spaces', async () => {
    for (const municipality of [
      'Madison,WI',
      'Madison,  WI',
      'Madison, WI,53718',
      'Madison  53718',
    ])
      assert.equal(await sentCount('7035 Littlemore Dr', null, municipality), 1, municipality)
  })
})

describe('what is recognized is a whole word, and a one-character value is still a value', () => {
  it('does not take a state from the end of a longer word', async () => {
    assert.equal(await sentCount('Kiwi Cafe, 7035 Littlemore Dr'), 1)
  })

  it('refuses a one-character municipality and counts a one-character name as a place', async () => {
    assert.equal(await sentCount('7035 Littlemore Dr', null, 'M'), 0)
    const { place } = setup({ geocode: geocoder(() => ({ status: 'none' })) })
    const v = located(null)
    v.location.name = 'X'
    assert.equal((await place(v, item())).placement.method, 'word-match')
  })
})
