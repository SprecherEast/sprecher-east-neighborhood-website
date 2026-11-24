import { describe, expect, it } from 'vitest'

import { describes, globToRegExp, parseKnowledgeMap, rulePaths } from './agent-context-maps.mjs'

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

  it('is read from the map, and a mistyped one throws', () => {
    const list = (exclude) => JSON.stringify([{ note: 'a.md', paths: ['x/**'], exclude }])
    expect(parseKnowledgeMap(list(['x/y/**']))[0].exclude).toEqual(['x/y/**'])
    expect(parseKnowledgeMap(list(undefined))[0].exclude).toBeUndefined()
    expect(() => parseKnowledgeMap(list('x/y'))).toThrow(/exclude/)
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

  it('folds a folder whose direct files are all included into one star glob', () => {
    const entry = { paths: ['src/**'], exclude: ['src/ui/chart/**'] }
    const globs = rulePaths(entry, [...tracked, 'src/ui/chart/deeper/Q.tsx'])
    expect(globs).toContain('src/other/**')
    expect(globs).toContain('src/ui/*')
    expect(globs).not.toContain('src/ui/**')
  })
})
