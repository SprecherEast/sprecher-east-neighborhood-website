import { describe, expect, it } from 'vitest'

import { FILES, inputs } from './fixture.mjs'
import { scanGraph } from './scan.mjs'

describe('scanGraph', () => {
  const { graph, errors } = scanGraph(inputs())
  const ids = graph.nodes.map((n) => n.id)
  const edge = (from, to, type) =>
    graph.edges.find((e) => e.from === from && e.to === to && e.type === type)

  it('finds no error in a repository whose paths all exist', () => {
    expect(errors).toEqual([])
  })

  it('has a node of every kind the inputs hold', () => {
    for (const id of [
      'site:sprecher-east',
      'module:events',
      'platform-area:ui',
      'note:src/modules/events/README.md',
      'business-rule:src/modules/events/README.md#1',
      'collection:events',
      'collection:media',
      'screen:/events/[slug]',
      'page-cluster:/events',
      'endpoint:rest:/api/events',
      'endpoint:graphql:/api/graphql',
      'mcp-tool:findEvents',
      'shared-component:Button',
      'library:zod',
      'skill:wrapped',
      'decision:0001-start',
      'ci-workflow:lint',
      'check:lint#eslint',
      'scheduled-task:weekday-scout',
      'scheduled-task:server-cron-install-cron',
    ]) {
      expect(ids).toContain(id)
    }
  })

  it('has a node for every note in the map, once', () => {
    expect(ids.filter((id) => id.startsWith('note:'))).toEqual([
      'note:src/modules/events/README.md',
      'note:src/platform/ui/README.md',
    ])
  })

  it('draws the connections between them', () => {
    expect(edge('collection:events', 'collection:media', 'references')).toMatchObject({
      layer: 'data',
    })
    expect(edge('module:events', 'platform-area:ui', 'depends-on')).toMatchObject({ layer: 'code' })
    expect(edge('mcp-tool:findEvents', 'collection:events', 'reads')).toMatchObject({
      layer: 'mcp',
    })
    expect(edge('endpoint:rest:/api/events', 'collection:events', 'exposes')).toMatchObject({
      layer: 'api',
    })
    expect(edge('module:events', 'decision:0001-start', 'decided-by')).toMatchObject({
      layer: 'docs',
    })
    expect(edge('note:src/modules/events/README.md', 'collection:events', 'mentions')).toBeDefined()
    expect(edge('module:events', 'library:zod', 'uses')).toMatchObject({ layer: 'libraries' })
    expect(edge('module:events', 'shared-component:Button', 'uses')).toBeDefined()
    expect(edge('skill:wrapped', 'path:AGENTS.md', 'mentions')).toBeUndefined()
  })

  it('gives every node a path that exists in the repository', () => {
    for (const node of graph.nodes) {
      expect(FILES.some((f) => f === node.path || f.startsWith(`${node.path}/`))).toBe(true)
    }
  })

  it('lists a map entry whose note file is missing as a gap, not dropping it silently', () => {
    const lost = inputs()
    lost.files = lost.files.filter((f) => f !== 'src/platform/ui/README.md')
    const { graph: partial } = scanGraph(lost)
    expect(partial.gaps).toContainEqual({
      kind: 'map-note-missing',
      node: 'site:sprecher-east',
      message: 'docs/knowledge/map.json lists src/platform/ui/README.md, which does not exist',
    })
    expect(partial.nodes.map((n) => n.id)).not.toContain('note:src/platform/ui/README.md')
  })

  it('is the same graph whatever order the files and notes come in', () => {
    const shuffled = inputs()
    shuffled.files = [...shuffled.files].reverse()
    expect(scanGraph(shuffled).graph).toEqual(graph)
  })

  it('fails with the node and path when a node path is missing from the files', () => {
    const broken = inputs()
    broken.files = broken.files.filter((f) => f !== 'src/platform/ui/Button.tsx')
    const { errors: found } = scanGraph(broken)
    expect(found).toContainEqual({
      rule: 'NODE-PATH',
      node: 'shared-component:Button',
      message: 'path "src/platform/ui/Button.tsx" does not exist',
    })
  })
})
