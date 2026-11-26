import { describe, expect, it } from 'vitest'

import { buildModel } from './model.mjs'
import { shortestPath } from './path.mjs'
import { TEST_GRAPH } from './testGraph.mjs'
import { initialState } from './view.mjs'

const model = buildModel(TEST_GRAPH)
const state = initialState(model)

describe('shortestPath (#1463)', () => {
  it('follows a connection in either direction', () => {
    expect(shortestPath(model, state, 'collection:venues', 'collection:events')).toEqual([
      'collection:venues',
      'collection:events',
    ])
    expect(shortestPath(model, state, 'collection:posts', 'collection:venues')).toEqual([
      'collection:posts',
      'collection:events',
      'collection:venues',
    ])
  })

  it('uses the containment tree too, unless the structure layer is off', () => {
    expect(shortestPath(model, state, 'module:news', 'platform-area:ui')).toEqual([
      'module:news',
      'site:s',
      'platform-area:ui',
    ])
    const off = { ...state, hiddenLayers: new Set(['structure']) }
    expect(shortestPath(model, off, 'module:news', 'platform-area:ui')).toBeNull()
  })

  it('respects a layer that is switched off', () => {
    const off = { ...state, hiddenLayers: new Set(['data']) }
    const route = shortestPath(model, off, 'collection:venues', 'collection:events')
    expect(route).toEqual(['collection:venues', 'module:events', 'collection:events'])
  })

  it('handles the same node and an unknown one', () => {
    expect(shortestPath(model, state, 'module:news', 'module:news')).toEqual(['module:news'])
    expect(shortestPath(model, state, 'module:news', 'nope')).toBeNull()
  })
})
