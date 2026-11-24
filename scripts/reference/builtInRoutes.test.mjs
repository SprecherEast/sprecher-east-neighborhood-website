import { describe, expect, it } from 'vitest'

import { describeApi } from './endpoints.mjs'
import { base, locate } from './endpointsFixture.mjs'

describe('the routes Payload adds to content types', () => {
  const api = describeApi(base, locate)

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

  it('keeps a route an earlier endpoint of the type takes first out of the live ones', () => {
    expect(api.builtIn.some((row) => row.path === '/verify/:id')).toBe(false)
    expect(api.replaced).toEqual([
      {
        slug: 'events',
        method: 'POST',
        path: '/verify/:id',
        by: { path: '/verify/:token', name: 'verify', file: 'src/v.ts' },
      },
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

  it('lists the types when exactly half of them have the route', () => {
    const four = [
      ...base.contentTypes,
      {
        slug: 'posts',
        kind: 'collection',
        rest: true,
        graphQL: true,
        endpoints: [],
        allEndpoints: [],
      },
    ].map((type) =>
      ['events', 'faq'].includes(type.slug)
        ? {
            ...type,
            allEndpoints: [{ method: 'GET', path: '/half', name: 'h', file: 'payload' }],
          }
        : type,
    )
    const row = describeApi({ ...base, contentTypes: four }, locate).builtIn.find(
      (entry) => entry.path === '/half',
    )
    expect(row.scope).toBe('')
  })
})
