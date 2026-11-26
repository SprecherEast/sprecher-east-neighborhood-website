import { describe, expect, it } from 'vitest'

import { createSim, forceStep, hash01, mindMap, regionHomes, regionOf, seed } from './layout.mjs'
import { buildModel } from './model.mjs'
import { TEST_GRAPH } from './testGraph.mjs'
import { computeView, expandAll, initialState } from './view.mjs'

const model = buildModel(TEST_GRAPH)
const open = computeView(model, expandAll(model, initialState(model)))

describe('layout (#1463)', () => {
  it('seeds the same positions every time', () => {
    const a = createSim()
    const b = createSim()
    seed(a, model, open, regionHomes(model))
    seed(b, model, open, regionHomes(model))
    expect([...a.pos]).toEqual([...b.pos])
    expect(hash01('x')).toBe(hash01('x'))
    expect(a.pos.size).toBe(open.ids.length)
  })

  it('finds the top-level part of a node', () => {
    expect(regionOf(model, 'collection:venues')).toBe('module:events')
    expect(regionOf(model, 'module:news')).toBe('module:news')
    expect(regionOf(model, 'site:s')).toBeNull()
  })

  it('settles: the speed falls as alpha falls, and nothing becomes NaN', () => {
    const sim = createSim()
    const homes = regionHomes(model)
    seed(sim, model, open, homes)
    let speed = 0
    for (let i = 0; i < 300; i++)
      speed = forceStep(sim, model, open, homes, Math.max(0.02, 1 - i / 300))
    expect(speed).toBeLessThan(1)
    for (const p of sim.pos.values()) expect(Number.isFinite(p.x + p.y)).toBe(true)
  })

  it('keeps a pinned node where it is', () => {
    const sim = createSim()
    const homes = regionHomes(model)
    seed(sim, model, open, homes)
    const pin = sim.pos.get('module:news')
    pin.pinned = true
    const { x, y } = pin
    for (let i = 0; i < 20; i++) forceStep(sim, model, open, homes, 1)
    expect([pin.x, pin.y]).toEqual([x, y])
  })

  it('pushes two nodes on the same spot apart', () => {
    const sim = createSim()
    const homes = regionHomes(model)
    seed(sim, model, open, homes)
    for (const p of sim.pos.values()) Object.assign(p, { x: 0, y: 0 })
    forceStep(sim, model, open, homes, 1)
    const spots = new Set([...sim.pos.values()].map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`))
    expect(spots.size).toBeGreaterThan(1)
  })

  it('draws the mind map with the root in the middle and children on a ring around it', () => {
    const map = mindMap(model, open, 100)
    expect(map.get('site:s')).toEqual({ x: 0, y: 0 })
    const r = (id) => Math.hypot(map.get(id).x, map.get(id).y)
    expect(r('module:events')).toBeCloseTo(100)
    expect(r('collection:venues')).toBeCloseTo(200)
    expect(map.size).toBe(open.ids.length)
  })
})
