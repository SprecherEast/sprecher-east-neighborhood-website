import { describe, expect, it } from 'vitest'

import { describeAccess, describeHooks } from './callbacks.mjs'
import { describeContentType } from './describe.mjs'

function isAdmin() {}
const locate = (fn) => (fn === isAdmin ? 'src/platform/payload/roles.ts' : 'payload')

describe('describeAccess', () => {
  it('lists the operations in a fixed order with the function behind each', () => {
    function anyone() {}
    const access = { delete: isAdmin, read: anyone, create: isAdmin, admin: isAdmin }
    expect(describeAccess(access, locate)).toEqual([
      { operation: 'create', name: 'isAdmin', note: '', file: 'src/platform/payload/roles.ts' },
      { operation: 'read', name: 'anyone', note: '', file: 'payload' },
      { operation: 'delete', name: 'isAdmin', note: '', file: 'src/platform/payload/roles.ts' },
      { operation: 'admin', name: 'isAdmin', note: '', file: 'src/platform/payload/roles.ts' },
    ])
  })

  it('shows an anonymous function as inline', () => {
    const anonymous = (() => () => ({}))()
    expect(describeAccess({ read: anonymous }, locate)).toEqual([
      { operation: 'read', name: 'inline', note: '', file: 'payload' },
    ])
  })

  it('shows a function named only by its key as inline, with what a constant one does', () => {
    const access = { read: () => true, create: () => false }
    expect(describeAccess(access, locate)).toEqual([
      { operation: 'create', name: 'inline', note: 'always denies', file: 'payload' },
      { operation: 'read', name: 'inline', note: 'always allows', file: 'payload' },
    ])
  })
})

describe('describeHooks', () => {
  it('lists hooks by phase in the order Payload runs the phases, each in its own order', () => {
    const hooks = {
      afterChange: [function revalidate() {}],
      beforeChange: [isAdmin, function second() {}],
      beforeValidate: [],
    }
    expect(describeHooks(hooks, locate).map((h) => [h.phase, h.name])).toEqual([
      ['beforeChange', 'isAdmin'],
      ['beforeChange', 'second'],
      ['afterChange', 'revalidate'],
    ])
  })

  it('shows a hook that only carries its phase as its name as inline', () => {
    const hooks = { afterChange: [{ afterChange: () => {} }.afterChange] }
    expect(describeHooks(hooks, locate).map((h) => h.name)).toEqual(['inline'])
  })
})

describe('describeContentType', () => {
  it('gathers the title, purpose, drafts, access, hooks, endpoints and fields', () => {
    const model = describeContentType(
      {
        slug: 'events',
        labels: { plural: 'Events', singular: 'Event' },
        admin: { description: 'What is on.' },
        versions: { drafts: true },
        access: { read: isAdmin },
        hooks: { beforeChange: [isAdmin] },
        endpoints: [{ path: '/x', method: 'get', handler: isAdmin }],
        fields: [{ name: 'title', type: 'text' }],
      },
      'collection',
      { locate },
    )
    expect(model).toMatchObject({
      slug: 'events',
      kind: 'collection',
      title: 'Events',
      purpose: 'What is on.',
      access: [{ operation: 'read' }],
      hooks: [{ phase: 'beforeChange' }],
      endpoints: [{ method: 'GET', path: '/x' }],
      allEndpoints: [{ method: 'GET', path: '/x' }],
      graphQL: true,
      fields: [{ path: 'title' }],
    })
  })

  it('gives every route of allEndpoints the two keys of what took it, null when nothing did', () => {
    const route = () => true
    const { allEndpoints } = describeContentType(
      { slug: 'events', endpoints: [{ path: '/a', method: 'get', handler: route }] },
      'collection',
      { locate },
    )
    expect(allEndpoints).toStrictEqual([
      {
        method: 'GET',
        path: '/a',
        name: 'route',
        file: 'payload',
        replacedBy: null,
        replacedWhen: null,
      },
    ])
  })

  it('keeps the routes Payload adds only in allEndpoints', () => {
    const payloadRoute = () => true
    const model = describeContentType(
      {
        slug: 'events',
        endpoints: [
          { path: '/x', method: 'get', handler: isAdmin },
          { path: '/count', method: 'get', handler: payloadRoute },
        ],
      },
      'collection',
      { locate },
    )
    expect(model.endpoints.map((e) => e.path)).toEqual(['/x'])
    expect(model.allEndpoints.map((e) => e.path)).toEqual(['/x', '/count'])
  })
})
