import { describe, expect, it } from 'vitest'

import { cursorAfterLast, encodeCursor, MAX_CURSOR_LENGTH, parseCursor } from './cursor'

const DAY = '2026-10-19T00:00:00.000Z'

describe('encodeCursor', () => {
  it('writes the sort date and the id', () => {
    expect(encodeCursor(DAY, 42)).toBe(`${DAY}|42`)
  })

  it('writes the date as toISOString() does, whatever form it came in', () => {
    expect(encodeCursor('2026-10-19T05:30:00+00:00', 7)).toBe('2026-10-19T05:30:00.000Z|7')
  })

  it('leaves the date empty for an item without one', () => {
    expect(encodeCursor(null, 3)).toBe('|3')
    expect(encodeCursor(undefined, 3)).toBe('|3')
  })

  it.each([
    ['a key that is not a date', () => encodeCursor('soon', 1)],
    ['a zero id', () => encodeCursor(DAY, 0)],
    ['a fractional id', () => encodeCursor(DAY, 1.5)],
  ])('refuses %s', (_label, encode) => {
    expect(encode).toThrow()
  })
})

describe('parseCursor', () => {
  it('reads back what encodeCursor writes', () => {
    expect(parseCursor(encodeCursor(DAY, 42))).toEqual({ key: DAY, id: 42 })
    expect(parseCursor(encodeCursor(null, 9))).toEqual({ key: null, id: 9 })
    expect(parseCursor(`${DAY}|${Number.MAX_SAFE_INTEGER}`)).toEqual({
      key: DAY,
      id: Number.MAX_SAFE_INTEGER,
    })
  })

  it.each([
    ['a number', 42],
    ['null', null],
    ['undefined', undefined],
    ['an object', { key: DAY, id: 1 }],
    ['an array', [DAY, 1]],
    ['true', true],
  ])('rejects a wrong type: %s', (_label, input) => {
    expect(parseCursor(input)).toBeNull()
  })

  it.each([
    ['February 30', '2026-02-30T00:00:00.000Z|1'],
    ['hour 24', '2026-10-19T24:00:00.000Z|1'],
    ['a date without a time', '2026-10-19|1'],
    ['a time without milliseconds', '2026-10-19T00:00:00Z|1'],
    ['an offset instead of Z', '2026-10-19T00:00:00.000+00:00|1'],
    ['a word', 'tomorrow|1'],
    ['SQL', "' OR 1=1 --|1"],
  ])('rejects a bad date: %s', (_label, input) => {
    expect(parseCursor(input)).toBeNull()
  })

  it.each([
    ['a zero id', `${DAY}|0`],
    ['a negative id', `${DAY}|-1`],
    ['a leading zero', `${DAY}|01`],
    ['a decimal id', `${DAY}|1.5`],
    ['an exponent', `${DAY}|1e3`],
    ['a missing id', `${DAY}|`],
    ['an id above the safe integers', `${DAY}|9999999999999999`],
    ['spaces', `${DAY}| 1`],
  ])('rejects a bad id: %s', (_label, input) => {
    expect(parseCursor(input)).toBeNull()
  })

  it.each([
    ['an extra field', `${DAY}|1|2`],
    ['an extra operator field', `${DAY}|1|{"or":[]}`],
    ['no separator', `${DAY}1`],
    ['an empty string', ''],
  ])('rejects the wrong shape: %s', (_label, input) => {
    expect(parseCursor(input)).toBeNull()
  })

  it('rejects anything longer than the limit before reading it', () => {
    const long = `${DAY}|${'1'.repeat(MAX_CURSOR_LENGTH)}`
    expect(long.length).toBeGreaterThan(MAX_CURSOR_LENGTH)
    expect(parseCursor(long)).toBeNull()
    expect(parseCursor('x'.repeat(100_000))).toBeNull()
  })
})

describe('cursorAfterLast', () => {
  const docs = [
    { id: 1, date: DAY },
    { id: 2, date: '2026-10-20T00:00:00.000Z' },
  ]

  it('points after the last item when more follow', () => {
    expect(cursorAfterLast(docs, (doc) => doc.date, true)).toBe('2026-10-20T00:00:00.000Z|2')
  })

  it('is null on the last page and on an empty one', () => {
    expect(cursorAfterLast(docs, (doc) => doc.date, false)).toBeNull()
    expect(cursorAfterLast([], () => DAY, true)).toBeNull()
  })
})
