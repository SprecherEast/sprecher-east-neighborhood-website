import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { boundaryProblems, loadBoundary } from '../lib/boundary.mjs'
import { square } from './geoFixtures.mjs'
import { contract, intelligenceDir } from './helpers.mjs'

// The copy must lie inside the box area.yaml gives, which catches a copy with longitude and
// latitude swapped or in another coordinate system (#1009).

const record = contract.area.boundary
const copy = loadBoundary(intelligenceDir, record)
const mine = { ...record, ...square.record }
const problems = (data) => boundaryProblems(data, mine)

describe('the bounds of the boundary copy', () => {
  it('refuses a polygon outside the area’s bounds, such as one with longitude and latitude swapped', () => {
    const [west, south, east, north] = [-1, -1, 1, 1]
    assert.deepEqual(Object.values(mine.bounds), [west, south, east, north])
    const far = square(
      [],
      [
        [2, 2],
        [2.01, 2],
        [2.01, 2.01],
        [2, 2.01],
        [2, 2],
      ],
    )
    assert.match(problems(far).join(), /bounds/)
    const real = structuredClone(copy)
    real.geometry.coordinates[0] = real.geometry.coordinates[0].map(([x, y]) => [y, x])
    assert.match(boundaryProblems(real, record).join(), /bounds/)
    assert.deepEqual(boundaryProblems(copy, record), [])
  })

  it('refuses a polygon past any one side of the bounds, and accepts one on the edge', () => {
    const box = (west, south, east, north) =>
      square(
        [],
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      )
    assert.deepEqual(problems(box(-1, -1, -0.8, -0.8)), [])
    assert.deepEqual(problems(box(0.8, 0.8, 1, 1)), [])
    for (const [side, ring] of Object.entries({
      west: box(-1.1, 0, -0.9, 0.1),
      east: box(0.9, 0, 1.1, 0.1),
      south: box(0, -1.1, 0.1, -0.9),
      north: box(0, 0.9, 0.1, 1.1),
    })) {
      assert.match(problems(ring).join(), /bounds/, side)
    }
  })
})
