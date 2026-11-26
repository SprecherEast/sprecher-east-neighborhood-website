import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

import { EDGE_LAYER_RULES, LAYERS, layerOf, vocabulary } from './vocabulary.mjs'

const schema = JSON.parse(fs.readFileSync('docs/knowledge/note-schema.json', 'utf8'))

describe('vocabulary', () => {
  const vocab = vocabulary(schema)

  it('holds every node type of the schema, in its group, and adds only new ones', () => {
    for (const [group, types] of Object.entries(schema.nodeTypes)) {
      for (const key of Object.keys(types)) expect(vocab.nodeTypes[key]).toMatchObject({ group })
    }
    expect(vocab.nodeTypes['page-cluster'].group).toBe('product')
    expect(vocab.nodeTypes.skill.group).toBe('how-we-work')
  })

  it('holds every relationship type of the schema, and adds only new ones', () => {
    const named = [
      ...Object.keys(schema.relationshipTypes.derived),
      ...Object.keys(schema.relationshipTypes.hand),
    ]
    for (const key of named) expect(vocab.edgeTypes[key]).toBeDefined()
    expect(vocab.edgeTypes.references).toBeDefined()
  })

  it('refuses an extra type that the schema already defines', () => {
    const clash = {
      ...schema,
      nodeTypes: { ...schema.nodeTypes, product: { ...schema.nodeTypes.product, library: 'x' } },
    }
    expect(() => vocabulary(clash)).toThrow(/library/)
  })

  it('names each layer once, with a plain sentence', () => {
    const keys = LAYERS.map((layer) => layer.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const layer of LAYERS) expect(layer.what.length).toBeGreaterThan(10)
  })

  it('puts every rule on a layer that exists', () => {
    for (const rule of EDGE_LAYER_RULES) expect(LAYERS.map((l) => l.key)).toContain(rule.layer)
  })
})

describe('layerOf', () => {
  const cases = [
    [{ type: 'contains', fromType: 'module', toType: 'collection' }, 'structure'],
    [{ type: 'uses', fromType: 'module', toType: 'library' }, 'libraries'],
    [{ type: 'renders', fromType: 'screen', toType: 'shared-component' }, 'ui'],
    [{ type: 'writes', fromType: 'mcp-tool', toType: 'collection' }, 'mcp'],
    [{ type: 'exposes', fromType: 'endpoint', toType: 'collection' }, 'api'],
    [{ type: 'reads', fromType: 'job', toType: 'collection' }, 'jobs'],
    [{ type: 'references', fromType: 'collection', toType: 'collection' }, 'data'],
    [{ type: 'reads', fromType: 'module', toType: 'collection' }, 'data'],
    [{ type: 'documents', fromType: 'note', toType: 'module' }, 'docs'],
    [{ type: 'mentions', fromType: 'skill', toType: 'guideline' }, 'skills'],
    [{ type: 'mentions', fromType: 'note', toType: 'note' }, 'docs'],
    [{ type: 'next-step', fromType: 'skill', toType: 'skill' }, 'skills'],
    [{ type: 'mirrors', fromType: 'rule', toType: 'guideline' }, 'rules'],
    [{ type: 'owned-by', fromType: 'subagent', toType: 'role' }, 'agents'],
    [{ type: 'runs', fromType: 'ci-workflow', toType: 'check' }, 'ci'],
    [{ type: 'uses', fromType: 'module', toType: 'platform-area' }, 'code'],
  ]
  it.each(cases)('%j is on layer %s', (edge, layer) => {
    expect(layerOf(edge)).toBe(layer)
  })
})
