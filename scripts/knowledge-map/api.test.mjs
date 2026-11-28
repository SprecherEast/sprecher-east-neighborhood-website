import { describe, expect, it } from 'vitest'

import { buildApi } from './api.mjs'

const CATCH_ALL = 'src/app/(payload)/api/[...slug]/route.ts'
const api = {
  rest: [
    { slug: 'events', kind: 'collection', path: '/api/events', enabled: true, graphQL: true },
    { slug: 'header', kind: 'global', path: '/api/globals/header', enabled: true, graphQL: true },
    {
      slug: 'payload-migrations',
      kind: 'collection',
      path: '/api/payload-migrations',
      enabled: false,
      graphQL: false,
    },
  ],
  graphQL: { path: '/api/graphql', playground: '/api/graphql-playground' },
  custom: [
    {
      owner: 'email-confirmations',
      method: 'POST',
      path: '/api/email-confirmations/confirm',
      name: 'inline',
      file: 'src/modules/verification/cms/confirmEndpoint.ts',
      guard: 'isHuman',
    },
    {
      owner: 'search',
      method: 'POST',
      path: '/api/search/reindex',
      name: 'inline',
      file: '@payloadcms/plugin-search',
      guard: '',
    },
  ],
  routeHandlers: [
    { url: '/api/[...slug]', file: CATCH_ALL, methods: ['GET', 'POST'] },
    { url: '/api/graphql', file: 'src/app/(payload)/api/graphql/route.ts', methods: ['POST'] },
    { url: '/api/version', file: 'src/app/(frontend)/api/version/route.ts', methods: ['GET'] },
  ],
  serverActions: [
    { file: 'src/modules/accounts/actions.ts', name: 'addPasskey', area: 'module `accounts`' },
  ],
  appFiles: [
    { url: '/robots.txt', file: 'src/app/robots.ts', generated: true, readsContent: false },
  ],
  mcp: { path: '/api/mcp', auth: { name: 'checkAgentKey', file: 'src/modules/agents/cms/mcp.ts' } },
}

const contentTypes = [
  {
    id: 'collection:events',
    path: 'src/modules/events/cms/events.ts',
    module: 'module:events',
    facts: [{ label: 'GraphQL', value: 'yes' }],
  },
  {
    id: 'global:header',
    path: 'src/modules/site/cms/navGlobal.ts',
    module: 'module:site',
    facts: [{ label: 'GraphQL', value: 'yes' }],
  },
  {
    id: 'collection:email-confirmations',
    path: 'src/modules/verification/cms/emailConfirmations.ts',
    module: 'module:verification',
    facts: [{ label: 'GraphQL', value: 'no' }],
  },
  {
    id: 'collection:search',
    path: 'docs/reference/content-types/search.md',
    module: 'module:news',
    facts: [],
  },
]

const ownerOf = (file) => {
  const match = /^src\/modules\/([^/]+)\//.exec(file)
  return match ? { id: `module:${match[1]}`, top: `module:${match[1]}` } : null
}

describe('buildApi', () => {
  const { nodes, edges } = buildApi({ api, contentTypes, ownerOf, siteId: 'site:sprecher-east' })
  const byId = (id) => nodes.find((n) => n.id === id)
  const edge = (from, to, type) =>
    edges.find((e) => e.from === from && e.to === to && e.type === type)

  it('makes a REST endpoint of each enabled content type, handled in the catch-all route file', () => {
    expect(byId('endpoint:rest:/api/events')).toMatchObject({
      type: 'endpoint',
      path: CATCH_ALL,
      module: 'module:events',
      links: ['src/modules/events/cms/events.ts'],
    })
    expect(byId('endpoint:rest:/api/globals/header')).toBeDefined()
    expect(byId('endpoint:rest:/api/payload-migrations')).toBeUndefined()
    expect(edge('endpoint:rest:/api/events', 'collection:events', 'exposes')).toBeDefined()
  })

  it('makes one GraphQL endpoint exposing the types that have GraphQL on', () => {
    expect(byId('endpoint:graphql:/api/graphql')).toMatchObject({
      path: 'src/app/(payload)/api/graphql/route.ts',
    })
    expect(edge('endpoint:graphql:/api/graphql', 'collection:events', 'exposes')).toBeDefined()
    expect(
      edge('endpoint:graphql:/api/graphql', 'collection:email-confirmations', 'exposes'),
    ).toBeUndefined()
  })

  it('makes a custom endpoint at its own file, or the catch-all for a plugin, exposing its owner', () => {
    const own = byId('endpoint:custom:POST /api/email-confirmations/confirm')
    expect(own).toMatchObject({
      path: 'src/modules/verification/cms/confirmEndpoint.ts',
      module: 'module:verification',
    })
    expect(own.facts).toContainEqual({ label: 'Guard', value: 'isHuman' })
    expect(byId('endpoint:custom:POST /api/search/reindex').path).toBe(CATCH_ALL)
    expect(
      edge(
        'endpoint:custom:POST /api/email-confirmations/confirm',
        'collection:email-confirmations',
        'exposes',
      ),
    ).toBeDefined()
  })

  it('makes an endpoint of a route handler of its own, but not the catch-all or the GraphQL one twice', () => {
    expect(byId('endpoint:route:/api/version')).toMatchObject({
      path: 'src/app/(frontend)/api/version/route.ts',
      module: 'site:sprecher-east',
    })
    expect(nodes.filter((n) => n.id.startsWith('endpoint:route:')).map((n) => n.id)).toEqual([
      'endpoint:route:/api/version',
    ])
  })

  it('makes an endpoint of each server action, in its module', () => {
    expect(byId('endpoint:action:src/modules/accounts/actions.ts#addPasskey')).toMatchObject({
      module: 'module:accounts',
      path: 'src/modules/accounts/actions.ts',
    })
  })

  it('makes the AI agent endpoint, held by the module of its key check, and the files Next.js serves', () => {
    expect(byId('endpoint:mcp:/api/mcp')).toMatchObject({
      path: 'src/modules/agents/cms/mcp.ts',
      module: 'module:agents',
    })
    expect(byId('endpoint:file:/robots.txt')).toMatchObject({ path: 'src/app/robots.ts' })
  })

  it('has the module hold each endpoint', () => {
    expect(edge('module:events', 'endpoint:rest:/api/events', 'contains')).toBeDefined()
    expect(edge('site:sprecher-east', 'endpoint:route:/api/version', 'contains')).toBeDefined()
  })
})
