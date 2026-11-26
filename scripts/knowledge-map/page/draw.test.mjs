import { describe, expect, it } from 'vitest'

import { bend, shapeNames, shapePath } from './draw.mjs'
import { SHAPES } from './style.mjs'

/** A context that records the calls it gets. */
const recorder = () => {
  const calls = []
  const ctx = new Proxy(
    {},
    {
      get:
        (_t, name) =>
        (...args) =>
          calls.push([name, ...args]),
    },
  )
  return { calls, ctx }
}

describe('draw (#1463)', () => {
  it('has a drawing routine for every shape the styles can hand out, and for rings', () => {
    for (const shape of [...SHAPES, 'ring']) expect(shapeNames()).toContain(shape)
  })

  it('traces each shape as a closed path with something in it', () => {
    for (const shape of shapeNames()) {
      const { ctx, calls } = recorder()
      shapePath(ctx, shape, 10, 10, 8)
      expect(calls[0][0]).toBe('beginPath')
      expect(calls.length).toBeGreaterThan(1)
    }
  })

  it('bends a line off the straight one, by the same side for the same pair', () => {
    const c = bend({ x: 0, y: 0 }, { x: 100, y: 0 })
    expect(c.x).toBe(50)
    expect(c.y).not.toBe(0)
    expect(bend({ x: 0, y: 0 }, { x: 100, y: 0 })).toEqual(c)
  })
})
