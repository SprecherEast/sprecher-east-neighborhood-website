import { describe, expect, it } from 'vitest'

import { pieArcs, pieLabelFit, piePath } from './pie'

describe('pieArcs', () => {
  it('splits a full turn by share, clockwise from the top, whatever the shares add up to', () => {
    const arcs = pieArcs([46, 38, 13, 3])
    expect(arcs[0]?.start).toBeCloseTo(0)
    expect(arcs.at(-1)?.end).toBeCloseTo(Math.PI * 2)
    arcs.slice(1).forEach((arc, i) => expect(arc.start).toBeCloseTo(arcs[i]?.end ?? NaN))
    expect(((arcs[0]?.end ?? 0) / (Math.PI * 2)) * 100).toBeCloseTo(46)
    const scaled = pieArcs([2, 1, 1])
    expect(scaled[0]?.end).toBeCloseTo(Math.PI)
  })

  it('puts each middle halfway through its arc', () => {
    const [first] = pieArcs([50, 50])
    expect(first?.mid).toBeCloseTo(Math.PI / 2)
  })

  it('gives a share of nothing an empty arc and survives an all-zero list', () => {
    expect(pieArcs([0, 100])[0]?.end).toBeCloseTo(0)
    expect(pieArcs([0, 0]).every((arc) => arc.end === arc.start)).toBe(true)
  })
})

describe('piePath', () => {
  it('draws a wedge from the centre out to the rim and back', () => {
    const d = piePath(100, 100, 50, 0, Math.PI / 2)
    expect(d.startsWith('M 100 100 L 100 50')).toBe(true)
    expect(d).toContain('A 50 50 0 0 1 150 100')
    expect(d.endsWith('Z')).toBe(true)
  })

  it('takes the long way round for a wedge over half the circle', () => {
    expect(piePath(100, 100, 50, 0, Math.PI * 1.5)).toContain('A 50 50 0 1 1')
  })

  it('draws a whole circle as two half arcs, since one arc cannot start where it ends', () => {
    const d = piePath(100, 100, 50, 0, Math.PI * 2)
    expect(d.match(/A /g)).toHaveLength(2)
  })
})

describe('pieLabelFit', () => {
  const lines = ['Dane County', '$1,500', '12%']

  it('writes everything inside a slice with room for it', () => {
    expect(
      pieLabelFit({ share: 46, radius: 150, lines: ['Madison schools', '$3,000', '46%'] }),
    ).toBe('full')
  })

  it('cuts down to the percent when the name will not fit, and pulls out when even that will not', () => {
    expect(pieLabelFit({ share: 12.5, radius: 110, lines })).toBe('percent')
    expect(pieLabelFit({ share: 3, radius: 110, lines: ['MATC', '$300', '3%'] })).toBe('out')
  })

  it('fits a thin slice’s percent inside on a big pie and pulls it out on a small one', () => {
    const thin = ['Madison College (MATC)', '$300', '3%']
    expect(pieLabelFit({ share: 3.5, radius: 230, lines: thin })).toBe('percent')
    expect(pieLabelFit({ share: 3.5, radius: 130, lines: thin })).toBe('out')
  })

  it('never fits a slice of nothing', () => {
    expect(pieLabelFit({ share: 0, radius: 300, lines })).toBe('out')
  })
})
