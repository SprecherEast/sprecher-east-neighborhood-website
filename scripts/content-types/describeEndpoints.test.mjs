import { describe, expect, it } from 'vitest'

import { describeEndpoints } from './callbacks.mjs'

function isAdmin() {}
const locate = (fn) => (fn === isAdmin ? 'src/platform/payload/roles.ts' : 'payload')

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

  it('does not let a route made only of optional segments take the root request (#1461)', () => {
    function mine() {}
    const found = describeEndpoints(
      [
        { path: '/:id?', method: 'get', handler: mine },
        { path: '/', method: 'get', handler: function rootHandler() {} },
      ],
      locate,
      { builtIn: true },
    )
    // `/:id?` is `/` or `/x`; a request to `/` has no segment, and an empty one is no segment
    expect(found.map((e) => [e.path, e.replacedBy?.path ?? null])).toEqual([
      ['/:id?', null],
      ['/', null],
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

  it('reads a question mark, a star or a plus inside a path as the letter it is', () => {
    const handler = () => true
    const paths = ['/x?y', '/a*b', '/p+q', '/id/:key?']
    const found = describeEndpoints(
      [...paths, ...paths].map((path) => ({ path, method: 'get', handler })),
      locate,
      { builtIn: true },
    )
    // each repeated path is taken first by its earlier twin (the optional one only partly)
    expect(found.slice(4).map((e) => [e.path, e.replacedBy?.path ?? null])).toEqual(
      paths.map((p) => [p, p]),
    )
  })

  it('is empty when a type has none, or switches them off', () => {
    expect(describeEndpoints(undefined, locate)).toEqual([])
    expect(describeEndpoints(false, locate)).toEqual([])
  })
})
