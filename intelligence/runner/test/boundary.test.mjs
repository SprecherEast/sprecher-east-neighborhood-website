import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  boundaryAgeDays,
  boundaryProblems,
  loadBoundary,
  pointPlace,
  staleBoundaryProblem,
} from '../lib/boundary.mjs'
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

describe('a copy dated in the future', () => {
  it('is reported, so an age check can’t be silenced', () => {
    const now = new Date('2026-11-24T12:00:00Z')
    assert.match(staleBoundaryProblem({ ...copy, fetchedAt: '2027-01-01' }, record, now), /future/)
    assert.equal(staleBoundaryProblem({ ...copy, fetchedAt: '2026-11-24' }, record, now), null)
    // The same day is not the future, even early in the morning
    const early = new Date('2026-11-24T00:05:00Z')
    assert.equal(staleBoundaryProblem({ ...copy, fetchedAt: '2026-11-24' }, record, early), null)
    assert.match(
      staleBoundaryProblem({ ...copy, fetchedAt: '2026-11-25' }, record, early),
      /future/,
    )
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

  it('refuses a missing polygon or another geometry type', () => {
    assert.match(problems({ ...ok, geometry: null }).join(), /geometry/)
    assert.deepEqual(problems({ ...ok, geometry: null }), ['geometry is missing'])
    const multi = { type: 'MultiPolygon', coordinates: [ok.geometry.coordinates] }
    assert.deepEqual(problems({ ...ok, geometry: multi }), ['geometry must be a Polygon'])
  })

  it('refuses a polygon with no ring', () => {
    for (const coordinates of [[], null, 'ring']) {
      const geometry = { type: 'Polygon', coordinates }
      assert.deepEqual(problems({ ...ok, geometry }), ['a Polygon needs a ring'])
    }
  })

  it('refuses a file that is missing or isn’t JSON', () => {
    assert.throws(
      () => loadBoundary(intelligenceDir, { ...record, file: 'no-such.json' }),
      /no-such/,
    )
    assert.throws(() => loadBoundary(intelligenceDir, { ...record, file: 'README.md' }), /not JSON/)
  })
})
