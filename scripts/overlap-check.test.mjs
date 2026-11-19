import { describe, expect, it } from 'vitest'

import {
  checkOverlap,
  formatClashes,
  hotSpotsTouched,
  normalizeIssue,
  parseDeclared,
  pathsOverlap,
} from './overlap-check.mjs'

/** An issue body the way the issue forms write it */
const body = (files, mustNot) =>
  [
    '### Summary',
    'text',
    '### Files likely touched',
    files,
    '### Must not touch',
    mustNot,
    '### Area',
    'tooling',
  ].join('\n\n')

const issue = (number, files, extra = {}) => normalizeIssue({ number, files, ...extra })

describe('parseDeclared: the two sections of an issue body', () => {
  it('reads backticked paths from both sections', () => {
    const parsed = parseDeclared(
      body('`src/a/` and `src/b/file.ts`, `AGENTS.md`', 'Source code, `.github/`'),
    )
    expect(parsed.files).toEqual(['src/a', 'src/b/file.ts', 'AGENTS.md'])
    expect(parsed.mustNotTouch).toEqual(['.github'])
  })

  it('ignores backticked words that are not paths', () => {
    expect(parseDeclared(body('`disallowedTools` in `x/y.md`', 'None')).files).toEqual(['x/y.md'])
  })

  it('treats None as declared and empty', () => {
    const parsed = parseDeclared(body('None', 'none.'))
    expect(parsed.files).toEqual([])
    expect(parsed.mustNotTouch).toEqual([])
  })

  it('returns null for a missing section, and for one with prose only', () => {
    expect(parseDeclared('### Summary\n\ntext').files).toBeNull()
    expect(parseDeclared(body('whatever fits', 'None')).files).toBeNull()
  })

  it('stops a section at the next heading and tolerates Windows line endings', () => {
    const parsed = parseDeclared(body('`a/b.ts`', 'None').replace(/\n/g, '\r\n'))
    expect(parsed.files).toEqual(['a/b.ts'])
  })

  it('is deterministic: the same body gives the same answer', () => {
    const text = body('`b.ts` `a.ts`', 'None')
    expect(parseDeclared(text)).toEqual(parseDeclared(text))
  })
})

describe('pathsOverlap: one path inside the other, or the same', () => {
  it('matches equal paths and a folder with a path under it', () => {
    expect(pathsOverlap('src/a', 'src/a')).toBe(true)
    expect(pathsOverlap('src/a', 'src/a/b/c.ts')).toBe(true)
    expect(pathsOverlap('src/a/b/c.ts', 'src/a')).toBe(true)
  })

  it('does not match a name that merely starts the same', () => {
    expect(pathsOverlap('src/a', 'src/ab/c.ts')).toBe(false)
    expect(pathsOverlap('docs/x.md', 'docs/x.mdx')).toBe(false)
  })

  it('reads a glob as its folder, so it never misses a clash', () => {
    expect(pathsOverlap('src/modules/events/**', 'src/modules/events/ui/Card.tsx')).toBe(true)
    expect(pathsOverlap('src/modules/events/ui/Event*.tsx', 'src/modules/events/ui')).toBe(true)
    expect(pathsOverlap('src/**/cms.ts', 'src/platform/x.ts')).toBe(true)
    expect(pathsOverlap('src/modules/news/*', 'src/modules/events/x.ts')).toBe(false)
  })

  it('treats ./ and a leading slash as noise', () => {
    expect(pathsOverlap('./src/a/', '/src/a/b.ts')).toBe(true)
  })
})

describe('hotSpotsTouched', () => {
  it('names the group, once, however many paths hit it', () => {
    const hit = hotSpotsTouched(['src/platform/ui/Button.tsx', 'src/platform/lib/x.ts'])
    expect(hit).toHaveLength(1)
    expect(hotSpotsTouched(['src/modules/news/ui/Card.tsx'])).toEqual([])
  })

  it('knows the process files, the schema files and the dependency files', () => {
    expect(hotSpotsTouched(['AGENTS.md']).length).toBe(1)
    expect(hotSpotsTouched(['src/migrations/x.ts']).length).toBe(1)
    expect(hotSpotsTouched(['package-lock.json']).length).toBe(1)
    expect(hotSpotsTouched(['src/modules/site/cms/navGlobal.ts']).length).toBe(1)
    expect(hotSpotsTouched(['src/modules/site/data/globals.ts']).length).toBe(1)
  })
})

describe('checkOverlap: the same input always gives the same clashes', () => {
  it('reports no clash for work in different places', () => {
    const clashes = checkOverlap([
      issue(1, ['src/modules/news/ui']),
      issue(2, ['src/modules/events/ui']),
    ])
    expect(clashes).toEqual([])
  })

  it('reports a shared file or folder', () => {
    const clashes = checkOverlap([
      issue(1, ['src/modules/news']),
      issue(2, ['src/modules/news/ui/Card.tsx']),
    ])
    expect(clashes).toHaveLength(1)
    expect(clashes[0]).toMatchObject({ kind: 'files', issues: [1, 2] })
  })

  it('reports two issues that each touch a hot spot, even the same one in different files', () => {
    const clashes = checkOverlap([
      issue(1, ['src/platform/ui/Button.tsx']),
      issue(2, ['src/platform/lib/dates.ts']),
    ])
    expect(clashes.map((c) => c.kind)).toEqual(['hot-spot'])
  })

  it('reports two issues that touch different hot spots, as the written rule says', () => {
    const clashes = checkOverlap([issue(1, ['package.json']), issue(2, ['AGENTS.md'])])
    expect(clashes).toEqual([
      expect.objectContaining({
        kind: 'hot-spot',
        issues: [1, 2],
        detail: '#1 touches dependencies; #2 touches process files',
      }),
    ])
  })

  it('does not report a hot spot when only one issue touches one', () => {
    expect(checkOverlap([issue(1, ['package.json']), issue(2, ['src/modules/news'])])).toEqual([])
  })

  it('reports a blocker that is in the set', () => {
    const clashes = checkOverlap([
      issue(1, ['src/modules/news']),
      issue(2, ['src/modules/events'], { blockedBy: [1] }),
    ])
    expect(clashes).toEqual([expect.objectContaining({ kind: 'blocked', issues: [1, 2] })])
  })

  it('ignores a blocker that is not in the set', () => {
    expect(checkOverlap([issue(2, ['src/modules/events'], { blockedBy: [99] })])).toEqual([])
  })

  it('refuses an issue that declared nothing, since nothing can be checked', () => {
    const clashes = checkOverlap([normalizeIssue({ number: 3, body: '### Summary\n\nx' })])
    expect(clashes).toEqual([expect.objectContaining({ kind: 'undeclared', issues: [3] })])
  })

  it('reports an issue that lists a path in both sections', () => {
    const clashes = checkOverlap([
      issue(4, ['src/modules/news/ui'], { mustNotTouch: ['src/modules/news'] }),
    ])
    expect(clashes).toEqual([expect.objectContaining({ kind: 'contradiction', issues: [4] })])
  })

  it('compares only the candidate against the rest when one is named', () => {
    const set = [issue(1, ['src/a']), issue(2, ['src/a']), issue(3, ['src/a/b'])]
    expect(checkOverlap(set, { candidate: 3 }).map((c) => c.issues)).toEqual([
      [1, 3],
      [2, 3],
    ])
    expect(checkOverlap(set).map((c) => c.issues)).toEqual([
      [1, 2],
      [1, 3],
      [2, 3],
    ])
  })

  it('gives the same order whatever order the issues come in', () => {
    const set = [issue(5, ['src/a']), issue(2, ['src/a']), issue(9, ['src/a'])]
    expect(checkOverlap(set)).toEqual(checkOverlap([...set].reverse()))
  })

  it('lists one line per clash, ending the same way every time', () => {
    const lines = formatClashes(checkOverlap([issue(1, ['src/a']), issue(2, ['src/a/b'])]))
    expect(lines).toEqual(['#1 / #2 files: src/a (#1) overlaps src/a/b (#2)'])
  })
})
