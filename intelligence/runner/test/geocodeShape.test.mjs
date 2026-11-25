import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isPlainStreet, streetAddresses } from '../lib/geocode.mjs'
import { ask, config, json } from './geocodeHelpers.mjs'

// The shape of a street address the locator is ever sent (#1009): each street type, each limit on
// both sides, each way of writing a direction, and the distance that makes two matches one place.

const TYPES = [
  'St',
  'Street',
  'Ave',
  'Avenue',
  'Rd',
  'Road',
  'Dr',
  'Drive',
  'Ln',
  'Lane',
  'Blvd',
  'Boulevard',
  'Ct',
  'Court',
  'Way',
  'Pl',
  'Place',
  'Pkwy',
  'Parkway',
  'Cir',
  'Circle',
  'Ter',
  'Terrace',
  'Trl',
  'Trail',
  'Hwy',
  'Highway',
  'Loop',
  'Pass',
  'Run',
  'Sq',
  'Square',
]

describe('which street addresses are read from a text', () => {
  it('takes each street type', () => {
    for (const type of TYPES)
      assert.deepEqual(
        streetAddresses(`Meet at 7035 Door Creek ${type} today`),
        [`7035 Door Creek ${type}`],
        type,
      )
  })

  it('takes a house number of up to six digits and an optional direction, in each form', () => {
    assert.deepEqual(streetAddresses('123456 Main St'), ['123456 Main St'])
    assert.deepEqual(streetAddresses('1234567 Main St'), [])
    for (const direction of ['N', 'S', 'E', 'W', 'N.', 'North', 'South', 'East', 'West'])
      assert.deepEqual(
        streetAddresses(`7035 ${direction} Door Creek Park Dr`),
        [`7035 ${direction} Door Creek Park Dr`],
        direction,
      )
  })

  it('takes up to three name words, and the first street type that ends them', () => {
    assert.deepEqual(streetAddresses('7035 Door Creek Park Dr'), ['7035 Door Creek Park Dr'])
    assert.deepEqual(streetAddresses('7035 Door Creek Park Hills Dr'), [])
    assert.deepEqual(streetAddresses('7035 Door Dr Creek Dr'), ['7035 Door Dr'])
  })

  it('reads whole words, with any spacing, and leaves a time alone', () => {
    assert.deepEqual(streetAddresses('A7035 Littlemore Dr'), [])
    assert.deepEqual(streetAddresses('7035 Littlemore Drx'), [])
    assert.deepEqual(streetAddresses('7035   N   Door   Creek   Dr'), ['7035 N Door Creek Dr'])
    assert.deepEqual(streetAddresses('7 Pmax Main St'), ['7 Pmax Main St'])
    assert.deepEqual(streetAddresses('7 PM on Main St'), [])
    assert.deepEqual(streetAddresses('7PM or 7 P.M. on Main St'), [])
    assert.deepEqual(streetAddresses('7  PM on Main St'), [])
    assert.deepEqual(streetAddresses('7035 N   Door Creek Park Dr'), ['7035 N Door Creek Park Dr'])
    assert.deepEqual(streetAddresses('7035 North  Door Creek Park Dr'), [
      '7035 North Door Creek Park Dr',
    ])
  })
})

describe('which street is plain enough to send', () => {
  const words = (n) =>
    ['1', ...Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i).repeat(2))].join(' ')

  it('has a house number of one to six digits, then two to six words', () => {
    assert.equal(isPlainStreet('123456 Main St'), true)
    assert.equal(isPlainStreet('1234567 Main St'), false)
    assert.equal(isPlainStreet('Main St'), false)
    assert.equal(isPlainStreet(' Main St'), false)
    assert.equal(isPlainStreet('1 Main'), false)
    assert.equal(isPlainStreet(words(2)), true)
    assert.equal(isPlainStreet(words(6)), true)
    assert.equal(isPlainStreet(words(7)), false)
  })

  it('starts with the number, and is at most 80 characters', () => {
    assert.equal(isPlainStreet('x 7035 Littlemore Dr'), false)
    const of = (length) => `1 ${'A'.repeat(36)} ${'B'.repeat(length - 2 - 36 - 1)}`
    assert.equal(isPlainStreet(of(80)), true)
    assert.equal(isPlainStreet(of(81)), false)
    assert.equal(isPlainStreet(of(79)), true)
  })
})

describe('when two strong matches are one place', () => {
  const metersPerDegree = 110_574
  const at = (meters) =>
    json(
      JSON.stringify({
        candidates: [
          { score: 100, location: { x: -89.25, y: 43.09 } },
          { score: 100, location: { x: -89.25, y: 43.09 + meters / metersPerDegree } },
        ],
      }),
    )

  it('is within the configured distance, measured at 110,574 m a degree', async () => {
    const limit = config.sameSpotMeters
    assert.equal((await ask('7035 Littlemore Dr', at(limit * (1 - 5e-6)))).result.status, 'match')
    assert.equal(
      (await ask('7035 Littlemore Dr', at(limit * (1 + 5e-6)))).result.status,
      'ambiguous',
    )
  })
})
