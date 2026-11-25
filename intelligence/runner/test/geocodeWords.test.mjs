import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isPlainStreet, streetAddresses } from '../lib/geocode.mjs'

// What the street finder reads as an address, and what the guard in front of the request lets
// through (#1009; coverage.md, Review passes, check 2): a time of day is not a house number, a
// street word starts with a letter and holds only letters, periods, apostrophes and hyphens, and a
// name has at most three words.

describe('a time of day before a street', () => {
  it('is not a house number, however it is written', () => {
    for (const text of [
      '7 AM Main St',
      '7 a.m. Main St',
      '7 am Main St',
      '7 PM on Main St',
      '7 p.m. Main St',
    ])
      assert.deepEqual(streetAddresses(text), [], text)
  })

  it('does not block another short word after a number', () => {
    assert.deepEqual(streetAddresses('7 Em St'), ['7 Em St'])
    assert.deepEqual(streetAddresses('7 m Main St'), ['7 m Main St'])
  })
})

describe('a street word', () => {
  it('starts with a letter and holds no digit', () => {
    for (const text of [
      '7035 5th St',
      '7035 .Main St',
      "7035 'Main St",
      '7035 -Main St',
      '7035 Main2 St',
      '7035 Main, Foo St',
      '7035 Main(Foo St',
      '7035 Main+Foo St',
      '7035 Main/Foo St',
      '7035 Main*Foo St',
    ])
      assert.deepEqual(streetAddresses(text), [], text)
  })

  it('is never made of spaces or punctuation alone', () => {
    assert.deepEqual(streetAddresses("36422 W. \n . St. .m '"), [])
    assert.deepEqual(streetAddresses("88089 W.  '  Main  St.  -  Way"), [])
  })

  it('stops at three name words', () => {
    assert.deepEqual(streetAddresses('7035 Main Foo Bar St'), ['7035 Main Foo Bar St'])
    assert.deepEqual(streetAddresses('7035 Main Foo Bar Baz St'), [])
  })
})

describe('a direction letter', () => {
  it('is N, S, E or W alone, and any other letter counts as a name word', () => {
    assert.deepEqual(streetAddresses('7035 N Main Foo Bar St'), ['7035 N Main Foo Bar St'])
    assert.deepEqual(streetAddresses('7035 a Main Foo Bar St'), [])
    assert.deepEqual(streetAddresses('7035 5 Main St'), ['5 Main St'])
    assert.deepEqual(streetAddresses('7035 . Main St'), [])
    assert.deepEqual(streetAddresses("7035 ' Main St"), [])
    assert.deepEqual(streetAddresses('7035 - Main St'), [])
  })
})

describe('the guard in front of the request', () => {
  it('refuses a word that starts with anything but a letter, and a double space', () => {
    for (const street of [
      "7035 'Main Dr",
      '7035 .Main Dr',
      '7035 -Main Dr',
      '7035 5th Dr',
      '7035  Main Dr',
    ])
      assert.equal(isPlainStreet(street), false, street)
  })
})
