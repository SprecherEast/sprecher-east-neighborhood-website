import { describe, expect, it } from 'vitest'

import { buildTools, edgeTypeOf } from './tools.mjs'

const mcp = {
  auth: { name: 'checkAgentKey', file: 'src/modules/agents/cms/mcp.ts' },
  collectionTools: [
    {
      name: 'findEvents',
      operation: 'find',
      target: 'events',
      description: 'Published events.',
      access: {
        name: 'authenticatedOrPublished',
        file: 'src/platform/payload/authenticatedOrPublished.ts',
      },
    },
    {
      name: 'createAgentRuns',
      operation: 'create',
      target: 'agent-runs',
      description: 'Your run history.',
      access: { name: 'isAdminOrAgent', file: 'src/modules/agents/cms/agentRuns.ts' },
    },
  ],
  customTools: [
    {
      name: 'submitSuggestion',
      description: 'Suggest an event or a post.',
      file: 'src/modules/agents/cms/tools/submitSuggestion.ts',
      input: [{ name: 'title', type: 'string', required: 'yes', note: '1 to 60 characters' }],
      collections: [
        {
          collection: 'events',
          operations: ['create (access checked)', 'read (access bypassed)'],
          why: [],
        },
        { collection: 'categories', operations: ['read (access checked)'], why: [] },
        { collection: 'ghost', operations: ['read (access checked)'], why: [] },
      ],
    },
  ],
}
const contentTypeIds = ['collection:events', 'collection:agent-runs', 'collection:categories']

describe('buildTools', () => {
  const { nodes, edges, gaps } = buildTools({
    mcp,
    contentTypeIds,
    holderId: 'module:agents',
    endpointId: 'endpoint:mcp:/api/mcp',
  })
  const byId = (id) => nodes.find((n) => n.id === id)
  const edge = (from, to, type) =>
    edges.find((e) => e.from === from && e.to === to && e.type === type)

  it('makes a node of each tool, a plugin-made one at the AI agent setup file', () => {
    expect(byId('mcp-tool:findEvents')).toMatchObject({
      type: 'mcp-tool',
      path: 'src/modules/agents/cms/mcp.ts',
      module: 'module:agents',
      summary: 'Published events.',
    })
    expect(byId('mcp-tool:submitSuggestion')).toMatchObject({
      path: 'src/modules/agents/cms/tools/submitSuggestion.ts',
    })
  })

  it('lists the inputs of a tool as its fields', () => {
    expect(byId('mcp-tool:submitSuggestion').fields).toEqual([
      { name: 'title', type: 'string', required: true, detail: '1 to 60 characters', notes: [] },
    ])
  })

  it('names the access function behind a content-type tool', () => {
    expect(byId('mcp-tool:findEvents').facts).toContainEqual({
      label: 'Access function',
      value: 'authenticatedOrPublished (src/platform/payload/authenticatedOrPublished.ts)',
    })
  })

  it('has a tool read or write the content types it reaches, with the access it gets', () => {
    expect(edge('mcp-tool:findEvents', 'collection:events', 'reads')).toBeDefined()
    expect(edge('mcp-tool:createAgentRuns', 'collection:agent-runs', 'writes')).toBeDefined()
    expect(edge('mcp-tool:submitSuggestion', 'collection:events', 'writes')).toMatchObject({
      via: ['create (access checked)'],
    })
    expect(edge('mcp-tool:submitSuggestion', 'collection:events', 'reads')).toMatchObject({
      via: ['read (access bypassed)'],
    })
  })

  it('has the endpoint expose each tool, and the module hold it', () => {
    expect(edge('endpoint:mcp:/api/mcp', 'mcp-tool:findEvents', 'exposes')).toBeDefined()
    expect(edge('module:agents', 'mcp-tool:findEvents', 'contains')).toBeDefined()
  })

  it('lists a reach to something that is not a content type as a gap', () => {
    expect(gaps).toEqual([
      {
        kind: 'reference-target-missing',
        node: 'mcp-tool:submitSuggestion',
        message: 'reaches "ghost", which is not a content type',
      },
    ])
  })
})

describe('edgeTypeOf', () => {
  it('reads, writes, or only uses when the operation is not shown', () => {
    expect(['find', 'read', 'count'].map(edgeTypeOf)).toEqual(['reads', 'reads', 'reads'])
    expect(['create', 'update', 'delete'].map(edgeTypeOf)).toEqual(['writes', 'writes', 'writes'])
    expect(edgeTypeOf('operation')).toBe('uses')
  })
})
