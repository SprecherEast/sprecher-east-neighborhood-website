import { describe, expect, it } from 'vitest'

import { describeAccess, describeEndpoints, describeHooks } from './callbacks.mjs'
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

describe('describeEndpoints', () => {
  it('lists method, path and where the handler lives', () => {
    const endpoints = [{ path: '/verify/:token', method: 'post', handler: isAdmin }]
    expect(describeEndpoints(endpoints, locate)).toEqual([
      {
        method: 'POST',
        path: '/verify/:token',
        name: 'isAdmin',
        file: 'src/platform/payload/roles.ts',
      },
    ])
  })

  it('leaves out the routes Payload itself gives every type', () => {
    const endpoints = [
      { path: '/', method: 'get', handler: function findHandler() {} },
      { path: '/verify/:token', method: 'post', handler: isAdmin },
    ]
    expect(describeEndpoints(endpoints, locate).map((e) => e.path)).toEqual(['/verify/:token'])
  })

  it('is empty when a type has none, or switches them off', () => {
    expect(describeEndpoints(undefined, locate)).toEqual([])
    expect(describeEndpoints(false, locate)).toEqual([])
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
      fields: [{ path: 'title' }],
    })
  })
})
