import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { locatorQuery, streetAddresses } from '../lib/geocode.mjs'
import { geocoder, item, located, setup } from './placeHelpers.mjs'

// Block addresses in the street-address step (#993): only a hundred block is a block, in either
// case, with or without "of"; "3 block stretch" is not an address, and a street whose name begins
// with "Block" keeps its number.

describe('a block in a text', () => {
  it('is found as a hundred block, with or without "of", in either case', () => {
    for (const text of [
      '100 block of N. Cross Country Rd',
      '100 block N. Cross Country Rd',
      '5800 Block of Raymond Rd',
      '2800 block Curry Pkwy',
    ])
      assert.deepEqual(streetAddresses(`Police went to the ${text} on Monday.`), [text], text)
  })

  it('is not found when the number is not a hundred', () => {
    for (const text of [
      'Crews will close a 3 block stretch of Main St',
      'It is a 2 block walk to Main St',
    ])
      assert.deepEqual(streetAddresses(text), [], text)
  })

  it('keeps a street named Block with its number', () => {
    assert.deepEqual(streetAddresses('At 12 Block Island Rd'), ['12 Block Island Rd'])
    assert.deepEqual(locatorQuery('12 Block Island Rd'), {
      query: '12 Block Island Rd',
      block: false,
    })
  })
})

describe('what the locator is asked for', () => {
  it('is the first address of a block in either case, and a plain address as it is', () => {
    assert.deepEqual(locatorQuery('2800 block of Curry Pkwy'), {
      query: '2800 Curry Pkwy',
      block: true,
    })
    assert.deepEqual(locatorQuery('5800 Block of Raymond Rd'), {
      query: '5800 Raymond Rd',
      block: true,
    })
    assert.deepEqual(locatorQuery('100 block N. Cross Country Rd'), {
      query: '100 N. Cross Country Rd',
      block: true,
    })
    assert.deepEqual(locatorQuery('7035 Littlemore Dr'), {
      query: '7035 Littlemore Dr',
      block: false,
    })
  })

  it('goes to the locator without the word "block" and is flagged, in either case', async () => {
    const { place, geocode } = setup({ geocode: geocoder(() => ({ status: 'none' })) })
    await place(located('5800 Block of Raymond Rd'), item())
    assert.deepEqual(geocode.asked, ['5800 Raymond Rd'])
  })

  it('says in the placement that a block was placed by its first address', async () => {
    const inside = geocoder(() => ({ status: 'match', point: [-89.254140370164, 43.095074776666] }))
    const block = await setup({ geocode: inside }).place(
      located('7000 block Littlemore Dr'),
      item(),
    )
    assert.match(block.placement.reason, /first address of the block is inside/)
    const plain = await setup({ geocode: inside }).place(located('7035 Littlemore Dr'), item())
    assert.match(plain.placement.reason, /^the address is inside/)
  })
})
