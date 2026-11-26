import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { locatorQuery, streetAddresses } from '../lib/geocode.mjs'
import { geocoder, item, located, setup } from './placeHelpers.mjs'

// Block addresses in the street-address step (#993): only a hundred block is a block, in either
// case, with or without "of"; "3 block stretch" is not an address, and a street whose name begins
// with "Block" is not read unless a hundred is before it. A route number is never a house number.

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

  it('is not found for a number that is not a hundred, so the word "block" is never sent', () => {
    for (const text of [
      '3 block of Main St',
      '12 Block Island Rd',
      '20 block stretch of Main St',
      '00 block Main St',
    ])
      assert.deepEqual(streetAddresses(text), [], text)
    // A hundred before "Block Island Rd" is read as a block, and its placement carries the flag
    assert.deepEqual(streetAddresses('100 Block Island Rd'), ['100 Block Island Rd'])
    assert.equal(locatorQuery('100 Block Island Rd').block, true)
  })

  it('is a hundred of three to six digits: tens and thousands included, seven digits not', () => {
    for (const text of [
      '900 block Rise Lane',
      '2900 block Curry Parkway',
      '123400 block of N. Cross Country Rd',
    ])
      assert.deepEqual(streetAddresses(text), [text], text)
    assert.deepEqual(streetAddresses('1250 block Main St'), [])
    assert.deepEqual(locatorQuery('1250 block Main St'), {
      query: '1250 block Main St',
      block: false,
    })
    assert.equal(locatorQuery('123400 block of N. Cross Country Rd').block, true)
    assert.deepEqual(streetAddresses('1234500 block Main St'), [])
    assert.deepEqual(streetAddresses('2800block Curry Pkwy'), [])
  })

  it('is found in text with extra spaces, written with single spaces', () => {
    assert.deepEqual(streetAddresses('2800  block  of  N. Cross Country Rd'), [
      '2800 block of N. Cross Country Rd',
    ])
  })

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

describe('a route number is not a house number', () => {
  it('finds no address in an intersection with a route, so the locator is never asked', () => {
    for (const text of [
      'Hwy 51 at Buckeye Rd',
      'Hwy 12/18 at Sprecher Rd',
      'US 12 and Sprecher Rd',
      'I-94 at Sprecher Rd',
      'County Rd 51 at Buckeye Rd',
      'I 94 at Sprecher Rd',
      'WIS 30 at Sprecher Rd',
    ])
      assert.deepEqual(streetAddresses(text), [], text)
  })

  it('still finds a house number after other words', () => {
    assert.deepEqual(streetAddresses('At 4802 Sprecher Rd, near Hwy 51'), ['4802 Sprecher Rd'])
    // "Wis." is the state, not a route
    assert.deepEqual(streetAddresses('Wis. 7035 Littlemore Dr'), ['7035 Littlemore Dr'])
    assert.deepEqual(streetAddresses('Route 7 and 5200 Cottage Grove Rd'), [
      '5200 Cottage Grove Rd',
    ])
  })

  it('sends the locator nothing for an intersection with a route, whatever it would match', async () => {
    for (const address of [
      'I-94 at Sprecher Rd',
      'Hwy 51 at Buckeye Rd',
      'Hwy 12/18 at Sprecher Rd',
      'US 12 and Sprecher Rd',
    ]) {
      const { place, geocode } = setup({
        geocode: geocoder(() => ({ status: 'match', point: [-89.254140370164, 43.095074776666] })),
      })
      const out = await place(located(address, { coverage: 'catchment' }), item())
      assert.deepEqual(geocode.asked, [], address)
      assert.equal(out.coverage, 'catchment', address)
      assert.equal(out.placement.method, 'word-match', address)
    }
  })
})
