import { describe, expect, it } from 'vitest'

import { describes, globToRegExp, parseKnowledgeMap, rulePaths } from './agent-context-maps.mjs'

const messageOf = (fn) => {
  try {
    fn()
  } catch (error) {
    return error.message
  }
  return undefined
}

describe('describes', () => {
  const entry = { paths: ['src/modules/events/**', 'docs/x.md'] }

  it.each([
    ['src/modules/events/domain/scope.ts', true],
    ['docs/x.md', true],
    ['src/modules/news/domain/scope.ts', false],
    // The sync check and the hook leave tests out
    ['src/modules/events/domain/scope.test.ts', false],
    ['src/modules/events/ui/Card.test.tsx', false],
  ])('%s is %s', (file, expected) => {
    expect(describes(entry, file)).toBe(expected)
  })
})

describe('exclude', () => {
  const entry = {
    paths: ['src/platform/ui/**'],
    exclude: ['src/platform/ui/chart/**', 'src/platform/ui/Area*'],
  }

  it.each([
    ['src/platform/ui/Button.tsx', true],
    ['src/platform/ui/chart/Chart.tsx', false],
    ['src/platform/ui/AreaChart.tsx', false],
  ])('%s is %s', (file, expected) => {
    expect(describes(entry, file)).toBe(expected)
  })

  it('throws the entry message, not a crash, for an entry that is not an object', () => {
    expect(messageOf(() => parseKnowledgeMap('[null]'))).toBe(
      'docs/knowledge/map.json: entry 1 needs a "note" (a .md path) and a non-empty "paths" list of globs',
    )
  })

  it('is read from the map, and a mistyped one throws', () => {
    const list = (exclude) => JSON.stringify([{ note: 'a.md', paths: ['x/**'], exclude }])
    expect(parseKnowledgeMap(list(['x/y/**']))[0].exclude).toEqual(['x/y/**'])
    expect(Object.keys(parseKnowledgeMap(list(undefined))[0])).toEqual([
      'source',
      'paths',
      'origin',
    ])
    expect(messageOf(() => parseKnowledgeMap(list('x/y')))).toBe(
      'docs/knowledge/map.json: entry 1: "exclude" must be a list of globs',
    )
  })

  it.each([
    ['a number', [5]],
    ['an empty text', ['']],
    ['a good glob next to a bad one', ['x/y/**', 5]],
  ])('throws, naming the entry, for an exclude item that is %s', (_, exclude) => {
    const json = JSON.stringify([{ note: 'a.md', paths: ['x/**'], exclude }])
    expect(messageOf(() => parseKnowledgeMap(json))).toBe(
      'docs/knowledge/map.json: entry 1: "exclude" must be a list of globs',
    )
  })
})

describe('rulePaths', () => {
  const tracked = [
    'src/ui/Button.tsx',
    'src/ui/Button.test.tsx',
    'src/ui/AreaChart.tsx',
    'src/ui/AreaChart.test.tsx',
    'src/ui/chart/Chart.tsx',
    'src/ui/testing/helper.ts',
    'src/ui/deep/a/X.tsx',
    'src/ui/deep/b/Y.tsx',
    'src/other/Z.tsx',
  ]

  it('is the entry paths as written when nothing is excluded', () => {
    expect(rulePaths({ paths: ['src/ui/**'] }, tracked)).toEqual(['src/ui/**'])
  })

  it('lists, for an entry with exclude, globs that match exactly the files it describes', () => {
    const entry = { paths: ['src/ui/**'], exclude: ['src/ui/chart/**', 'src/ui/Area*'] }
    const globs = rulePaths(entry, tracked)
    const loaded = (file) => globs.some((glob) => globToRegExp(glob).test(file))
    for (const file of tracked) {
      const wanted =
        file.startsWith('src/ui/') && !file.includes('chart/') && !file.includes('/Area')
      expect(loaded(file), file).toBe(wanted)
    }
  })

  it('keeps a folder as one glob when nothing in it is excluded', () => {
    const entry = { paths: ['src/ui/**'], exclude: ['src/ui/chart/**', 'src/ui/Area*'] }
    expect(rulePaths(entry, tracked)).toEqual(
      expect.arrayContaining(['src/ui/testing/**', 'src/ui/deep/**', 'src/ui/Button.tsx']),
    )
  })

  it('writes out exactly the files an entry describes, folders sorted, never from the root', () => {
    const entry = {
      paths: ['*', '*/**'],
      exclude: ['skip/**', 'mixed/skip.ts', 'nest/out/**', 'one/sub/**'],
    }
    const files = [
      'README.md',
      'skip/x.ts',
      'zeta/a.ts',
      'alpha/b.ts',
      'mixed/p.ts',
      'mixed/skip.ts',
      'nest/deep/q.ts',
      'nest/out/r.ts',
      'one/f.ts',
      'one/sub/g.ts',
    ]
    expect(rulePaths(entry, files)).toEqual([
      'README.md',
      'alpha/**',
      'mixed/p.ts',
      'nest/deep/**',
      'one/*',
      'zeta/**',
    ])
  })

  it('does not fold the whole repository into one glob when everything is described', () => {
    const entry = { paths: ['*', '*/**'], exclude: ['nothing/**'] }
    expect(rulePaths(entry, ['README.md', 'zeta/a.ts', 'alpha/b.ts'])).toEqual([
      'README.md',
      'alpha/**',
      'zeta/**',
    ])
  })

  it('folds a folder whose direct files are all included into one star glob', () => {
    const entry = { paths: ['src/**'], exclude: ['src/ui/chart/**'] }
    const globs = rulePaths(entry, [...tracked, 'src/ui/chart/deeper/Q.tsx'])
    expect(globs).toContain('src/other/**')
    expect(globs).toContain('src/ui/*')
    expect(globs).not.toContain('src/ui/**')
  })
})
