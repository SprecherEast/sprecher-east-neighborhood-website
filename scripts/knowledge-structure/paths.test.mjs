import { describe, expect, it } from 'vitest'

import { existsExactly, pathReferences, resolves } from './paths.mjs'
import { schema } from './testkit.mjs'

const files = [
  'src/modules/demo/README.md',
  'src/modules/demo/domain/rule.ts',
  'src/modules/demo/ui/Card.tsx',
  'src/platform/lib/cn.ts',
  'docs/reference/routes.md',
  'src/app/(frontend)/layout.tsx',
]
const ctx = { noteDir: 'src/modules/demo', files, schema }

describe('pathReferences', () => {
  it('takes backticked file paths and directories, and file links, not routes, aliases or words', () => {
    const body = [
      'See `domain/rule.ts`, `ui/`, `/roadmap/[number]`, `/posts/`, `/`, `@/modules/x.ts`, `Field.Money`, `a b.ts`.',
      'Link [routes](../../../docs/reference/routes.md#top) and [site](https://x.dev/a.md).',
      '```',
      '`ignored/in/fence.ts`',
      '```',
    ].join('\n')
    expect(pathReferences(body, schema).map((r) => [r.kind, r.token])).toEqual([
      ['code', 'domain/rule.ts'],
      ['code', 'ui/'],
      ['link', '../../../docs/reference/routes.md'],
    ])
  })

  it('takes a path under a known repository folder even without an extension', () => {
    expect(pathReferences('`src/platform/ui` and `ops`', schema).map((r) => r.token)).toEqual([
      'src/platform/ui',
    ])
  })
})

describe('resolves', () => {
  it.each([
    ['domain/rule.ts', true], // beside the note
    ['ui/', true], // a folder
    ['lib/cn.ts', true], // under src/platform
    ['src/platform/lib/cn.ts', true],
    ['app/(frontend)/layout.tsx', true], // under src
    ['layout.tsx', true], // under src/app/(frontend)
    ['cn.ts', true], // a bare name listed after its folder, found elsewhere
    ['domain/', true],
    ['layout*.tsx', true],
    ['(frontend)/layout.tsx', true], // the end of a longer path
    ['.../ui/Card.tsx', true],
    ['domain/rule', true], // no extension
    ['rule.t', false], // whole path parts only
    ['gone.ts', false],
    ['gonedir/', false],
    ['domain/gone.ts', false],
    ['domain/*.ts', true], // a pattern matching something
    ['domain/*.mjs', false],
    ['.env.local', true], // ignored by the schema
    ['../../../docs/reference/routes.md', true], // relative to the note
    ['../../../docs/reference/nope.md', false],
    ['../../docs/reference/routes.md', false], // the wrong depth
    ['/reference/routes.md', false], // from the root means the whole path
    ['/docs/reference/routes.md', true], // from the repository root
  ])('%s resolves: %s', (token, expected) => {
    expect(resolves(token, ctx)).toBe(expected)
  })
})

describe('existsExactly', () => {
  it.each([
    ['src/modules/demo/README.md', true],
    ['src/modules/demo/', true],
    ['src/modules/demo', true],
    ['README.md', false],
    ['demo/', false],
    ['src/modules/dem', false],
    ['', false],
  ])('%s: %s', (target, expected) => {
    expect(existsExactly(target, files)).toBe(expected)
  })
})
