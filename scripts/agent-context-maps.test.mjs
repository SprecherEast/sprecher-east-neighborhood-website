import { describe, expect, it } from 'vitest'

import { describes, parseKnowledgeMap } from './agent-context-maps.mjs'

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
