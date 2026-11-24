import { describe, expect, it } from 'vitest'

import { describeMcp, renderMcp, toolNamesByCollection } from './mcpTools.mjs'

function submit() {}
function checkKey() {}
const locate = (fn) =>
  fn === submit
    ? 'src/modules/agents/cms/tools/submit.ts'
    : fn === checkKey
      ? 'src/modules/agents/cms/mcp.ts'
      : 'payload'

const options = {
  collections: {
    events: { enabled: { find: true }, description: 'Published events.' },
    'agent-runs': { enabled: { find: true, create: true, update: true }, description: 'Runs.' },
    posts: { enabled: { find: false } },
  },
  globals: { header: { enabled: true } },
  overrideAuth: checkKey,
  overrideApiKeyCollection: () => ({}),
  mcp: {
    tools: [
      {
        name: 'submitSuggestion',
        description: 'Suggest a draft.',
        parameters: { title: 'shape' },
        handler: submit,
      },
    ],
    serverOptions: { serverInfo: { name: 'Sprecher East', version: '1.0.0' } },
  },
}

const schemaOf = () => ({
  type: 'object',
  properties: {
    title: { type: 'string', description: 'The title.' },
    kind: { type: 'string', enum: ['a', 'b'] },
    long: { type: 'string', maxLength: 200, description: 'Where it goes.' },
    list: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 2 },
    flags: { type: 'array', items: { type: 'string' } },
    note: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    on: { type: ['boolean', 'null'] },
  },
  required: ['title', 'kind'],
})

const access = new Map([
  [
    'events',
    [{ operation: 'read', name: 'publishedOnly', file: 'src/modules/events/cms/events.ts' }],
  ],
  [
    'agent-runs',
    [{ operation: 'create', name: 'isAdminOrAgent', file: 'src/platform/payload/roles.ts' }],
  ],
])

const calls = (file) =>
  file === 'src/modules/agents/cms/tools/submit.ts'
    ? [
        {
          collection: 'events',
          operations: ['create (access checked)', 'read (access bypassed)'],
          why: [{ operation: 'read', text: 'Drafts are hidden from the agent.' }],
        },
      ]
    : []

describe('describeMcp', () => {
  const mcp = describeMcp(options, { locate, access, schemaOf, calls })

  it('names the plugin’s tool for each enabled operation, the way the plugin does', () => {
    expect(mcp.collectionTools.map((t) => [t.name, t.operation, t.target])).toEqual([
      ['findAgentRuns', 'find', 'agent-runs'],
      ['createAgentRuns', 'create', 'agent-runs'],
      ['updateAgentRuns', 'update', 'agent-runs'],
      ['findEvents', 'find', 'events'],
      ['findHeader', 'find', 'header'],
      ['updateHeader', 'update', 'header'],
    ])
  })

  it('leaves out an operation that is switched off, and a type with none on', () => {
    expect(mcp.collectionTools.some((t) => t.target === 'posts')).toBe(false)
  })

  it('gives the access function of the content type for the matching operation', () => {
    const find = mcp.collectionTools.find((t) => t.name === 'findEvents')
    expect(find.access).toEqual({ name: 'publishedOnly', file: 'src/modules/events/cms/events.ts' })
    expect(mcp.collectionTools.find((t) => t.name === 'updateAgentRuns').access).toBeNull()
  })

  it('describes a custom tool: its input, its file and the collections it reaches', () => {
    expect(mcp.customTools).toEqual([
      {
        name: 'submitSuggestion',
        description: 'Suggest a draft.',
        file: 'src/modules/agents/cms/tools/submit.ts',
        input: [
          { name: 'title', type: 'string', required: 'yes', note: 'The title' },
          { name: 'kind', type: 'string', required: 'yes', note: 'one of a, b' },
          {
            name: 'long',
            type: 'string',
            required: 'no',
            note: 'Where it goes; at most 200 characters',
          },
          { name: 'list', type: 'string[]', required: 'no', note: '1 to 2 items' },
          { name: 'flags', type: 'string[]', required: 'no', note: '' },
          { name: 'note', type: 'string or null', required: 'no', note: '' },
          { name: 'on', type: 'boolean or null', required: 'no', note: '' },
        ],
        collections: [
          {
            collection: 'events',
            operations: ['create (access checked)', 'read (access bypassed)'],
            why: [{ operation: 'read', text: 'Drafts are hidden from the agent.' }],
          },
        ],
      },
    ])
  })

  it('names the key check and the server', () => {
    expect(mcp.auth).toEqual({ name: 'checkKey', file: 'src/modules/agents/cms/mcp.ts' })
    expect(mcp.server).toBe('Sprecher East')
  })
})

describe('toolNamesByCollection', () => {
  it('lists, for each content type, the tools that reach it, plugin tools and custom ones', () => {
    const mcp = describeMcp(options, { locate, access, schemaOf, calls })
    expect(toolNamesByCollection(mcp).get('events')).toEqual(['findEvents', 'submitSuggestion'])
    expect(toolNamesByCollection(mcp).get('header')).toEqual(['findHeader', 'updateHeader'])
  })
})

describe('renderMcp', () => {
  const mcp = describeMcp(options, { locate, access, schemaOf, calls })
  const page = renderMcp(mcp)

  it('starts with the title and the generated notice', () => {
    expect(page.startsWith('# AI agent tools (MCP)')).toBe(true)
    expect(page).toContain('Generated by `npm run docs:generate`')
  })

  it('says where a call skips access and why, and says the plugin tools’ input is not shown', () => {
    expect(page).toContain(
      '[`events`](content-types/events.md) (create (access checked), read (access bypassed))',
    )
    expect(page).toContain('- `events`, read, as the code says: Drafts are hidden from the agent.')
    expect(page).toContain('“access checked”, “access bypassed” or “access depends on a value”')
    expect(page).toContain('`updateOne`')
    expect(page).toContain('hooks a write sets off')
    expect(page).toContain('not shown')
    expect(page).toContain('https://payloadcms.com/docs/plugins/mcp')
  })

  it('has a row for each tool and links the endpoint page', () => {
    expect(page).toContain('| `findEvents` |')
    expect(page).toContain('### `submitSuggestion`')
    expect(page).toContain('endpoints.md')
  })

  it('adds exactly one entry when a custom tool is added', () => {
    const more = describeMcp(
      {
        ...options,
        mcp: {
          ...options.mcp,
          tools: [
            ...options.mcp.tools,
            { name: 'other', description: 'x', parameters: {}, handler: submit },
          ],
        },
      },
      { locate, access, schemaOf, calls },
    )
    const count = (text) => text.split('\n').filter((line) => line.startsWith('### ')).length
    expect(count(renderMcp(more)) - count(page)).toBe(1)
  })
})
