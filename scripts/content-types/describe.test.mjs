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

  it('keeps the routes Payload gives the type when asked, in config order (#1461)', () => {
    const endpoints = [
      { path: '/', method: 'get', handler: function findHandler() {} },
      { path: '/verify/:token', method: 'post', handler: isAdmin },
    ]
    expect(
      describeEndpoints(endpoints, locate, { builtIn: true }).map((e) => [
        e.method,
        e.path,
        e.file,
      ]),
    ).toEqual([
      ['GET', '/', 'payload'],
      ['POST', '/verify/:token', 'src/platform/payload/roles.ts'],
    ])
  })

  it('marks a route an earlier endpoint of the same type takes first, as Payload matches them (#1461)', () => {
    function mine() {}
    const endpoints = [
      { path: '/verify/:id', method: 'post', handler: mine },
      { path: '/:key', method: 'get', handler: mine },
      { path: '/verify/:id', method: 'post', handler: function verifyHandler() {} },
      { path: '/:id', method: 'get', handler: function findByIDHandler() {} },
      { path: '/count', method: 'get', handler: function countHandler() {} },
      { path: '/versions/:id', method: 'get', handler: function findVersionByIDHandler() {} },
      { path: '/:id', method: 'patch', handler: function updateHandler() {} },
    ]
    const found = describeEndpoints(endpoints, locate, { builtIn: true })
    expect(found.map((e) => [e.method, e.path, e.replacedBy?.path ?? null])).toEqual([
      ['POST', '/verify/:id', null],
      ['GET', '/:key', null],
      ['POST', '/verify/:id', '/verify/:id'],
      ['GET', '/:id', '/:key'],
      ['GET', '/count', '/:key'],
      ['GET', '/versions/:id', null],
      ['PATCH', '/:id', null],
    ])
  })

  it('asks a route with an optional segment both with and without it (#1461)', () => {
    function mine() {}
    const found = (endpoints) =>
      describeEndpoints(endpoints, locate, { builtIn: true }).map((e) => [
        e.path,
        e.replacedBy?.path ?? null,
        e.replacedWhen ?? null,
      ])
    // `/:key` takes `/access` (no id) but not `/access/7`: only partly taken
    expect(
      found([
        { path: '/:key', method: 'post', handler: mine },
        { path: '/access/:id?', method: 'post', handler: function accessHandler() {} },
      ]),
    ).toEqual([
      ['/:key', null, null],
      ['/access/:id?', '/:key', ['/access']],
    ])
    // an earlier optional segment is matched present and absent
    expect(
      found([
        { path: '/a/:id?', method: 'get', handler: mine },
        { path: '/a', method: 'get', handler: function aHandler() {} },
        { path: '/a/b', method: 'get', handler: function abHandler() {} },
        { path: '/a/b/c', method: 'get', handler: function abcHandler() {} },
      ]),
    ).toEqual([
      ['/a/:id?', null, null],
      ['/a', '/a/:id?', null],
      ['/a/b', '/a/:id?', null],
      ['/a/b/c', null, null],
    ])
    // an optional segment of the later route that the earlier one takes in every form
    expect(
      found([
        { path: '/:one/:two?', method: 'get', handler: mine },
        { path: '/x/:id?', method: 'get', handler: function xHandler() {} },
      ]),
    ).toEqual([
      ['/:one/:two?', null, null],
      ['/x/:id?', '/:one/:two?', null],
    ])
  })

  it('matches the root path of a type as a path of its own (#1461)', () => {
    function mine() {}
    const found = describeEndpoints(
      [
        { path: '/', method: 'get', handler: mine },
        { path: '/', method: 'get', handler: function findHandler() {} },
        { path: '/other', method: 'get', handler: function otherHandler() {} },
      ],
      locate,
      { builtIn: true },
    )
    // the root route takes the root request, and only that one
    expect(found.map((e) => [e.path, e.replacedBy?.path ?? null])).toEqual([
      ['/', null],
      ['/', '/'],
      ['/other', null],
    ])
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
