import { describe, expect, it } from 'vitest'

import { describeApi, renderApi } from './endpoints.mjs'

function checkKey() {}
function maskVerify() {}
function seoHandler() {}
function mcpHandler() {}
const locate = (fn) =>
  ({
    [checkKey]: 'src/modules/agents/cms/mcp.ts',
    [maskVerify]: 'src/modules/accounts/cms/noVerifyMutation.ts',
    [seoHandler]: '@payloadcms/plugin-seo',
    [mcpHandler]: '@payloadcms/plugin-mcp',
  })[fn] ?? 'payload'

const base = {
  routes: { api: '/api', graphQL: '/graphql', graphQLPlayground: '/graphql-playground' },
  graphQL: {
    disableIntrospectionInProduction: true,
    disablePlaygroundInProduction: true,
    maxComplexity: 1000,
    rules: [maskVerify],
  },
  endpoints: [
    { method: 'post', path: '/plugin-seo/generate-title', handler: seoHandler },
    { method: 'post', path: '/mcp', handler: mcpHandler },
    { method: 'get', path: '/mcp', handler: mcpHandler },
  ],
  contentTypes: [
    {
      slug: 'events',
      kind: 'collection',
      rest: true,
      graphQL: true,
      endpoints: [{ method: 'POST', path: '/verify/:token', name: 'verify', file: 'src/v.ts' }],
      allEndpoints: [
        { method: 'GET', path: '/count', name: 'countHandler', file: 'payload' },
        { method: 'POST', path: '/login', name: 'loginHandler', file: 'payload' },
        { method: 'POST', path: '/verify/:token', name: 'verify', file: 'src/v.ts' },
      ],
    },
    {
      slug: 'faq',
      kind: 'collection',
      rest: true,
      graphQL: true,
      endpoints: [],
      allEndpoints: [{ method: 'GET', path: '/count', name: 'countHandler', file: 'payload' }],
    },
    { slug: 'header', kind: 'global', rest: true, graphQL: true, endpoints: [], allEndpoints: [] },
    {
      slug: 'agent-runs',
      kind: 'collection',
      rest: false,
      graphQL: false,
      endpoints: [],
      allEndpoints: [],
    },
  ],
  adminPages: [{ url: '/admin/[[...segments]]', file: 'src/app/(payload)/admin/page.tsx' }],
  serverActions: [
    { file: 'src/modules/accounts/actions.ts', name: 'signIn', area: 'module `accounts`' },
  ],
  routeHandlers: [
    { url: '/api/version', methods: ['GET'], file: 'src/app/(frontend)/api/version/route.ts' },
    {
      url: '/api/[...slug]',
      methods: ['GET', 'POST'],
      file: 'src/app/(payload)/api/[...slug]/route.ts',
    },
  ],
  mcpAuth: { name: 'checkKey', file: 'src/modules/agents/cms/mcp.ts' },
}

describe('describeApi', () => {
  const api = describeApi(base, locate)

  it('reads the REST path of each content type, and that one is switched off', () => {
    expect(api.rest).toEqual([
      { slug: 'agent-runs', kind: 'collection', path: '', enabled: false, graphQL: false },
      { slug: 'events', kind: 'collection', path: '/api/events', enabled: true, graphQL: true },
      { slug: 'faq', kind: 'collection', path: '/api/faq', enabled: true, graphQL: true },
      {
        slug: 'header',
        kind: 'global',
        path: '/api/globals/header',
        enabled: true,
        graphQL: true,
      },
    ])
  })

  it('reads the GraphQL paths, its limits and the validation rules with their files', () => {
    expect(api.graphQL).toEqual({
      path: '/api/graphql',
      playground: '/api/graphql-playground',
      settings: [
        ['disableIntrospectionInProduction', 'true'],
        ['disablePlaygroundInProduction', 'true'],
        ['maxComplexity', '1000'],
      ],
      rules: [{ name: 'maskVerify', file: 'src/modules/accounts/cms/noVerifyMutation.ts' }],
    })
  })

  it('lists custom endpoints from the config and from each content type, with their files', () => {
    expect(api.custom.map((e) => [e.owner, e.method, e.path, e.file])).toEqual([
      ['config', 'POST', '/api/plugin-seo/generate-title', '@payloadcms/plugin-seo'],
      ['config', 'POST', '/api/mcp', '@payloadcms/plugin-mcp'],
      ['config', 'GET', '/api/mcp', '@payloadcms/plugin-mcp'],
      ['events', 'POST', '/api/events/verify/:token', 'src/v.ts'],
    ])
  })

  it('groups the routes Payload adds by method and path, with the types that have each', () => {
    expect(api.builtIn).toEqual([
      {
        method: 'GET',
        path: '/count',
        types: ['events', 'faq'],
        scope: 'every collection except `agent-runs`',
      },
      { method: 'POST', path: '/login', types: ['events'], scope: '' },
    ])
  })

  it('says every collection when all of them have a route', () => {
    const everyone = base.contentTypes.map((type) =>
      type.kind === 'collection'
        ? { ...type, allEndpoints: [{ method: 'GET', path: '/count', name: 'c', file: 'payload' }] }
        : type,
    )
    const built = describeApi({ ...base, contentTypes: everyone }, locate).builtIn
    expect(built).toEqual([
      {
        method: 'GET',
        path: '/count',
        types: ['agent-runs', 'events', 'faq'],
        scope: 'every collection',
      },
    ])
  })

  it('lists the types instead when a summary would hide some of them', () => {
    const mixed = base.contentTypes.map((type) =>
      ['events', 'header'].includes(type.slug)
        ? {
            ...type,
            allEndpoints: [{ method: 'GET', path: '/versions', name: 'v', file: 'payload' }],
          }
        : type,
    )
    const row = describeApi({ ...base, contentTypes: mixed }, locate).builtIn.find(
      (entry) => entry.path === '/versions',
    )
    expect(row.types).toEqual(['events', 'header'])
    expect(row.scope).toBe('')
  })

  it('lists the admin pages and the server actions', () => {
    expect(api.adminPages).toEqual(base.adminPages)
    expect(api.serverActions).toEqual(base.serverActions)
  })

  it('names the access check only where the config states it: the MCP endpoint', () => {
    const guards = api.custom.map((e) => e.guard)
    expect(guards).toEqual(['', '`checkKey`', '`checkKey`', ''])
  })
})

describe('renderApi', () => {
  const page = renderApi(describeApi(base, locate))

  it('starts with the title and the generated notice', () => {
    expect(page.startsWith('# Endpoints')).toBe(true)
    expect(page).toContain('Generated by `npm run docs:generate`')
  })

  it('links the content type pages, the tools page and the jobs page', () => {
    expect(page).toContain('[`events`](content-types/events.md)')
    expect(page).toContain('mcp-tools.md')
    expect(page).toContain('routes.md')
  })

  it('has one row for each custom endpoint, so a new endpoint adds exactly one', () => {
    const more = describeApi(
      {
        ...base,
        contentTypes: [
          {
            ...base.contentTypes[0],
            endpoints: [
              ...base.contentTypes[0].endpoints,
              { method: 'GET', path: '/new', name: 'n', file: 'src/n.ts' },
            ],
          },
          ...base.contentTypes.slice(1),
        ],
      },
      locate,
    )
    const rows = (text) => text.split('\n').filter((line) => line.includes('/api/events/')).length
    expect(rows(renderApi(more)) - rows(page)).toBe(1)
  })

  it('has a row for each server action and says what it does not show', () => {
    expect(page).toContain('| module `accounts` | `signIn` |')
    expect(page).toContain('Not shown')
  })

  it('shows the Payload routes, the admin pages and where GraphQL is off', () => {
    expect(page).toContain('| GET | `/count` |')
    expect(page).toContain('`/admin/[[...segments]]`')
    expect(page).toContain('| collection | REST switched off | off |')
  })

  it('says the route files are listed with their methods', () => {
    expect(page).toContain('| `/api/[...slug]` | GET, POST |')
  })
})
