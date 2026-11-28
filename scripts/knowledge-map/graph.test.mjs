import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

import { assemble, makeEdge, makeNode, nodeId } from './graph.mjs'
import { vocabulary } from './vocabulary.mjs'

const vocab = vocabulary(JSON.parse(fs.readFileSync('docs/knowledge/note-schema.json', 'utf8')))
const exists = (file) => ['a.ts', 'b.ts', 'c.md'].includes(file)

const mod = (name, path = 'a.ts') =>
  makeNode({ id: nodeId('module', name), type: 'module', name, path })
const col = (name, path = 'b.ts') =>
  makeNode({ id: nodeId('collection', name), type: 'collection', name, path })

describe('makeNode and makeEdge', () => {
  it('fills the defaults so every node has the same fields in the same order', () => {
    const node = makeNode({ id: 'module:x', type: 'module', name: 'X', path: 'a.ts' })
    expect(Object.keys(node)).toEqual([
      'id',
      'type',
      'name',
      'summary',
      'path',
      'module',
      'aliases',
      'fields',
      'facts',
      'watchOuts',
      'links',
    ])
    expect(node.fields).toEqual([])
  })

  it('refuses a node with no id, type, name or path', () => {
    expect(() => makeNode({ type: 'module', name: 'X', path: 'a.ts' })).toThrow(/id/)
    expect(() => makeNode({ id: 'm', name: 'X', path: 'a.ts' })).toThrow(/type/)
    expect(() => makeNode({ id: 'm', type: 'module', path: 'a.ts' })).toThrow(/name/)
    expect(() => makeNode({ id: 'm', type: 'module', name: 'X' })).toThrow(/path/)
  })

  it('builds an edge with a count of one', () => {
    expect(makeEdge({ from: 'a', to: 'b', type: 'uses' })).toEqual({
      from: 'a',
      to: 'b',
      type: 'uses',
      count: 1,
      via: [],
    })
  })
})

const site = makeNode({ id: 'site:s', type: 'site', name: 'S', path: 'c.md' })
const contain = (to, from = 'site:s') => makeEdge({ from, to, type: 'contains' })
/** A part holding the site and a `contains` edge from it to each given node, so each has a place. */
const placed = (...ids) => ({ nodes: [site], edges: ids.map((id) => contain(id)) })

describe('assemble', () => {
  const run = (parts) => assemble(parts, { exists, vocab })

  it('sorts nodes by id and edges by from, to and type, whatever the order given', () => {
    const forward = run([
      placed('module:a', 'module:b', 'collection:z'),
      {
        nodes: [mod('b'), mod('a'), col('z')],
        edges: [
          makeEdge({ from: 'module:b', to: 'collection:z', type: 'writes' }),
          makeEdge({ from: 'module:a', to: 'collection:z', type: 'reads' }),
        ],
      },
    ])
    const backward = run([
      placed('module:a', 'module:b', 'collection:z'),
      {
        nodes: [col('z')],
        edges: [makeEdge({ from: 'module:a', to: 'collection:z', type: 'reads' })],
      },
      {
        nodes: [mod('a'), mod('b')],
        edges: [makeEdge({ from: 'module:b', to: 'collection:z', type: 'writes' })],
      },
    ])
    expect(forward.graph.nodes.map((n) => n.id)).toEqual([
      'collection:z',
      'module:a',
      'module:b',
      'site:s',
    ])
    expect(forward.graph).toEqual(backward.graph)
  })

  it('gives each edge the layer its type and ends call for', () => {
    const { graph } = run([
      placed('module:a', 'collection:z'),
      {
        nodes: [mod('a'), col('z')],
        edges: [makeEdge({ from: 'module:a', to: 'collection:z', type: 'reads' })],
      },
    ])
    expect(graph.edges.find((e) => e.type === 'reads')).toMatchObject({ layer: 'data' })
  })

  it('adds up the count and joins the reasons of a repeated edge', () => {
    const { graph } = run([
      placed('module:a', 'collection:z'),
      {
        nodes: [mod('a'), col('z')],
        edges: [
          makeEdge({ from: 'module:a', to: 'collection:z', type: 'reads', via: ['x'] }),
          makeEdge({
            from: 'module:a',
            to: 'collection:z',
            type: 'reads',
            count: 2,
            via: ['y', 'x'],
          }),
        ],
      },
    ])
    const reads = graph.edges.filter((e) => e.type === 'reads')
    expect(reads).toHaveLength(1)
    expect(reads[0]).toMatchObject({ count: 3, via: ['x', 'y'] })
  })

  it('sorts and dedupes the reasons of an edge seen once', () => {
    const { graph } = run([
      placed('module:a', 'collection:z'),
      {
        nodes: [mod('a'), col('z')],
        edges: [
          makeEdge({ from: 'module:a', to: 'collection:z', type: 'reads', via: ['y', 'x', 'y'] }),
        ],
      },
    ])
    expect(graph.edges.find((e) => e.type === 'reads').via).toEqual(['x', 'y'])
  })

  it('fails with the node and the path when a node path does not exist', () => {
    const { errors } = run([placed('module:a'), { nodes: [mod('a', 'missing.ts')], edges: [] }])
    expect(errors).toEqual([
      { rule: 'NODE-PATH', node: 'module:a', message: 'path "missing.ts" does not exist' },
    ])
  })

  it('fails on two nodes with one id, an unknown node type and an unknown relationship type', () => {
    const odd = makeNode({ id: 'thing:x', type: 'thing', name: 'x', path: 'a.ts' })
    const { errors } = run([
      placed('module:a', 'thing:x'),
      {
        nodes: [mod('a'), mod('a'), odd],
        edges: [makeEdge({ from: 'module:a', to: 'module:a', type: 'bogus' })],
      },
    ])
    expect(errors.map((e) => e.rule).sort()).toEqual(['EDGE-TYPE', 'NODE-DUPLICATE', 'NODE-TYPE'])
  })

  it('fails on a derived edge to a node that is missing, and only lists a written one as a gap', () => {
    const { errors, graph } = run([
      placed('module:a'),
      {
        nodes: [mod('a')],
        edges: [
          makeEdge({ from: 'module:a', to: 'module:gone', type: 'uses' }),
          {
            ...makeEdge({ from: 'module:a', to: 'module:gone2', type: 'depends-on' }),
            written: true,
          },
        ],
      },
    ])
    expect(errors).toEqual([
      { rule: 'EDGE-TARGET', node: 'module:a', message: 'uses "module:gone", which is not a node' },
    ])
    expect(graph.gaps).toEqual([
      {
        kind: 'relationship-target-missing',
        node: 'module:a',
        message: 'depends-on "module:gone2", which is not a node',
      },
    ])
    expect(graph.edges.map((e) => e.type)).toEqual(['contains'])
  })

  it('keeps the gaps of the parts, sorted', () => {
    const { graph } = run([
      placed('module:a'),
      { nodes: [mod('a')], edges: [], gaps: [{ kind: 'b-gap', node: 'module:a', message: 'm' }] },
      { nodes: [], edges: [], gaps: [{ kind: 'a-gap', node: 'module:a', message: 'm' }] },
    ])
    expect(graph.gaps.map((g) => g.kind)).toEqual(['a-gap', 'b-gap'])
  })

  it('carries the vocabulary the page needs for its legend, with the types actually used', () => {
    const { graph } = run([
      placed('module:a', 'collection:z'),
      {
        nodes: [mod('a'), col('z')],
        edges: [makeEdge({ from: 'module:a', to: 'collection:z', type: 'reads' })],
      },
    ])
    expect(graph.nodeTypes.module).toMatchObject({ group: 'product' })
    expect(graph.edgeTypes.reads.layers).toEqual(['data'])
    expect(graph.layers.map((l) => l.key)).toContain('data')
    expect(graph.version).toBe(1)
  })

  it('fails, naming the node, when a node other than the site has no contains parent', () => {
    const { errors } = run([placed('module:a'), { nodes: [mod('a'), col('z')], edges: [] }])
    expect(errors).toEqual([
      { rule: 'NODE-PARENT', node: 'collection:z', message: 'has no parent: nothing contains it' },
    ])
  })

  it('fails, naming the node, when a node has two contains parents', () => {
    const { errors } = run([
      placed('module:a', 'collection:z'),
      { nodes: [mod('a'), col('z')], edges: [contain('collection:z', 'module:a')] },
    ])
    expect(errors).toEqual([
      {
        rule: 'NODE-PARENT',
        node: 'collection:z',
        message: 'has 2 parents: module:a, site:s',
      },
    ])
  })

  it('needs no parent for the site itself, and counts only contains edges as a place', () => {
    const { errors } = run([
      placed('module:a'),
      {
        nodes: [mod('a'), col('z')],
        edges: [makeEdge({ from: 'module:a', to: 'collection:z', type: 'reads' })],
      },
    ])
    expect(errors.map((e) => e.node)).toEqual(['collection:z'])
  })
})
