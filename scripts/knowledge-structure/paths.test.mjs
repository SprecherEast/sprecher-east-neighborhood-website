import { describe, expect, it } from 'vitest'

import { existsExactly, pathReferences, resolves } from './paths.mjs'
import { schema } from './testkit.mjs'

const files = [
  'src/modules/demo/README.md',
  'src/modules/demo/domain/rule.ts',
  'src/modules/demo/ui/Card.tsx',
  'src/modules/demo/domain/sub/x.ts',
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
      '[plan](/roadmap) and [top](#top) and [dir](../../ui/)',
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

  it('takes a known repository folder only at the start of a token', () => {
    expect(pathReferences('`a/src/b` and `src/b` and `x.ops`', schema).map((r) => r.token)).toEqual(
      ['src/b'],
    )
  })

  it('takes a path under a known repository folder even without an extension', () => {
    expect(pathReferences('`src/platform/ui` and `ops`', schema).map((r) => r.token)).toEqual([
      'src/platform/ui',
    ])
  })
})

describe('pathReferences, in detail', () => {
  it('gives each reference its kind and its line, a pattern included', () => {
    const body = 'Intro.\n- `domain/*.ts` and [a](../x.md).\n\n  - See `ui/Card.tsx`.'
    expect(pathReferences(body, schema)).toEqual([
      { kind: 'code', token: 'domain/*.ts', line: 2 },
      { kind: 'link', token: '../x.md', line: 2 },
      { kind: 'code', token: 'ui/Card.tsx', line: 4 },
    ])
  })

  it('reads a token with a colon inside a path as a path, not a web address', () => {
    expect(pathReferences('[a](x/a:b.md) [b](https://x.dev/b.md)', schema)).toEqual([
      { kind: 'link', token: 'x/a:b.md', line: 1 },
    ])
  })

  it('knows every file extension the schema lists, and no other', () => {
    for (const ext of schema.paths.extensions) {
      expect(pathReferences(`\`x.${ext}\``, schema).map((r) => r.token)).toEqual([`x.${ext}`])
    }
    expect(pathReferences('`x.abc`', schema)).toEqual([])
  })

  it('opens a code fence only at the start of a line', () => {
    const body = 'Use ``` for code.\n`domain/rule.ts`\n  ```\n`hidden/x.ts`\n  ```\n`ui/Card.tsx`'
    expect(pathReferences(body, schema).map((r) => r.token)).toEqual([
      'domain/rule.ts',
      'ui/Card.tsx',
    ])
  })

  it('takes a token with an extension and no folder, and not one with another ending', () => {
    expect(pathReferences('`rule.ts` `rule.xyz` `Rule`', schema).map((r) => r.token)).toEqual([
      'rule.ts',
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
    ['./domain/rule.ts', true], // a leading ./ is from the note's folder
    ['./rule.ts', false], // exactly there, not an abbreviation
    ['./README.md', true],
    ['domain/sub/', true], // a folder two levels down
    ['domain/zzz/', false],
    ['/docs/reference/', true], // a folder from the root
    ['../../../docs/reference/', true], // a folder from the note
    ['domain/.../rule.ts', false], // the three dots only start a token
    ['x/../domain/rule.ts', false], // ../ only counts at the start
    ['domain/gone.ts', false],
    ['domain/*.ts', true], // a pattern matching something
    ['domain/*.mjs', false],
    ['./domain/*.ts', true], // a pattern read from the note's folder
    ['/docs/*/routes.md', true], // and one read from the root
    ['/docs/*/nope.md', false],
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

describe('links, as decision 0022 states them', () => {
  it('reads a link to a folder, or to a file with no known extension, as nothing to examine', () => {
    expect(pathReferences('[a](../shared/) [b](../LICENSE) [c](../x.ts)', schema)).toEqual([
      { kind: 'link', token: '../x.ts', line: 1 },
    ])
  })

  it('treats a bare link like an abbreviation, and ./ and ../ links as exact', () => {
    expect(resolves('cn.ts', ctx)).toBe(true)
    expect(resolves('./cn.ts', ctx)).toBe(false)
    expect(resolves('../../platform/lib/cn.ts', ctx)).toBe(true)
    expect(resolves('../lib/cn.ts', ctx)).toBe(false)
  })
})

describe('existsExactly with an empty entry in the list', () => {
  it('does not find / or an empty target there', () => {
    expect(existsExactly('/', ['', ...files])).toBe(false)
    expect(existsExactly('', ['', ...files])).toBe(false)
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
