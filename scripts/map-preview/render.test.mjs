import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  EXTENT,
  HEIGHT,
  WIDTH,
  boxInside,
  boxesOverlap,
  groundAspect,
  project,
} from './geometry.mjs'
import { LABELED_NEIGHBORS, SPRECHER_EAST, buildLabels, buildSvg } from './render.mjs'

const data = JSON.parse(readFileSync(new URL('data/madison-map.json', import.meta.url), 'utf8'))
const labels = buildLabels(data)

describe('About page map picture (#1419)', () => {
  it('is 4:3, drawn from true ground distances, north up', () => {
    expect(WIDTH / HEIGHT).toBeCloseTo(4 / 3, 5)
    expect(Math.abs(groundAspect() - 4 / 3)).toBeLessThan(0.005)
    const [, yNorth] = project([EXTENT.west, EXTENT.north])
    const [, ySouth] = project([EXTENT.west, EXTENT.south])
    expect([yNorth, ySouth]).toEqual([0, HEIGHT])
  })

  it('names every shape it draws: the boundary, the neighbors with a fill, the park, the roads', () => {
    const text = labels.flatMap((l) => l.lines).join(' ')
    const drawn = [
      SPRECHER_EAST,
      ...LABELED_NEIGHBORS,
      'Door Creek Park',
      'I-94',
      'Sprecher Rd',
      'Cottage Grove Rd',
    ]
    for (const name of drawn) {
      expect(text, name).toContain(name.replace(' Park', '').split(' ')[0])
    }
    expect(labels.some((l) => l.kind === 'scale')).toBe(true)
  })

  it('keeps every label on the picture', () => {
    for (const label of labels) expect(boxInside(label.box, 8), label.id).toBe(true)
  })

  it('never lets two labels overlap', () => {
    labels.forEach((a, i) =>
      labels
        .slice(i + 1)
        .forEach((b) => expect(boxesOverlap(a.box, b.box, 6), `${a.id} / ${b.id}`).toBe(false)),
    )
  })

  it('keeps every label legible at the narrowest width the page shows the picture (288 px, a phone at 320), at 12 px, the smallest type of the site', () => {
    const scale = 288 / WIDTH
    for (const label of labels) expect(label.size * scale, label.id).toBeGreaterThanOrEqual(12)
  })

  it('draws the live My Maps boundary, a closed 15-sided shape', () => {
    expect(data.boundary).toHaveLength(16)
    expect(data.boundary[0]).toEqual(data.boundary.at(-1))
  })

  it('is plain SVG text with no tilt of the map itself', () => {
    const svg = buildSvg(data)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).not.toMatch(/<svg[^>]*transform=/)
  })
})
