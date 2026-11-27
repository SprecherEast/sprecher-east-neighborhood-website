import { describe, expect, it } from 'vitest'

import { inPickedOrder } from './inPickedOrder'

const item = (id: number) => ({ id, name: `item ${id}` })

describe('inPickedOrder', () => {
  it('puts items in the order the ids were picked, whatever order they were read in', () => {
    expect(inPickedOrder([item(1), item(2), item(3)], [3, 1, 2]).map((i) => i.id)).toEqual([
      3, 1, 2,
    ])
  })

  it('leaves out an id that was not read, such as an unpublished document', () => {
    expect(inPickedOrder([item(2)], [9, 2, 8]).map((i) => i.id)).toEqual([2])
  })

  it('leaves out an item nobody picked, and lists a repeated pick once', () => {
    expect(inPickedOrder([item(1), item(4)], [4, 4]).map((i) => i.id)).toEqual([4])
  })

  it('gives nothing for nothing', () => {
    expect(inPickedOrder([], [1])).toEqual([])
    expect(inPickedOrder([item(1)], [])).toEqual([])
  })
})
