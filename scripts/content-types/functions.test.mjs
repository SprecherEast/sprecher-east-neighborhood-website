import { describe, expect, it } from 'vitest'

import { fileFromUrl, functionLabel } from './functions.mjs'

describe('fileFromUrl', () => {
  const root = '/work/repo'

  it('gives a path under the repo root relative to it, without a loader query', () => {
    expect(fileFromUrl('file:///work/repo/src/a/b.ts?tsx-namespace=1', root)).toBe('src/a/b.ts')
  })

  it('names the package for a file in node_modules, scoped or not', () => {
    expect(fileFromUrl('file:///work/repo/node_modules/payload/dist/x.js', root)).toBe('payload')
    expect(
      fileFromUrl('file:///work/repo/node_modules/@payloadcms/plugin-search/dist/y.js', root),
    ).toBe('@payloadcms/plugin-search')
  })

  it('names the package when node_modules is a link into another checkout', () => {
    expect(fileFromUrl('file:///other/node_modules/payload/dist/x.js', root)).toBe('payload')
  })

  it('never leaks an absolute path or a missing script', () => {
    expect(fileFromUrl('file:///elsewhere/z.js', root)).toBe('unknown')
    expect(fileFromUrl(undefined, root)).toBe('unknown')
    expect(fileFromUrl('node:internal/x', root)).toBe('Node.js')
  })

  it('does not treat a sibling folder that starts with the root name as inside the root', () => {
    expect(fileFromUrl('file:///work/repo-other/src/a.ts', root)).toBe('unknown')
  })
})

describe('functionLabel', () => {
  function isAdmin() {}

  it('uses the name of a named function', () => {
    expect(functionLabel(isAdmin, 'create')).toEqual({ name: 'isAdmin', note: '' })
  })

  it('says inline for an anonymous function', () => {
    const anonymous = (() => () => ({}))()
    expect(functionLabel(anonymous, 'read')).toEqual({ name: 'inline', note: '' })
  })

  it('says inline for a function whose name is only the key it was written under', () => {
    const access = { read: () => ({ id: 1 }) }
    expect(functionLabel(access.read, 'read')).toEqual({ name: 'inline', note: '' })
  })

  it('says what a function that only returns true or false does', () => {
    const access = { read: () => true, create: () => false, update: async () => true }
    expect(functionLabel(access.read, 'read').note).toBe('always allows')
    expect(functionLabel(access.create, 'create').note).toBe('always denies')
    expect(functionLabel(access.update, 'update').note).toBe('always allows')
  })

  it('does not call a function that decides something constant', () => {
    const access = { read: ({ req }) => Boolean(req.user) }
    expect(functionLabel(access.read, 'read').note).toBe('')
  })
})
