import { describe, expect, it } from 'vitest'

import { groupBuiltIn } from './builtInRoutes.mjs'

const type = (slug, kind, paths) => ({
  slug,
  kind,
  allEndpoints: paths.map((path) => ({ method: 'GET', path, name: 'h', file: 'payload' })),
})

describe('groupBuiltIn scope (#1461)', () => {
  it('writes collections first, then globals, each as "every" or "every … except …"; the types are sorted', () => {
    const types = [
      type('e', 'collection', ['/x']),
      type('d', 'collection', []),
      type('c', 'collection', ['/x']),
      type('b', 'collection', ['/x']),
      type('a', 'collection', []),
      type('g2', 'global', ['/x']),
      type('g1', 'global', ['/x']),
    ]
    const [row] = groupBuiltIn(types)
    expect(row.scope).toBe('every collection except `a`, `d`; every global')
    expect(row.types).toEqual(['b', 'c', 'e', 'g1', 'g2'])
  })

  it('leaves the scope empty when a summary would hide a type, and for one kind alone', () => {
    const types = [
      type('a', 'collection', ['/y']),
      type('b', 'collection', []),
      type('c', 'collection', []),
      type('g', 'global', ['/y']),
    ]
    const [row] = groupBuiltIn(types)
    expect(row.scope).toBe('')
    expect(groupBuiltIn([type('g', 'global', ['/z'])])[0].scope).toBe('every global')
  })
})
