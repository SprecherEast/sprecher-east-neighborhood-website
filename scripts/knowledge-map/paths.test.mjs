import { describe, expect, it } from 'vitest'

import { makeEdge, makeNode } from './graph.mjs'
import { resolvePathTargets } from './paths.mjs'

const node = (id, type, path, extra = {}) => makeNode({ id, type, name: id, path, ...extra })

const nodes = [
  node('module:demo', 'module', 'src/modules/demo/README.md'),
  node('note:demo', 'note', 'src/modules/demo/README.md'),
  node('decision:8', 'decision', 'docs/architecture/decisions/0008-x.md'),
  node('collection:pages', 'collection', 'src/modules/site/cms/pages.ts', {
    links: ['docs/reference/content-types/pages.md'],
  }),
  node('global:header', 'global', 'src/modules/site/cms/navGlobal.ts'),
  node('global:footer', 'global', 'src/modules/site/cms/navGlobal.ts'),
  node('platform-area:lib', 'platform-area', 'src/platform/lib'),
]
const edge = (to, over = {}) =>
  makeEdge({ from: 'note:demo', to: `path:${to}`, type: 'mentions', ...over })
const resolved = (edges) => resolvePathTargets([{ nodes, edges }])[0].edges.map((e) => e.to)

describe('resolvePathTargets', () => {
  it('turns a link to a document into that document node', () => {
    expect(resolved([edge('docs/architecture/decisions/0008-x.md')])).toEqual(['decision:8'])
  })

  it('turns a link to a generated page into the node that page describes', () => {
    expect(resolved([edge('docs/reference/content-types/pages.md')])).toEqual(['collection:pages'])
  })

  it('drops a link that names no node, and a link to a file shared by several non-document nodes', () => {
    expect(resolved([edge('src/app/x.ts'), edge('src/modules/site/cms/navGlobal.ts')])).toEqual([])
  })

  it('reads a written target as a note first, then a folder, preferring the module over its note', () => {
    const written = (to) => edge(to, { type: 'depends-on', written: true })
    expect(resolved([written('src/modules/demo/README.md')])).toEqual(['module:demo'])
    expect(resolved([written('src/platform/lib')])).toEqual(['platform-area:lib'])
    expect(resolved([written('src/modules/demo')])).toEqual(['module:demo'])
  })

  it('keeps a written target it cannot resolve, so the graph lists it as a gap', () => {
    const written = edge('src/nowhere', { type: 'depends-on', written: true })
    expect(resolved([written])).toEqual(['path:src/nowhere'])
  })

  it('leaves an edge that already names a node alone', () => {
    expect(
      resolved([makeEdge({ from: 'note:demo', to: 'module:demo', type: 'documents' })]),
    ).toEqual(['module:demo'])
  })
})
