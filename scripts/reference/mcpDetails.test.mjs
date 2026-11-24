import { describe, expect, it } from 'vitest'

import { describeMcp, renderMcp, toolNamesByCollection, toolName } from './mcpTools.mjs'

const schemaOf = () => ({ type: 'object', properties: {} })
const entry = (operation, name) => ({ operation, name, file: 'src/a.ts' })

describe('toolName', () => {
  it('joins the operation and the slug in camel case, first letter up', () => {
    expect(toolName('find', 'agent-runs')).toBe('findAgentRuns')
    expect(toolName('update', 'site_settings')).toBe('updateSiteSettings')
    expect(toolName('find', 'a b  c')).toBe('findABC')
    expect(toolName('find', 'events')).toBe('findEvents')
    expect(toolName('find', 'Events')).toBe('findEvents')
    expect(toolName('find', 'trailing-')).toBe('findTrailing')
  })
})

describe('describeMcp details (#1461)', () => {
  const options = {
    collections: { posts: { enabled: true, description: 'Posts.' } },
    globals: { header: { enabled: true } },
  }

  it('picks the access function by the operation each tool does', () => {
    const access = new Map([
      ['posts', ['read', 'create', 'update', 'delete'].map((op) => entry(op, `${op}Fn`))],
      ['header', [entry('read', 'readHeader'), entry('update', 'updateHeader')]],
    ])
    const { collectionTools } = describeMcp(options, { access, schemaOf })
    expect(collectionTools.map((t) => [t.name, t.access?.name])).toEqual([
      ['findPosts', 'readFn'],
      ['createPosts', 'createFn'],
      ['updatePosts', 'updateFn'],
      ['deletePosts', 'deleteFn'],
      ['findHeader', 'readHeader'],
      ['updateHeader', 'updateHeader'],
    ])
  })

  it('says the plugin checks the key when the config sets no check, and `inline` for an anonymous one', () => {
    expect(describeMcp(options, { schemaOf }).auth).toEqual({
      name: 'the plugin’s own key check',
      file: '@payloadcms/plugin-mcp',
    })
    const auth = { auth() {} }.auth
    expect(describeMcp({ ...options, overrideAuth: auth }, { schemaOf }).auth.name).toBe('inline')
  })

  it('writes a file outside `src/` as plain text and one inside as code', () => {
    const mcp = describeMcp(options, {
      access: new Map([
        ['posts', [{ operation: 'read', name: 'fromPlugin', file: '@payloadcms/x' }]],
      ]),
      schemaOf,
    })
    const page = renderMcp(mcp)
    expect(page).toContain('`fromPlugin` in @payloadcms/x |')
    expect(page).toContain('by `the plugin’s own key check` in @payloadcms/plugin-mcp.')
    const own = renderMcp({ ...mcp, auth: { name: 'checkKey', file: 'src/a/mcp.ts' } })
    expect(own).toContain('by `checkKey` in `src/a/mcp.ts`.')
  })

  it('lists the tools that reach each type sorted, once each', () => {
    const tool = (name, ...collections) => ({
      name,
      collections: collections.map((collection) => ({ collection })),
    })
    const found = toolNamesByCollection({
      collectionTools: [
        { target: 'posts', name: 'updatePosts' },
        { target: 'posts', name: 'findPosts' },
      ],
      customTools: [tool('zTool', 'posts', 'posts'), tool('aTool', 'posts')],
    })
    expect(found.get('posts')).toEqual(['aTool', 'findPosts', 'updatePosts', 'zTool'])
  })
})
