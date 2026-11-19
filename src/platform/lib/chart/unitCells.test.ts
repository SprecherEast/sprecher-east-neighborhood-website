import { describe, expect, it } from 'vitest'

import { toUnitCells, toUnitCounts } from './unitCells'

const part = (key: string, value: number) => ({ key, label: key, value })

/** 2027 "pays for" shares, from the verified budget figures (Mayor's proposal, $477,549,854) */
const PAYS_FOR_2027 = [
  part('safety', 194_768_276),
  part('debt', 80_479_929),
  part('works', 56_659_014),
  part('planning', 56_407_086),
  part('running', 51_377_257),
  part('transport', 37_858_292),
]
const COMES_IN_2027 = [
  part('levy', 337_902_281),
  part('fees', 79_770_375),
  part('aid', 53_237_694),
  part('savings', 6_639_504),
]

describe('toUnitCounts and toUnitCells (largest remainder, exactly N cells)', () => {
  it('gives the 2027 "pays for" shares 41, 17, 12, 12, 10 and 8 squares', () => {
    expect(toUnitCounts(PAYS_FOR_2027, 100)).toEqual([41, 17, 12, 12, 10, 8])
  })

  it('gives the 2027 "comes in" shares 71, 17, 11 and 1 squares', () => {
    expect(toUnitCounts(COMES_IN_2027, 100)).toEqual([71, 17, 11, 1])
  })

  it('fills every cell with its part, in order', () => {
    const cells = toUnitCells([part('a', 1), part('b', 3)], 8)
    expect(cells).toEqual(['a', 'a', 'b', 'b', 'b', 'b', 'b', 'b'])
  })

  it.each([
    ['one part', [part('only', 12.5)], [100]],
    ['a tie goes to the earlier part', [part('a', 1), part('b', 1), part('c', 1)], [34, 33, 33]],
    ['a zero part gets no cell', [part('a', 0), part('b', 5)], [0, 100]],
    ['values that do not add up to 100', [part('a', 1), part('b', 2)], [33, 67]],
    [
      'a part too small for one cell can still round to none',
      [part('a', 1), part('b', 1000)],
      [0, 100],
    ],
  ])('always totals 100: %s', (_name, data, expected) => {
    const counts = toUnitCounts(data, 100)
    expect(counts).toEqual(expected)
    expect(toUnitCells(data, 100)).toHaveLength(100)
  })

  it('works for other cell counts', () => {
    expect(toUnitCounts([part('a', 1), part('b', 1)], 12)).toEqual([6, 6])
    expect(toUnitCounts([part('a', 1), part('b', 1), part('c', 1)], 25)).toEqual([9, 8, 8])
  })

  it('refuses a total of zero or no parts, since no cell could be right', () => {
    expect(() => toUnitCounts([part('a', 0)], 100)).toThrow(RangeError)
    expect(() => toUnitCounts([], 100)).toThrow(RangeError)
    expect(() => toUnitCounts([part('a', 1)], 0)).toThrow(RangeError)
  })
})
