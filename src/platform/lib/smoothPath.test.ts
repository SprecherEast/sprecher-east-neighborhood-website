import { describe, expect, it } from 'vitest'

import { smoothLinePath } from './smoothPath'

/** Every number in an SVG path, in order, as [x, y] pairs */
const pairs = (path: string) => {
  const numbers = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  return Array.from({ length: numbers.length / 2 }, (_, i) => [numbers[2 * i], numbers[2 * i + 1]])
}

describe('smoothLinePath', () => {
  it('is empty for no points and a lone move for one', () => {
    expect(smoothLinePath([])).toBe('')
    expect(smoothLinePath([[3, 4]])).toBe('M3,4')
  })

  it('starts at the first point and passes through every other point', () => {
    const points: [number, number][] = [
      [0, 10],
      [10, 2],
      [20, 8],
      [30, 1],
    ]
    const path = smoothLinePath(points)
    expect(path.startsWith('M0,10')).toBe(true)
    const all = pairs(path)
    // M x,y then three cubic segments of three pairs each; the last pair of each is a data point
    expect(all).toHaveLength(1 + 3 * 3)
    expect([all[3], all[6], all[9]]).toEqual([points[1], points[2], points[3]])
  })

  it('never leaves the range of the points, so a curve stays inside its plot', () => {
    const points: [number, number][] = [
      [0, 20],
      [10, 20],
      [20, 0],
      [30, 20],
      [40, 20],
    ]
    for (const [, y] of pairs(smoothLinePath(points))) {
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(20)
    }
  })

  it('stays flat through equal values', () => {
    const flat = pairs(
      smoothLinePath([
        [0, 5],
        [10, 5],
        [20, 5],
      ]),
    )
    expect(new Set(flat.map(([, y]) => y))).toEqual(new Set([5]))
  })
})
