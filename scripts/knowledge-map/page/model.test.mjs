import { describe, expect, it } from 'vitest'

import { BUCKET_ID, ancestors, buildModel, moduleOf } from './model.mjs'
import { TEST_GRAPH } from './testGraph.mjs'

describe('buildModel (#1463)', () => {
  const model = buildModel(TEST_GRAPH)

  it('roots the tree at the site and gives every node a container', () => {
    expect(model.root).toBe('site:s')
    for (const node of TEST_GRAPH.nodes) {
      if (node.id !== model.root) expect(model.parent.has(node.id)).toBe(true)
      expect(model.depth.has(node.id)).toBe(true)
    }
  })

  it('puts a note under the part it documents', () => {
    expect(model.parent.get('note:events')).toBe('module:events')
    expect(model.children.get('module:events')).toContain('note:events')
  })

  it('keeps contains edges out of the connections', () => {
    expect(
      model.links.get('module:events').every((l) => model.graph.edges[l.index].type !== 'contains'),
    ).toBe(true)
    expect(model.links.get('collection:venues').map((l) => l.other)).toEqual(['collection:events'])
  })

  it('lists ancestors nearest first, and finds a node’s module', () => {
    expect(ancestors(model, 'collection:venues')).toEqual(['module:events', 'site:s'])
    expect(moduleOf(model, 'screen:/events')).toBe('module:events')
    expect(moduleOf(model, 'note:events')).toBe('module:events')
    expect(moduleOf(model, 'platform-area:ui')).toBeNull()
  })

  it('sends a cycle back to the root instead of looping', () => {
    const cyclic = {
      ...TEST_GRAPH,
      edges: [
        ...TEST_GRAPH.edges,
        {
          from: 'collection:venues',
          to: 'module:events',
          type: 'contains',
          layer: 'structure',
          count: 1,
          via: [],
        },
      ],
    }
    const m = buildModel(cyclic)
    expect(ancestors(m, 'module:events').at(-1)).toBe('site:s')
  })

  it('gathers loose screens and endpoints under the site in one bucket, and only then', () => {
    expect(model.nodes.has(BUCKET_ID)).toBe(false)
    const loose = {
      ...TEST_GRAPH,
      nodes: [
        ...TEST_GRAPH.nodes,
        { ...TEST_GRAPH.nodes[7], id: 'endpoint:x', type: 'endpoint', name: 'GET /x', module: '' },
      ],
      edges: [
        ...TEST_GRAPH.edges,
        {
          from: 'site:s',
          to: 'endpoint:x',
          type: 'contains',
          layer: 'structure',
          count: 1,
          via: [],
        },
      ],
    }
    const m = buildModel(loose)
    expect(m.parent.get('endpoint:x')).toBe(BUCKET_ID)
    expect(m.parent.get(BUCKET_ID)).toBe('site:s')
    expect(m.nodes.get(BUCKET_ID).virtual).toBe(true)
    expect(ancestors(m, 'endpoint:x')).toEqual([BUCKET_ID, 'site:s'])
  })
})
