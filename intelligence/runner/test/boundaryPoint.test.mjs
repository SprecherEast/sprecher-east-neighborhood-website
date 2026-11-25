import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { boundaryAgeDays, pointPlace, staleBoundaryProblem } from '../lib/boundary.mjs'
import { box, ringOf } from './boundaryHelpers.mjs'

// Whether a point is inside, and how old a copy is (#1009). Plain fixtures.

describe('whether a point is inside', () => {
  const polygon = (...rings) => ({ geometry: { coordinates: rings } })
  const diamond = polygon(ringOf([0, 1], [1, 0], [0, -1], [-1, 0]))
  const steps = Array.from({ length: 17 }, (_, i) => -2 + i * 0.25)

  it('says a pair of numbers is needed', () => {
    assert.throws(() => pointPlace(diamond, [1]), {
      name: 'TypeError',
      message: 'a point is a pair of numbers',
    })
    assert.throws(() => pointPlace(diamond, 'ab'), TypeError)
  })

  it('agrees with the shape on a grid that hits every vertex level, edge and corner', () => {
    for (const x of steps)
      for (const y of steps)
        assert.equal(
          pointPlace(diamond, [x, y]),
          Math.abs(x) + Math.abs(y) <= 1 ? 'inside' : 'outside',
          `${x},${y}`,
        )
  })

  it('counts a hole as outside, and its edge as inside', () => {
    const holed = polygon(
      ringOf([-2, -2], [2, -2], [2, 2], [-2, 2]),
      ringOf([0, 1], [1, 0], [0, -1], [-1, 0]),
    )
    for (const x of steps)
      for (const y of steps) {
        const d = Math.abs(x) + Math.abs(y)
        const expected =
          Math.abs(x) <= 2 && Math.abs(y) <= 2 && (d >= 1 || Math.abs(d - 1) < 1e-12)
            ? 'inside'
            : 'outside'
        assert.equal(pointPlace(holed, [x, y]), expected, `${x},${y}`)
      }
  })

  it('takes a point on the edge, within about 0.1 mm, but nothing past an end of it', () => {
    const sq = polygon(box(0, 0, 0.01, 0.01))
    assert.equal(pointPlace(sq, [0.005, 0]), 'inside')
    assert.equal(pointPlace(sq, [0.005, -1e-9]), 'inside')
    assert.equal(pointPlace(sq, [0.005, -2e-9]), 'outside')
    assert.equal(pointPlace(sq, [0.011, 0]), 'outside')
    assert.equal(pointPlace(sq, [-0.001, 0]), 'outside')
    assert.equal(pointPlace(sq, [0.005, 0.011]), 'outside')
    assert.equal(pointPlace(sq, [0.005, 0.005]), 'inside')
    assert.equal(pointPlace(sq, [0.02, 0.005]), 'outside')
  })

  it('takes the point of an edge that has no length', () => {
    const dot = polygon([
      [0, 0],
      [0, 0],
    ])
    assert.equal(pointPlace(dot, [0, 0]), 'inside')
    assert.equal(pointPlace(dot, [1, 1]), 'outside')
  })
})

describe('how old a copy is', () => {
  const data = { fetchedAt: '2026-11-01' }
  const noon = (iso) => new Date(`${iso}T12:00:00Z`)

  it('counts whole days from noon of the day it was fetched', () => {
    assert.equal(boundaryAgeDays(data, noon('2026-11-03')), 2)
    assert.equal(boundaryAgeDays(data, new Date(noon('2026-11-03').getTime() - 1)), 1)
    assert.equal(boundaryAgeDays(data, new Date(noon('2026-11-03').getTime() + 86_399_999)), 2)
  })

  it('says so in the run log when it is older than the limit, or dated in the future', () => {
    const rec = { maxAgeDays: 10 }
    assert.equal(staleBoundaryProblem(data, rec, noon('2026-11-11')), null)
    assert.equal(
      staleBoundaryProblem(data, rec, noon('2026-11-12')),
      "The copy of the City's boundary is 11 days old (limit 10); refresh it with node run.mjs --refresh-boundary.",
    )
    assert.equal(staleBoundaryProblem(data, rec, noon('2026-11-01')), null)
    assert.equal(
      staleBoundaryProblem({ fetchedAt: '2026-11-02' }, rec, noon('2026-11-01')),
      "The copy of the City's boundary is dated in the future (2026-11-02); fix its date.",
    )
  })
})
