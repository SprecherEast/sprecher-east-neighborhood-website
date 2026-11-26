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

describe('a number followed by a connector is not a house number', () => {
  const NOTHING = [
    // Routes and exits, in every spelling the layout rule covers at once
    'Hwy 51 at Buckeye Rd',
    'Hwy. 51 at Buckeye Rd',
    'U.S. 12 at Sprecher Rd',
    'US 12 and Sprecher Rd',
    'US 12 & 18 at Sprecher Rd',
    'Hwy 12 and 18 at Sprecher Rd',
    'Hwy 12/18 at Sprecher Rd',
    'Hwy 12-18 at Sprecher Rd',
    'Wisconsin 30 at Sprecher Rd',
    'I-94 at Sprecher Rd',
    'I\u201394 at Sprecher Rd',
    'I\u201194 at Sprecher Rd',
    'I\u221294 at Sprecher Rd',
    'I 94 at Sprecher Rd',
    'Exit 266 at Sprecher Rd',
    'County Rd 51 at Buckeye Rd',
    // Each connector, and a number that is only a count of blocks
    'Route 5 near Main St',
    'Route 5 by Main St',
    'Route 5 to Main St',
    'Route 5 from Main St',
    'Route 5 between Main St',
    'Route 5 & Main St',
    'Route 5 @ Main St',
    'Route 5 / Main St',
    'Route 5 - Main St',
    'within 2 blocks of Main St',
    '3 Blocks of Main St',
    '3 block of Main St',
    '0300 block Main St',
  ]
  it('finds no address in an intersection, a route or a count of blocks', () => {
    for (const text of NOTHING) assert.deepEqual(streetAddresses(text), [], text)
  })

  it('finds a house number of up to six digits, and none of seven', () => {
    assert.deepEqual(streetAddresses('At 123456 Main St'), ['123456 Main St'])
    assert.deepEqual(streetAddresses('At 1234567 Main St'), [])
  })

  it('finds no address when a dash or slash comes just before the number', () => {
    for (const text of [
      'Hwy 12\u201018 Sprecher Rd',
      'Hwy 12\u201418 Sprecher Rd',
      'Hwy 12\u201518 Sprecher Rd',
      'Hwy 12/18 Sprecher Rd',
      'Hwy 12-18 Sprecher Rd',
      'Hwy 12\u201318 Sprecher Rd',
      'Hwy 12\u201118 Sprecher Rd',
      'Hwy 12\u221218 Sprecher Rd',
    ])
      assert.deepEqual(streetAddresses(text), [], text)
  })

  it('still finds a house number, also after words a route list would have taken', () => {
    for (const [text, found] of [
      ['Acme Co. 123 Main St', '123 Main St'],
      ['John Smith Sr. 123 Main St', '123 Main St'],
      ['Contact us 123 Main St', '123 Main St'],
      ['Madison, Wis. 123 Main St', '123 Main St'],
      ['At 4802 Sprecher Rd, near Hwy 51', '4802 Sprecher Rd'],
      ['Route 7 and 5200 Cottage Grove Rd', '5200 Cottage Grove Rd'],
      // A connector word is a whole word: street names that begin with one are fine
      ['123 Atlas Rd', '123 Atlas Rd'],
      ['123 Andover Dr', '123 Andover Dr'],
      ['123 Nearing Ave', '123 Nearing Ave'],
      ['123 Byron St', '123 Byron St'],
      ['123 Tobin Rd', '123 Tobin Rd'],
      ['123 Fromm Rd', '123 Fromm Rd'],
      ['123 Betweenwood Dr', '123 Betweenwood Dr'],
      ['123 Blockton Rd', '123 Blockton Rd'],
      ['123 N. Main St', '123 N. Main St'],
    ])
      assert.deepEqual(streetAddresses(text), [found], text)
  })

  it('sends the locator nothing for any of them, whatever it would match', async () => {
    for (const address of NOTHING) {
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
