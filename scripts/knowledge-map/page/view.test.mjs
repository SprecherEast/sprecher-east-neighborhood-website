import { describe, expect, it } from 'vitest'

import { buildModel } from './model.mjs'
import { TEST_GRAPH } from './testGraph.mjs'
import {
  INITIAL_LAYERS,
  collapseAll,
  computeView,
  expandAll,
  flip,
  initialState,
  reveal,
  startState,
  toggle,
} from './view.mjs'

const model = buildModel(TEST_GRAPH)
const ids = (view) => [...view.ids].sort()

describe('computeView (#1463)', () => {
  it('opens on the overview: the site and what it holds', () => {
    const view = computeView(model, initialState(model))
    expect(ids(view)).toEqual(['module:events', 'module:news', 'platform-area:ui', 'site:s'])
  })

  it('draws a connection to the nearest shown container, merged by layer', () => {
    const view = computeView(model, initialState(model))
    const code = view.edges.find((e) => e.layer === 'code')
    expect([code.from, code.to]).toEqual(['module:events', 'platform-area:ui'])
    const data = view.edges.find((e) => e.layer === 'data')
    expect([data.from, data.to]).toEqual(['module:news', 'module:events'])
  })

  it('drops a line whose two ends fall on the same node', () => {
    const view = computeView(model, initialState(model))
    expect(view.edges.some((e) => e.from === e.to)).toBe(false)
    expect(view.edges.some((e) => e.layer === 'data' && e.from === 'module:events')).toBe(false)
  })

  it('shows the inside of an expanded module with its own lines', () => {
    const view = computeView(model, toggle(initialState(model), 'module:events'))
    expect(view.shown.has('collection:venues')).toBe(true)
    expect(
      view.edges.some(
        (e) => e.layer === 'data' && e.from === 'collection:events' && e.to === 'collection:venues',
      ),
    ).toBe(true)
  })

  it('hides a layer, and keeps its other lines', () => {
    const view = computeView(model, flip(initialState(model), 'hiddenLayers', 'structure'))
    expect(view.edges.some((e) => e.layer === 'structure')).toBe(false)
    expect(view.edges.some((e) => e.layer === 'data')).toBe(true)
  })

  it('hides a module and what is in it', () => {
    const open = expandAll(model, initialState(model))
    const view = computeView(model, flip(open, 'hiddenModules', 'module:events'))
    expect(view.shown.has('collection:venues')).toBe(false)
    expect(view.shown.has('collection:posts')).toBe(true)
  })

  it('shows one module alone', () => {
    const open = expandAll(model, initialState(model))
    const view = computeView(model, { ...open, solo: 'module:news' })
    expect(ids(view)).toEqual(['collection:posts', 'module:news', 'site:s'])
  })

  it('hides a type but keeps what sits below it', () => {
    const open = expandAll(model, initialState(model))
    const view = computeView(model, flip(open, 'hiddenTypes', 'collection'))
    expect(view.shown.has('collection:posts')).toBe(false)
    expect(view.shown.has('screen:/events')).toBe(true)
  })

  it('reveals a node by opening what is above it, and collapses back to the overview', () => {
    const state = reveal(model, initialState(model), 'screen:/events')
    expect(computeView(model, state).shown.has('screen:/events')).toBe(true)
    expect(collapseAll(model, state).expanded).toEqual(new Set(['site:s']))
  })

  it('opens with only the starting layers on', () => {
    const state = startState(model)
    expect([...state.hiddenLayers]).toEqual(['docs'])
    expect(INITIAL_LAYERS).toContain('structure')
    expect(computeView(model, state).edges.some((e) => e.layer === 'docs')).toBe(false)
  })
})
