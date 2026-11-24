import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { boundaryAgeDays, boundaryProblems, loadBoundary, pointPlace } from '../lib/boundary.mjs'
import { contract, intelligenceDir } from './helpers.mjs'
import { INSIDE, JUST_INSIDE, JUST_OUTSIDE, square } from './geoFixtures.mjs'

// The City's boundary for the area (#1009): the checked-in copy, the test of a point against it,
// and what makes the copy unusable. Geometry runs on fixtures; nothing here calls the network.

const record = contract.area.boundary
const copy = loadBoundary(intelligenceDir, record)

describe('a point against the boundary', () => {
  it('puts an address well inside the area inside', () => {
    assert.equal(pointPlace(copy, INSIDE), 'inside')
  })

  it('puts an address 30 m inside the edge inside, and one 60 m outside it outside', () => {
    assert.equal(pointPlace(copy, JUST_INSIDE), 'inside')
    assert.equal(pointPlace(copy, JUST_OUTSIDE), 'outside')
  })

  it('puts a point far away outside', () => {
    assert.equal(pointPlace(copy, [-89.38, 43.07]), 'outside')
  })

  const box = square()
  it('counts a point on an edge as inside, the edge being the City’s own line', () => {
    assert.equal(pointPlace(box, [0.005, 0]), 'inside')
    assert.equal(pointPlace(box, [0.01, 0.004]), 'inside')
  })

  it('counts a vertex as inside', () => {
    for (const vertex of box.geometry.coordinates[0])
      assert.equal(pointPlace(box, vertex), 'inside')
  })

  it('puts a point a hair outside an edge outside', () => {
    assert.equal(pointPlace(box, [0.005, -0.000001]), 'outside')
    assert.equal(pointPlace(box, [0.0100001, 0.005]), 'outside')
  })

  it('leaves a hole out of the area', () => {
    const hole = [
      [0.004, 0.004],
      [0.006, 0.004],
      [0.006, 0.006],
      [0.004, 0.006],
      [0.004, 0.004],
    ]
    const donut = square([hole])
    assert.equal(pointPlace(donut, [0.005, 0.005]), 'outside')
    assert.equal(pointPlace(donut, [0.002, 0.002]), 'inside')
  })
})

describe('the checked-in copy', () => {
  it('is the City’s layer feature for the record, dated, with one outer ring', () => {
    assert.equal(copy.naId, record.naId)
    assert.equal(copy.source, record.source)
    assert.match(copy.fetchedAt, /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(copy.geometry.coordinates.length, 1)
    assert.deepEqual(boundaryProblems(copy, record), [])
  })

  it('counts its age in days', () => {
    const day = (text) => new Date(`${text}T12:00:00Z`)
    assert.equal(boundaryAgeDays({ fetchedAt: '2026-11-24' }, day('2026-11-24')), 0)
    assert.equal(boundaryAgeDays({ fetchedAt: '2026-11-24' }, day('2027-11-24')), 365)
  })
})

describe('a boundary that can’t be used', () => {
  const ok = square()
  const mine = { ...record, ...square.record }
  const problems = (data) => boundaryProblems(data, mine)

  it('accepts a closed ring of the right feature', () => assert.deepEqual(problems(ok), []))

  it('refuses another feature or another layer', () => {
    assert.match(problems({ ...ok, naId: 7 }).join(), /naId/)
    assert.match(problems({ ...ok, source: 'https://example.org/layer' }).join(), /source/)
  })

  it('refuses a ring that isn’t closed, is too short or has no area', () => {
    const open = square(
      [],
      [
        [0, 0],
        [0.01, 0],
        [0.01, 0.01],
        [0, 0.01],
      ],
    )
    assert.match(problems(open).join(), /closed/)
    const short = square(
      [],
      [
        [0, 0],
        [0.01, 0],
        [0, 0],
      ],
    )
    assert.match(problems(short).join(), /4 points/)
    const flat = square(
      [],
      [
        [0, 0],
        [0.01, 0],
        [0.02, 0],
        [0, 0],
      ],
    )
    assert.match(problems(flat).join(), /no area/)
  })

  it('refuses coordinates that aren’t numbers or are out of range', () => {
    assert.match(
      problems(
        square(
          [],
          [
            [0, 0],
            [0.01, 'x'],
            [0.01, 0.01],
            [0, 0],
          ],
        ),
      ).join(),
      /number/,
    )
    assert.match(
      problems(
        square(
          [],
          [
            [0, 0],
            [500, 0],
            [500, 1],
            [0, 0],
          ],
        ),
      ).join(),
      /range/,
    )
  })

  it('refuses an area as large as a county', () => {
    assert.match(
      problems(
        square(
          [],
          [
            [0, 0],
            [2, 0],
            [2, 2],
            [0, 2],
            [0, 0],
          ],
        ),
      ).join(),
      /larger/,
    )
  })

  it('refuses a missing polygon or another geometry type', () => {
    assert.match(problems({ ...ok, geometry: null }).join(), /geometry/)
    assert.match(
      problems({ ...ok, geometry: { type: 'MultiPolygon', coordinates: [] } }).join(),
      /Polygon/,
    )
  })

  it('refuses a file that is missing or isn’t JSON', () => {
    assert.throws(
      () => loadBoundary(intelligenceDir, { ...record, file: 'no-such.json' }),
      /no-such/,
    )
    assert.throws(() => loadBoundary(intelligenceDir, { ...record, file: 'README.md' }), /not JSON/)
  })
})
