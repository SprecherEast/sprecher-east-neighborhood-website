import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { tempDir } from './helpers.mjs'

import { boundaryProblems, loadBoundary } from '../lib/boundary.mjs'
import { box, dataWith, loose, record, ringOf } from './boundaryHelpers.mjs'

const problemsOf = (ring, rec = loose) => boundaryProblems(dataWith(ring), rec)

// What is wrong with a copy, in its own words, and loading it (#1009). Plain fixtures.

describe('what is wrong with a copy, in its own words', () => {
  it('names a wrong ID, a wrong layer, and a missing or wrong geometry, together', () => {
    const wrong = { naId: 6, source: 'https://other.example/', geometry: 'x' }
    assert.deepEqual(boundaryProblems(wrong, record), [
      'naId is not 5',
      'source is not the record’s layer',
      'geometry is missing',
    ])
    assert.deepEqual(boundaryProblems(null, record), [
      'naId is not 5',
      'source is not the record’s layer',
      'geometry is missing',
    ])
    assert.deepEqual(boundaryProblems({ ...wrong, geometry: { type: 'Point' } }, record), [
      'naId is not 5',
      'source is not the record’s layer',
      'geometry must be a Polygon',
    ])
    assert.deepEqual(
      boundaryProblems({ ...wrong, geometry: { type: 'Polygon', coordinates: [] } }, record),
      ['naId is not 5', 'source is not the record’s layer', 'a Polygon needs a ring'],
    )
  })

  it('says a ring needs four points, and that a point is a pair of numbers', () => {
    assert.deepEqual(
      problemsOf([
        [0, 0],
        [1, 0],
        [0, 0],
      ]),
      ['a ring needs at least 4 points'],
    )
    assert.deepEqual(problemsOf('abcde'), ['a ring needs at least 4 points'])
    for (const bad of [[1, 2, 3], [1], 'ab', null, ['1', '2'], [NaN, 1], [Infinity, 0]])
      assert.deepEqual(
        problemsOf([[0, 0], bad, [0.1, 0.1], [0, 0]]),
        ['every point must be a pair of numbers'],
        JSON.stringify(bad),
      )
  })

  it('takes a longitude up to 180 and a latitude up to 90, either sign, and no more', () => {
    const range = ['a point is out of range for longitude and latitude']
    for (const ring of [
      box(179.9, 0, 0.1, 0.1),
      box(-180, 0, 0.1, 0.1),
      box(0, 89.9, 0.1, 0.1),
      box(0, -90, 0.1, 0.1),
    ])
      assert.deepEqual(problemsOf(ring), [], JSON.stringify(ring))
    for (const ring of [
      box(180.5, 0, 0.1, 0.1),
      box(-180.5, 0, 0.1, 0.1),
      box(0, 90.5, 0.1, 0.1),
      box(0, -90.5, 0.1, 0.1),
    ])
      assert.deepEqual(problemsOf(ring), range, JSON.stringify(ring))
    assert.deepEqual(problemsOf(box(0, 90, 0.1, 0.1)), range)
  })

  it('says a ring must be closed when either coordinate of the last point differs', () => {
    const closed = ['a ring must be closed']
    assert.deepEqual(
      problemsOf([
        [0, 0],
        [0.1, 0],
        [0.1, 0.1],
        [0.05, 0],
      ]),
      closed,
    )
    assert.deepEqual(
      problemsOf([
        [0, 0],
        [0.1, 0],
        [0.1, 0.1],
        [0, 0.05],
      ]),
      closed,
    )
  })

  it('says a ring has no area, for a line and for a triangle that has one', () => {
    assert.deepEqual(
      problemsOf([
        [0, 0],
        [0.1, 0.1],
        [0.2, 0.2],
        [0, 0],
      ]),
      ['a ring has no area'],
    )
    assert.deepEqual(
      problemsOf([
        [0, 0],
        [0.1, 0],
        [0.1, 0.1],
        [0, 0],
      ]),
      [],
    )
    assert.deepEqual(
      problemsOf([
        [0, 0],
        [0.1, 0],
        [0.1, 0.1],
        [0, 0.1],
        [0, 0],
      ]),
      [],
    )
  })

  it('says a polygon is larger than a neighborhood past half a degree across, either way', () => {
    const large = ['the polygon is larger than a neighborhood']
    assert.deepEqual(problemsOf(box(0, 0, 0.5, 0.1)), [])
    assert.deepEqual(problemsOf(box(0, 0, 0.1, 0.5)), [])
    assert.deepEqual(problemsOf(box(0, 0, 0.6, 0.1)), large)
    assert.deepEqual(problemsOf(box(0, 0, 0.1, 0.6)), large)
    assert.deepEqual(problemsOf(box(0, 0, 0.5000001, 0.1)), large)
  })

  it('says a point is outside the box in area.yaml, and checks nothing when there is none', () => {
    const outside = [
      'a point is outside the area’s bounds in area.yaml (longitude and latitude swapped?)',
    ]
    assert.deepEqual(problemsOf(box(0, 0, 0.1, 0.1), record), [])
    assert.deepEqual(problemsOf(box(0.95, 0, 0.1, 0.1), record), outside)
    assert.deepEqual(problemsOf(box(0, 0, 0.1, 0.1), loose), [])
    assert.deepEqual(problemsOf(box(5, 5, 0.1, 0.1), loose), [])
  })

  it('lists every problem of a ring that has several, in order', () => {
    const several = ringOf([0, 0], [0.7, 0.7], [1.4, 1.4])
    assert.deepEqual(problemsOf(several, record), [
      'a ring has no area',
      'the polygon is larger than a neighborhood',
      'a point is outside the area’s bounds in area.yaml (longitude and latitude swapped?)',
    ])
  })
})

describe('loading the copy', () => {
  const folder = () => tempDir('boundary-')
  const write = (dir, text) => writeFileSync(path.join(dir, record.file), text)
  const refused = (dir, validate) => {
    try {
      loadBoundary(dir, record, validate)
    } catch (error) {
      return error.message
    }
    return null
  }

  it('says why a copy that is missing or not JSON stops the start', () => {
    const dir = folder()
    assert.match(refused(dir), /^square\.json: the boundary is ENOENT: no such file or directory/)
    write(dir, '{nope')
    assert.equal(refused(dir), 'square.json: the boundary is not JSON')
  })

  it('names the first three problems, joined by semicolons, and the schema’s first when it has any', () => {
    const dir = folder()
    write(dir, JSON.stringify({ naId: 6, source: 'x', geometry: { type: 'Point' } }))
    assert.equal(
      refused(dir),
      'square.json: naId is not 5; source is not the record’s layer; geometry must be a Polygon',
    )
    assert.equal(
      refused(dir, () => ['one']),
      'square.json: one',
    )
    assert.equal(
      refused(dir, () => ['a', 'b', 'c', 'd', 'e']),
      'square.json: a; b; c',
    )
    write(dir, JSON.stringify(dataWith(box(0, 0, 0.1, 0.1))))
    assert.deepEqual(loadBoundary(dir, record).naId, 5)
    assert.equal(
      refused(dir, () => []),
      null,
    )
  })
})
