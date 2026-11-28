/** The patterns the check reads notes with, pinned by inputs a note really holds. */
import { describe, expect, it } from 'vitest'

import { parseNote } from './note.mjs'
import { existsExactly, pathReferences, resolves } from './paths.mjs'
import { noteLinesOf, renderIndex } from './indexLines.mjs'
import { checkNote } from './rules.mjs'
import {
  GOOD_BODY,
  GOOD_FIELDS,
  GOOD_FILES,
  NOTE_PATH,
  goodNote,
  schema,
  strict,
} from './testkit.mjs'

const tokens = (body) => pathReferences(body, schema).map((r) => r.token)
const withBody = (body) => parseNote(`---\nname: a\n---\n${body}`)

describe('paths a note writes in backticks', () => {
  it('takes a route group, a dynamic segment and a scoped folder', () => {
    const body = [
      '`src/app/(frontend)/auth/[provider]/route.test.ts`',
      '`src/@scope/lib.ts`',
      '`app/[slug]/page.tsx`',
      '`src/app/(payload)/`',
      '`pkg@1.ts`',
    ].join(' ')
    expect(tokens(body)).toEqual([
      'src/app/(frontend)/auth/[provider]/route.test.ts',
      'src/@scope/lib.ts',
      'app/[slug]/page.tsx',
      'src/app/(payload)/',
      'pkg@1.ts',
    ])
  })

  it('leaves out text that is not a path, whole: the whole token must look like one', () => {
    expect(tokens('`src/a.ts b` `x src/a.ts` `src/a!.ts` `src/a$b.ts` `src/a,b.ts`')).toEqual([])
  })

  it('takes a long path as well as a short one', () => {
    const long = `src/${'a'.repeat(80)}/x.ts`
    expect(tokens(`\`${long}\``)).toEqual([long])
  })

  it('reads an extension as the end of the token, after a dot', () => {
    expect(tokens('`a/b.mdx` `a/b.tsx.snap` `thoughts` `hearts` `a/b.md.bak`')).toEqual([])
    expect(tokens('`a/b.md` `a.tsx`')).toEqual(['a/b.md', 'a.tsx'])
  })

  it('leaves out a route and an alias, but takes a scoped package path', () => {
    expect(tokens('`/posts/x.ts` `@/modules/x.ts` `@scope/x.ts`')).toEqual(['@scope/x.ts'])
  })
})

describe('links a note writes', () => {
  it('takes a link to a file with a known extension, and not a web address in any case', () => {
    expect(tokens('[a](x.md#top) [b](../y.MD) [c](HTTPS://a.dev/x.md) [d](mailto:x@a.md)')).toEqual(
      ['x.md'],
    )
  })

  it('leaves out a link with a space in its target and one with a folder or an unknown extension', () => {
    expect(tokens('[a](my file.md) [b](../shared/) [c](../LICENSE) [d](x.mdx)')).toEqual([])
  })
})

describe('existsExactly', () => {
  it('does not count a target that ends in two slashes', () => {
    expect(existsExactly('src/modules/', ['src/modules/demo/README.md'])).toBe(true)
    expect(existsExactly('src/modules//', ['src/modules/demo/README.md'])).toBe(false)
  })
})

describe('resolves, for what a note writes in a route group or a scoped folder', () => {
  const files = ['src/app/(frontend)/auth/[provider]/route.test.ts', 'src/@scope/lib.ts']
  const ctx = { noteDir: 'src/modules/accounts', files, schema }
  it.each([
    ['src/app/(frontend)/auth/[provider]/route.test.ts', true],
    ['src/app/(frontend)/auth/[provider]/missing.ts', false],
    ['src/app/(frontend)/nope/page.tsx', false],
    ['src/app/[slug]/missing.tsx', false],
    ['src/@scope/lib.ts', true],
    ['src/@scope/missing.ts', false],
  ])('%s is %s', (token, expected) => {
    expect(resolves(token, ctx)).toBe(expected)
  })

  it('never looks for files the schema ignores', () => {
    expect(resolves('node_modules/a/b.js', ctx)).toBe(true)
    expect(resolves('storybook-static/x/y.html', ctx)).toBe(true)
    expect(resolves('.env.local', ctx)).toBe(true)
    expect(resolves('src/node_modules/a.js', ctx)).toBe(false)
  })
})

describe('a note body, line by line', () => {
  it('skips what a tilde fence holds, as it does for a backtick fence', () => {
    const note = withBody(
      '# T\n\nWhat.\n\n~~~md\n## Not a section\n~~~\n\n## Behaviors and events\n',
    )
    expect(note.sections.map((s) => s.heading)).toEqual(['Behaviors and events'])
  })

  it('skips a fence that opens on the first line of the body', () => {
    expect(withBody('```\n## Hidden\n```\n\n## Shown\n').sections.map((s) => s.heading)).toEqual([
      'Shown',
    ])
    expect(tokens('~~~\n`src/hidden.ts`\n~~~\n`src/shown.ts`')).toEqual(['src/shown.ts'])
  })

  it('does not take a bare hash, or hashes with nothing after them, for a title or a section', () => {
    const note = withBody('#\n\nWhat.\n\n##\n\n## \n\n###\n')
    expect(note.title).toBeNull()
    expect(note.sections).toEqual([])
    expect(withBody('# \n\nWhat.\n').title).toBeNull()
    expect(withBody('#Tag\n').title).toBeNull()
  })

  it('takes a level 2 heading only at the start of a line, and not a level 3', () => {
    const note = withBody('# T\n\nWhat.\n\n ## Indented\n\n### Deeper\n\n## Real\n')
    expect(note.sections).toEqual([{ heading: 'Real', line: 9 }])
  })

  it('counts the lines of purpose before the first section, not headings of any level', () => {
    expect(withBody('# T\n\n### Sub\n\nOne.\nTwo.\n\n## S\n\nNot counted.\n').purposeLines).toBe(2)
  })
})

describe('the lines under Notes in the index', () => {
  it('end at the next level 2 heading, not at a level 3 one', () => {
    const text =
      '# I\n\n## Notes\n\n- [a](a.md): x\n\n### Extra\n\n- [b](b.md): y\n\n## Other\n\n- z\n'
    expect(noteLinesOf(text, 'i.md')).toEqual(['- [a](a.md): x', '### Extra', '- [b](b.md): y'])
    expect(renderIndex(text, [], 'i.md')).toBe('# I\n\n## Notes\n\n\n## Other\n\n- z\n')
  })

  it('start only at the exact Notes heading', () => {
    expect(() => noteLinesOf('# I\n\n## Notes and more\n\n- a\n', 'i.md')).toThrow(/no "## Notes"/)
    expect(() => noteLinesOf('# I\n\n## Note\n', 'i.md')).toThrow(/no "## Notes"/)
  })
})

describe('the type of a note', () => {
  it.each([['[module]'], ['5'], ['{ a: 1 }'], ['bogus']])(
    'with type %s gives the type finding and no section finding',
    (type) => {
      const text = goodNote({ ...GOOD_FIELDS, type }, GOOD_BODY + '\n## Screens\n\n- x\n')
      const rules = checkNote({ schema: strict, path: NOTE_PATH, text, files: GOOD_FILES }).map(
        (f) => f.rule,
      )
      expect(rules).toEqual(['NOTE-TYPE'])
    },
  )
})
