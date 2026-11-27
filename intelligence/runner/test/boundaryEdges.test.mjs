import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import { boundaryProblems, loadBoundary, pointPlace } from '../lib/boundary.mjs'
import { box, dataWith, loose, record } from './boundaryHelpers.mjs'
import { tempDir } from './helpers.mjs'

// Cases the boundary rules must take in their own words (#1009): a ring that is not a list, a flat
// ring, a point on an edge or a vertex against one just off it, and how many problems a refused
// copy names.

describe('a ring that is not a list', () => {
  it('is named, not thrown on', () => {
    for (const ring of [null, undefined, 5, {}])
      assert.deepEqual(
        boundaryProblems(dataWith(ring), loose),
        ['a ring needs at least 4 points'],
        String(ring),
      )
  })
})

describe('a ring with no area', () => {
  it('is refused on a line that is not along an axis or the diagonal', () => {
    const line = [
      [0, 0],
      [0.01, 0.02],
      [0.02, 0.04],
      [0, 0],
    ]
    assert.deepEqual(boundaryProblems(dataWith(line), loose), ['a ring has no area'])
    assert.deepEqual(boundaryProblems(dataWith([...line].reverse()), loose), ['a ring has no area'])
  })
})

describe('a point on the boundary', () => {
  const data = dataWith(box(-89.3, 43.1, 0.1, 0.1))
  it('is inside on each edge and each vertex', () => {
    for (const point of [
      [-89.3, 43.15],
      [-89.2, 43.15],
      [-89.25, 43.1],
      [-89.25, 43.2],
      [-89.3, 43.1],
      [-89.2, 43.2],
    ])
      assert.equal(pointPlace(data, point), 'inside', String(point))
  })

  it('is outside when it is a hair off an edge or a vertex', () => {
    for (const point of [
      [-89.30000001, 43.15],
      [-89.19999999, 43.15],
      [-89.25, 43.09999999],
      [-89.25, 43.20000001],
      [-89.30000001, 43.09999999],
    ])
      assert.equal(pointPlace(data, point), 'outside', String(point))
  })

  it('is inside on a slanted edge, however the edge runs', () => {
    const slanted = dataWith([
      [0, 0],
      [0.2, 0.1],
      [0.2, 0.3],
      [0, 0.1],
      [0, 0],
    ])
    assert.equal(pointPlace(slanted, [0.1, 0.05]), 'inside')
    assert.equal(pointPlace(slanted, [0.1, 0.0501]), 'inside')
    assert.equal(pointPlace(slanted, [0.1, 0.0499]), 'outside')
    assert.equal(pointPlace(slanted, [0.3, 0.1]), 'outside')
  })
})

describe('what a refused copy says', () => {
  it('names the first three problems the shape check found, and no more', () => {
    const dir = tempDir('boundary-')
    writeFileSync(path.join(dir, record.file), JSON.stringify(dataWith(box(0, 0, 1, 1))))
    for (const [problems, said] of [
      [['a'], 'a'],
      [['a', 'b'], 'a; b'],
      [['a', 'b', 'c', 'd'], 'a; b; c'],
    ])
      assert.throws(
        () => loadBoundary(dir, record, () => problems),
        new Error(`${record.file}: ${said}`),
      )
  })
})
