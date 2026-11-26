import { describe, expect, it } from 'vitest'

import { buildAreas } from './areas.mjs'

const FILES = [
  'src/modules/demo/README.md',
  'src/modules/demo/cms/demo.ts',
  'src/modules/demo/nav/README.md',
  'src/modules/bare/index.ts',
  'src/platform/ui/README.md',
  'src/platform/ui/Button.tsx',
  'src/platform/lib/getURL.ts',
]

const note = (path, over = {}) => ({
  path,
  name: path,
  type: 'module',
  summary: `about ${path}`,
  aliases: [],
  relationships: [],
  title: '',
  sections: [],
  rules: [],
  watchOuts: [],
  decisions: [],
  links: [],
  names: 3,
  ...over,
})

const NOTES = [
  note('src/modules/demo/README.md', {
    name: 'Demo',
    aliases: ['sample'],
    watchOuts: ['No dark variant.'],
    relationships: [{ type: 'depends-on', target: 'src/platform/lib' }],
    rules: [
      {
        text: 'Only a Google address is stored: `x.test.ts`.',
        tests: ['src/modules/demo/cms/demo.ts'],
      },
    ],
    decisions: ['docs/architecture/decisions/0008-x.md'],
    links: ['src/platform/ui/README.md'],
  }),
  note('src/modules/demo/nav/README.md', { name: 'Demo navigation', type: 'feature' }),
  note('src/platform/ui/README.md', { name: 'UI kit', type: 'platform-area' }),
]
const MAP = [{ source: 'src/modules/demo/README.md', paths: ['src/modules/demo/**'] }]

describe('buildAreas', () => {
  const { nodes, edges, gaps, ownerOf } = buildAreas({
    files: FILES,
    notes: NOTES,
    mapEntries: MAP,
  })
  const byId = (id) => nodes.find((n) => n.id === id)

  it('makes the site, a node for each module and platform area, a feature, and a node for each note', () => {
    expect(nodes.map((n) => n.id).sort()).toEqual([
      'business-rule:src/modules/demo/README.md#1',
      'feature:modules/demo/nav',
      'module:bare',
      'module:demo',
      'note:src/modules/demo/README.md',
      'note:src/modules/demo/nav/README.md',
      'note:src/platform/ui/README.md',
      'platform-area:lib',
      'platform-area:ui',
      'site:sprecher-east',
    ])
  })

  it('gives a module its note path, name, summary, aliases and watch-outs', () => {
    expect(byId('module:demo')).toMatchObject({
      type: 'module',
      name: 'Demo',
      path: 'src/modules/demo/README.md',
      aliases: ['sample'],
      watchOuts: ['No dark variant.'],
      module: 'module:demo',
    })
  })

  it('points a module with no note at its folder', () => {
    expect(byId('module:bare')).toMatchObject({
      path: 'src/modules/bare',
      name: 'bare',
      summary: '',
    })
  })

  it('makes a business rule of each rule in a note, with its tests as links', () => {
    expect(byId('business-rule:src/modules/demo/README.md#1')).toMatchObject({
      type: 'business-rule',
      name: 'Only a Google address is stored',
      path: 'src/modules/demo/cms/demo.ts',
      module: 'module:demo',
      links: ['src/modules/demo/cms/demo.ts'],
    })
  })

  const edge = (from, to, type) =>
    edges.some((e) => e.from === from && e.to === to && e.type === type)

  it('contains modules and areas in the site, and a feature in its module', () => {
    expect(edge('site:sprecher-east', 'module:demo', 'contains')).toBe(true)
    expect(edge('site:sprecher-east', 'platform-area:ui', 'contains')).toBe(true)
    expect(edge('module:demo', 'feature:modules/demo/nav', 'contains')).toBe(true)
    expect(edge('module:demo', 'business-rule:src/modules/demo/README.md#1', 'contains')).toBe(true)
  })

  it('has each note document its subject', () => {
    expect(edge('note:src/modules/demo/README.md', 'module:demo', 'documents')).toBe(true)
    expect(
      edge('note:src/modules/demo/nav/README.md', 'feature:modules/demo/nav', 'documents'),
    ).toBe(true)
  })

  it('leaves what a note writes, links and decides as path targets for the resolver', () => {
    const written = edges.find((e) => e.type === 'depends-on')
    expect(written).toMatchObject({
      from: 'module:demo',
      to: 'path:src/platform/lib',
      written: true,
    })
    expect(edges.find((e) => e.type === 'mentions')).toMatchObject({
      from: 'note:src/modules/demo/README.md',
      to: 'path:src/platform/ui/README.md',
    })
    expect(edges.find((e) => e.type === 'decided-by')).toMatchObject({
      from: 'module:demo',
      to: 'path:docs/architecture/decisions/0008-x.md',
    })
  })

  it('lists a module or area with no note, and a note of an unknown type', () => {
    const odd = buildAreas({
      files: FILES,
      notes: [note('src/modules/demo/README.md', { type: 'thing' })],
      mapEntries: [],
    })
    expect(gaps.map((g) => [g.kind, g.node])).toEqual([
      ['area-no-note', 'module:bare'],
      ['area-no-note', 'platform-area:lib'],
    ])
    expect(odd.gaps.map((g) => g.kind)).toContain('note-type-unknown')
  })

  it('lists a note that names no file or folder', () => {
    const bare = buildAreas({
      files: FILES,
      notes: [note('src/modules/demo/README.md', { names: 0 })],
      mapEntries: [],
    })
    expect(bare.gaps).toContainEqual({
      kind: 'note-names-nothing',
      node: 'note:src/modules/demo/README.md',
      message: 'src/modules/demo/README.md names no file or folder',
    })
  })

  it('says which area a file belongs to, the deepest first', () => {
    expect(ownerOf('src/modules/demo/nav/x.ts')).toEqual({
      id: 'feature:modules/demo/nav',
      top: 'module:demo',
    })
    expect(ownerOf('src/modules/demo/cms/demo.ts')).toEqual({
      id: 'module:demo',
      top: 'module:demo',
    })
    expect(ownerOf('src/platform/lib/getURL.ts')).toEqual({
      id: 'platform-area:lib',
      top: 'platform-area:lib',
    })
    expect(ownerOf('docs/x.md')).toBeNull()
  })
})
