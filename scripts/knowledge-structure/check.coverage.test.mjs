import { describe, expect, it } from 'vitest'

import {
  GOOD_FIELDS,
  GOOD_FILES,
  NOTE_PATH,
  goodNote,
  messagesOf,
  repo,
  schema,
} from './testkit.mjs'

describe('COVERAGE-CODE', () => {
  it('COVERAGE-CODE lists the folders with the most loose files first', () => {
    const files = [...GOOD_FILES, 'src/a/one.ts', 'src/b/x/p.ts', 'src/b/x/q.ts']
    const [found] = repo({ schema, files }).filter((f) => f.rule === 'COVERAGE-CODE')
    expect(found.message).toContain('3 source files have no note: src/b/x 2, src/a/one.ts 1')
  })

  it('COVERAGE-CODE does not count generated types, stories or files outside src', () => {
    const files = [
      ...GOOD_FILES,
      'src/payload-types.ts',
      'src/x/Card.stories.tsx',
      'scripts/a.ts',
      'src/readme.md',
    ]
    expect(repo({ schema, files }).filter((f) => f.rule === 'COVERAGE-CODE')).toEqual([])
  })

  it('COVERAGE-CODE reads every root and every ignore pattern the schema lists', () => {
    const two = {
      ...schema,
      coverage: {
        ...schema.coverage,
        roots: ['src/a/**', 'lib/**'],
        ignore: ['lib/x/**', '**/*.d.ts'],
      },
    }
    const files = [...GOOD_FILES, 'lib/y.ts', 'lib/x/z.ts', 'lib/w.d.ts', 'src/b/other.ts']
    const [found] = repo({ schema: two, files }).filter((f) => f.rule === 'COVERAGE-CODE')
    expect(found.message).toBe('1 source files have no note: lib/y.ts 1')
  })

  it('COVERAGE-CODE counts a file no entry describes, even when another entry does', () => {
    const two = JSON.stringify([
      { note: NOTE_PATH, paths: ['src/modules/demo/**'] },
      { note: 'src/modules/b/README.md', paths: ['src/modules/b/**'] },
    ])
    const b = goodNote({ ...GOOD_FIELDS, name: 'B', summary: 'bee' }).replace(
      'domain/rule.ts',
      'x.ts',
    )
    const files = [...GOOD_FILES, 'src/modules/b/README.md', 'src/modules/b/x.ts', 'src/c/y.ts']
    const found = repo({ map: two, files, texts: { 'src/modules/b/README.md': b } })
    expect(messagesOf(found, 'COVERAGE-CODE')).toEqual([
      '1 source files have no note: src/c/y.ts 1',
    ])
  })

  it('COVERAGE-CODE: warns once about source code no map entry describes', () => {
    const files = [...GOOD_FILES, 'src/lib/a.ts', 'src/lib/a.test.ts', 'src/app/x/page.tsx']
    const found = repo({ schema, files }).filter((f) => f.rule === 'COVERAGE-CODE')
    expect(found).toHaveLength(1)
    expect(found[0].severity).toBe('warning')
    expect(found[0].note).toBe('docs/knowledge/map.json')
    expect(found[0].message).toBe('2 source files have no note: src/lib/a.ts 1, src/app/x 1')
  })
})
