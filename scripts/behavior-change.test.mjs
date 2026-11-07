import { describe, expect, it } from 'vitest'

import { classifyChanges, classifyFile, isPatchBumpOnly } from './behavior-change.mjs'

/** A hunk the way GitHub's pull request file list gives it: no file header, just the lines. */
const patch = (...lines) => ['@@ -1,9 +1,9 @@', ...lines].join('\n')
const file = (filename, extra = {}) => ({ filename, status: 'modified', ...extra })
const kind = (f) => classifyFile(f).kind

describe('classifyFile: by path', () => {
  it.each([
    'src/modules/events/ui/EventCard.test.tsx',
    'src/platform/ui/Button.spec.ts',
    'src/modules/events/__tests__/upcoming.ts',
    'tests/e2e/home.ts',
    'e2e/home.ts',
    'src/modules/site/__fixtures__/page.json',
    '.github/scripts/knowledge-sync.test.mjs',
  ])('treats %s as a test', (name) => {
    expect(kind(file(name, { patch: patch('-a', '+b') }))).toBe('test')
  })

  it.each([
    'README.md',
    'docs/guidelines/payload-cms.md',
    'docs/ui/component-set.md',
    'src/modules/events/README.md',
    '.agents/skills/pr-review/SKILL.md',
    '.claude/rules/generated/x.md',
    'docs/architecture/diagram.png',
  ])('treats %s as a doc', (name) => {
    expect(kind(file(name))).toBe('doc')
  })

  it.each(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'])(
    'exempts the lockfile %s on its own',
    (name) => {
      expect(kind(file(name, { patch: patch('-"a": "1.0.0"', '+"a": "1.0.1"') }))).toBe('exempt')
    },
  )

  it('exempts the generated Payload types file', () => {
    expect(kind(file('src/payload-types.ts', { patch: patch('-a', '+b') }))).toBe('exempt')
  })

  it.each([
    'src/modules/site/ui/MapBlock.tsx',
    'src/platform/ui/Link.tsx',
    'src/app/(frontend)/page.tsx',
    'scripts/deploy.mjs',
    'ops/deploy.sh',
    '.github/workflows/ci.yml',
    '.github/scripts/knowledge-sync.mjs',
    '.claude/hooks/rules.mjs',
    'next.config.ts',
    'package.json',
    'src/migrations/20260101_add_field.ts',
    'public/logo.svg',
  ])('treats %s as behavior-bearing when nothing says otherwise', (name) => {
    expect(kind(file(name))).toBe('behavior')
  })
})

describe('classifyFile: by content', () => {
  it('exempts a change that only touches comment lines', () => {
    const f = file('src/a.ts', {
      patch: patch(' const a = 1', '-// the old note', '+// the new note', ' const b = 2'),
    })
    expect(kind(f)).toBe('exempt')
  })

  it('exempts a JSDoc block edit when the block is in the patch', () => {
    const f = file('src/a.ts', {
      patch: patch(' /**', '-* Old words.', '+* New words.', ' */', ' export const a = 1'),
    })
    expect(kind(f)).toBe('exempt')
  })

  it('exempts a hash-comment change in a workflow or script', () => {
    expect(kind(file('.github/workflows/ci.yml', { patch: patch('-# old', '+# new') }))).toBe(
      'exempt',
    )
  })

  it('exempts formatting only: whitespace, line breaks, quotes, semicolons, trailing commas', () => {
    const f = file('src/a.ts', {
      patch: patch(
        "-const a = foo('x', 'y');",
        '-call(a, b);',
        '+const a = foo("x", "y")',
        '+call(',
        '+  a,',
        '+  b,',
        '+)',
      ),
    })
    expect(kind(f)).toBe('exempt')
  })

  it('exempts a whitespace-only change', () => {
    expect(kind(file('src/a.ts', { patch: patch('-  const a = 1', '+    const a = 1') }))).toBe(
      'exempt',
    )
  })

  it('keeps a code change that sits next to a comment change', () => {
    const f = file('src/a.ts', {
      patch: patch('-// old', '+// new', '-const limit = 5', '+const limit = 6'),
    })
    expect(kind(f)).toBe('behavior')
  })

  it('keeps a trailing comment change, since it cannot be told from code', () => {
    const f = file('src/a.ts', { patch: patch('-run() // old', '+run() // new') })
    expect(kind(f)).toBe('behavior')
  })

  it('keeps a reordering of lines', () => {
    const f = file('src/a.ts', { patch: patch('-a()', '-b()', '+b()', '+a()') })
    expect(kind(f)).toBe('behavior')
  })

  it('keeps a line that starts with * when the patch shows no block comment', () => {
    const f = file('src/a.ts', { patch: patch(' const ms = 60', '-  * 1000', '+  * 2000') })
    expect(kind(f)).toBe('behavior')
  })

  it('keeps a hash line in a file type without hash comments', () => {
    expect(kind(file('src/a.ts', { patch: patch('-#old', '+#new') }))).toBe('behavior')
  })

  it('keeps json when a value changes', () => {
    expect(kind(file('data.json', { patch: patch('-"a": 1', '+"a": 2') }))).toBe('behavior')
  })

  it('leans to behavior when the patch is missing (binary or very large)', () => {
    expect(kind(file('src/big.ts'))).toBe('behavior')
    expect(kind(file('public/photo.jpg'))).toBe('behavior')
  })

  it('keeps a new file and a deleted file, unless a test or doc', () => {
    const added = file('src/new.ts', { status: 'added', patch: patch('+export const a = 1') })
    const removed = file('src/old.ts', { status: 'removed', patch: patch('-export const a = 1') })
    expect(kind(added)).toBe('behavior')
    expect(kind(removed)).toBe('behavior')
    expect(kind(file('src/old.test.ts', { status: 'removed' }))).toBe('test')
  })

  it('keeps a move of code, whatever the content, but not a move of a doc', () => {
    const moved = file('src/platform/ui/Card.tsx', {
      status: 'renamed',
      previous_filename: 'src/modules/events/ui/Card.tsx',
    })
    expect(kind(moved)).toBe('behavior')
    const doc = file('docs/b.md', { status: 'renamed', previous_filename: 'docs/a.md' })
    expect(kind(doc)).toBe('doc')
  })

  it('does not let a doc name hide a move out of code', () => {
    const f = file('docs/a.md', { status: 'renamed', previous_filename: 'src/a.ts' })
    expect(kind(f)).toBe('behavior')
  })
})

describe('package.json', () => {
  const bump = (from, to) => patch(`-    "zod": "${from}",`, `+    "zod": "${to}",`)

  it('exempts a patch-level dependency bump', () => {
    expect(kind(file('package.json', { patch: bump('^3.22.1', '^3.22.4') }))).toBe('exempt')
    expect(isPatchBumpOnly(bump('3.22.1', '3.22.4'))).toBe(true)
  })

  it.each([
    ['a minor bump', bump('^3.22.1', '^3.23.0')],
    ['a major bump', bump('^3.22.1', '^4.0.0')],
    ['a new dependency', patch('+    "zod": "^3.22.4",')],
    [
      'a script change',
      patch('-    "build": "next build",', '+    "build": "next build --turbo",'),
    ],
    ['the package version', patch('-  "version": "1.0.1",', '+  "version": "1.0.2",')],
  ])('keeps %s', (_name, diff) => {
    expect(kind(file('package.json', { patch: diff }))).toBe('behavior')
  })
})

describe('classifyChanges', () => {
  it('splits a PR into behavior-bearing files and docs', () => {
    const result = classifyChanges([
      file('src/a.ts', { patch: patch('-a', '+b') }),
      file('src/a.test.ts', { patch: patch('-a', '+b') }),
      file('docs/x.md'),
      file('package-lock.json'),
    ])
    expect(result.behavior.map((f) => f.filename)).toEqual(['src/a.ts'])
    expect(result.docs.map((f) => f.filename)).toEqual(['docs/x.md'])
  })
})
