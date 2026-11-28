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
        when: null,
      },
    ])
  })

  it('keeps a route only partly taken first among the live ones and in the taken list (#1461)', () => {
    const partly = base.contentTypes.map((type) =>
      type.slug === 'faq'
        ? {
            ...type,
            allEndpoints: [
              {
                method: 'POST',
                path: '/access/:id?',
                name: 'accessHandler',
                file: 'payload',
                replacedBy: { method: 'POST', path: '/:key', name: 'k', file: 'src/k.ts' },
                replacedWhen: ['/access'],
              },
            ],
          }
        : type,
    )
    const built = describeApi({ ...base, contentTypes: partly }, locate)
    expect(built.builtIn.some((row) => row.path === '/access/:id?')).toBe(true)
    expect(built.replaced.find((row) => row.slug === 'faq')).toMatchObject({
      path: '/access/:id?',
      when: ['/access'],
    })
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
  it('sorts the live routes by path, then by method, whatever order the config gives', () => {
    const route = (method, path) => ({ method, path, name: 'h', file: 'payload' })
    const unsorted = [
      { ...base.contentTypes[1], allEndpoints: [route('POST', '/b'), route('POST', '/a')] },
      { ...base.contentTypes[0], allEndpoints: [route('GET', '/b'), route('GET', '/a')] },
    ]
    const built = describeApi({ ...base, contentTypes: unsorted }, locate).builtIn
    expect(built.map((row) => `${row.method} ${row.path}`)).toEqual([
      'GET /a',
      'POST /a',
      'GET /b',
      'POST /b',
    ])
  })

  it('sorts the taken routes by type, then path, then method', () => {
    const taken = (method, path) => ({
      method,
      path,
      name: 'h',
      file: 'payload',
      replacedBy: { method, path: '/x', name: 'mine', file: 'src/m.ts' },
    })
    const unsorted = [
      { ...base.contentTypes[1], allEndpoints: [taken('GET', '/a')] },
      {
        ...base.contentTypes[0],
        allEndpoints: [taken('POST', '/b'), taken('POST', '/a'), taken('GET', '/a')],
      },
    ]
    const found = describeApi({ ...base, contentTypes: unsorted }, locate).replaced
    expect(found.map((row) => `${row.slug} ${row.method} ${row.path}`)).toEqual([
      'events GET /a',
      'events POST /a',
      'events POST /b',
      'faq GET /a',
    ])
  })
})
