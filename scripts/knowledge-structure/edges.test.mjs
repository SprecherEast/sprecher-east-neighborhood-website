/** Rare inputs the fifth review ran through the check: each changes what is reported. */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { execute } from './cli.mjs'
import { parseNote } from './note.mjs'
import { existsExactly, pathReferences, resolves } from './paths.mjs'
import { checkNote } from './rules.mjs'
import {
  GOOD_BODY,
  GOOD_FIELDS,
  GOOD_FILES,
  NOTE_PATH,
  fixture,
  goodNote,
  messagesOf,
  removeFixtures,
  repo,
  schema,
  strict,
} from './testkit.mjs'

const tokens = (body) => pathReferences(body, schema).map((r) => r.token)
const withBody = (body) => parseNote(`---\nname: a\n---\n${body}`)
const found = (text, rule) =>
  messagesOf(checkNote({ schema: strict, path: NOTE_PATH, text, files: GOOD_FILES }), rule)
const LONG = 'a'.repeat(90)

describe('code spans and backticks', () => {
  it('reads a path in a double-backtick span, and one after a token that is not a path', () => {
    expect(tokens('See ``src/a.ts`` and ``src/b.ts`.')).toEqual(['src/a.ts', 'src/b.ts'])
    expect(tokens('See `config#anchor` and `src/a.ts`.')).toEqual(['src/a.ts'])
  })

  it('reads a one-letter folder', () => {
    expect(tokens('`x/` and `y`')).toEqual(['x/'])
    const ctx = { noteDir: 'a/b', files: ['x/f.ts'], schema }
    expect(resolves('/x/', ctx)).toBe(true)
    expect(resolves('./../../x', ctx)).toBe(true)
  })
})

describe('a long folder', () => {
  const files = [`src/x/${LONG}/y.ts`]
  const ctx = { noteDir: 'src/modules/demo', files, schema }

  it('is a path, with or without its closing slash, from the root or the note', () => {
    expect(resolves(`/src/x/${LONG}/`, ctx)).toBe(true)
    expect(resolves(`/src/x/${LONG}`, ctx)).toBe(true)
    expect(resolves(`../../x/${LONG}/`, ctx)).toBe(true)
    expect(resolves(`/src/x/${LONG}z/`, ctx)).toBe(false)
  })
})

describe('a line end that is not a newline', () => {
  it('leaves a separator inside a heading line out of the heading', () => {
    const note = withBody('# T\n\nWhat.\n\n## Screens tail\n\n## Boundaries x\n')
    expect(note.sections.map((s) => s.heading)).toEqual(['Screens', 'Boundaries'])
  })

  it('does not take a carriage return before backticks for a fence', () => {
    const note = withBody('# T\n\nintro\r```\n\n## Screens\n\n- x\n')
    expect(note.sections.map((s) => s.heading)).toEqual(['Screens'])
  })
})

describe('a line terminator inside a line, and letter case', () => {
  const frontmatter = '---\nname: a\n---\n'

  it('does not start a title, heading or purpose after one', () => {
    expect(parseNote(`${frontmatter}x\r# T\n`).title).toBeNull()
    expect(parseNote(`${frontmatter}# T\n\nfoo\r## Bar\n`).sections).toEqual([])
  })

  it('counts the lines the way a newline separates them', () => {
    expect(parseNote(`${frontmatter}a \n\nb`).bodyLines).toBe(3)
    expect(parseNote(`${frontmatter}a\n b`).bodyLines).toBe(2)
  })

  it('does not read front matter that starts after one', () => {
    expect(parseNote('intro ---\nname: a\n---\n').data).toEqual({})
  })

  it('does not take a token with one for a path, or a capital extension for a file', () => {
    expect(tokens('`src/a.ts\rjunk junk` `zzz/A.TS`')).toEqual([])
  })

  it('counts text next to a comment, and nothing inside one, on one line or several', () => {
    const purposes = (text) => withBody(`# T\n\n${text}\n\n## Screens\n`).purposeLines
    expect(purposes('<!-- b -->')).toBe(0)
    expect(purposes('<!-- a\u2028b -->')).toBe(0)
    expect(purposes('text\u2028<!-- b -->')).toBe(1)
    expect(purposes('<!-- b --> text')).toBe(1)
    expect(purposes('text <!-- b -->')).toBe(1)
    expect(purposes('<!-- a --> <!-- b -->')).toBe(0)
    expect(purposes('<!-- a --> text <!-- b -->')).toBe(1)
    expect(purposes('<!--\nTODO\nmore\n-->')).toBe(0)
    expect(purposes('<!-- a\nb --> text')).toBe(1)
    expect(purposes('<!--\n## Hidden\n-->\nreal')).toBe(1)
  })

  it('reads every comment on a line, and only whole `<!--` and `-->`', () => {
    const sections = (text) => withBody(`# T\n\nintro\n\n${text}\n`).sections.map((s) => s.heading)
    expect(sections('<!-- a --> x <!-- b -->\n## Screens')).toEqual(['Screens'])
    expect(sections('<!- a\n## Screens')).toEqual(['Screens'])
    expect(sections('<!--\nfoo -> bar\n## Hidden\n-->\n## Screens')).toEqual(['Screens'])
    expect(sections('<!-- x -->## y')).toEqual(['y'])
    expect(sections('##<!-- -->Foo')).toEqual([])
    expect(sections('<!--\n```\n-->\n\n## Screens')).toEqual(['Screens'])
    expect(sections('<!-- a\u2028b --> x <!-- b -->\n## Screens')).toEqual(['Screens'])
  })

  it('does not count what follows a comment as a purpose when it is a title or a heading', () => {
    const purposes = (text) => withBody(`# T\n\n${text}\n\n## Screens\n`).purposeLines
    expect(purposes('<!-- x --># y')).toBe(0)
    expect(purposes('<!- a')).toBe(1)
    expect(purposes('<!--\nfoo -> bar\n-->\nreal')).toBe(1)
  })

  it('wants the title first: a comment before it is not allowed', () => {
    const note = goodNote(GOOD_FIELDS, `<!-- x -->\n${GOOD_BODY}`)
    expect(found(note, 'NOTE-TITLE')).toEqual(['the body must start with a level 1 title'])
  })

  it('takes only `<!--` and `-->` for a comment, an empty one included', () => {
    const purposes = (text) => withBody(`# T\n\n${text}\n\n## Screens\n`).purposeLines
    const sections = (text) => withBody(`# T\n\nintro\n\n${text}\n`).sections.map((s) => s.heading)
    expect(purposes('<!- a -->')).toBe(1)
    expect(purposes('<!-- a -> b -->')).toBe(0)
    expect(purposes('x<!-- a\n-->')).toBe(1)
    expect(sections('<!---->\n## Screens')).toEqual(['Screens'])
    expect(sections('## Screens <!-- a <!-- b')).toEqual(['Screens'])
  })

  it('closes a comment at its first end marker', () => {
    const body = '# T\n\n<!--\nx --> a --> <!-- open\n-->\n\n## Screens\n'
    expect(withBody(body).purposeLines).toBe(1)
  })

  it('leaves a fence only at its closing line, however many lines it holds', () => {
    const body = (lines) => `# T\n\nintro\n\n\`\`\`\n${lines}\n\`\`\`\n\n## Screens\n`
    const note = withBody(body('one\ntwo\n## Hidden\n`src/x.ts`\nfour'))
    expect(note.sections.map((s) => s.heading)).toEqual(['Screens'])
    expect(note.purposeLines).toBe(1)
    const bare = withBody('# T\n\n```\none\ntwo\nthree\n```\n')
    expect(bare.purposeLines).toBe(0)
  })

  it('counts a purpose of one character', () => {
    expect(withBody('# T\n\nx\n\n## Screens\n').purposeLines).toBe(1)
  })
})

describe('an ignored path', () => {
  it('counts as existing though no file is there, with or without a leading `.../`', () => {
    const ctx = { noteDir: 'd', files: [], schema }
    expect(resolves('node_modules/x/y.ts', ctx)).toBe(true)
    expect(resolves('.../node_modules/x/y.ts', ctx)).toBe(true)
    expect(resolves('src/x/y.ts', ctx)).toBe(false)
  })
})

describe('a path with a line terminator inside it', () => {
  const ctx = (files) => ({ noteDir: 'd', files, schema })

  it('keeps the slash before it, and does not read a prefix that comes after it', () => {
    expect(existsExactly('src/\ry', ['src\ry'])).toBe(false)
    expect(existsExactly('a/ b', ['a b'])).toBe(false)
    expect(resolves('x\r.../y', ctx(['x\ry']))).toBe(false)
    expect(resolves('x\r../y', ctx(['x\r../y']))).toBe(true)
    expect(resolves('a/\rb', ctx(['a\rb/x']))).toBe(false)
  })
})

describe('findings that do not depend on how long a path is', () => {
  const SHORT = 'src/x/README.md'
  const entry = { note: SHORT, paths: ['src/x/**'] }

  it('reports a short note listed twice, and one that does not exist', () => {
    const files = [...GOOD_FILES, SHORT, 'src/x/a.ts']
    const twice = JSON.stringify([entry, entry])
    expect(
      messagesOf(repo({ map: twice, files, texts: { [SHORT]: goodNote() } }), 'MAP-NOTE'),
    ).toEqual(['listed twice in docs/knowledge/map.json'])
    expect(messagesOf(repo({ map: JSON.stringify([entry]) }), 'MAP-NOTE')).toEqual([
      'listed in docs/knowledge/map.json but the file does not exist',
    ])
  })

  it('reports an expected section only when it is not written', () => {
    const section = (heading) => `## ${heading}\n\n- x\n`
    const gaps = (before, after) =>
      found(goodNote(GOOD_FIELDS, `${before}${GOOD_BODY}\n${after}`), 'COVERAGE-SECTION').join('|')
    expect(gaps('', '')).toContain('"Boundaries"')
    const written = gaps(section('Screens'), `${section('Boundaries')}\n${section('Known gaps')}`)
    expect(written).not.toContain('"Screens"')
    expect(written).not.toContain('"Boundaries"')
    expect(written).not.toContain('"Known gaps"')
    expect(written).toContain('"Decisions"')
  })
})

describe('what a note with one thing wrong reports', () => {
  it('a relationship target of 81 or more characters that does not exist', () => {
    const relationships = [{ type: 'depends-on', target: `src/${LONG}` }]
    expect(found(goodNote({ ...GOOD_FIELDS, relationships }), 'NOTE-RELATIONSHIP-TARGET')).toEqual([
      `relationship target src/${LONG} is not a repository path that exists`,
    ])
  })

  it('a derived type with a short target is still a derived type', () => {
    const relationships = [{ type: 'reads', target: 'src' }]
    expect(found(goodNote({ ...GOOD_FIELDS, relationships }), 'NOTE-RELATIONSHIP')).toEqual([
      'the scanner derives "reads" (the routes and content-type references); do not write it',
    ])
  })

  it('a note whose only field is an unknown one', () => {
    expect(found(goodNote({ extra: 'x' }), 'NOTE-FIELDS')).toEqual([
      'missing field name, type, summary, aliases, relationships',
      'unknown field extra',
    ])
  })

  it('a line that is only an HTML comment is not a purpose', () => {
    const body = '# Demo\n\n<!-- TODO -->\n\n## Behaviors and events\n\n- x\n'
    expect(found(goodNote(GOOD_FIELDS, body), 'NOTE-TITLE')).toEqual([
      'the title needs a purpose paragraph before the first section',
    ])
    expect(withBody('# T\n\n  <!-- a -->  \n\nReal text.\n\n## S\n').purposeLines).toBe(1)
    expect(withBody('# T\n\n<!-- a --> and text\n\n## S\n').purposeLines).toBe(1)
  })
})

describe('the command', () => {
  afterEach(removeFixtures)

  it('--write-index keeps a note whose name is 30 to 40 characters', () => {
    const name = 'n'.repeat(35)
    const root = fixture({ note: goodNote({ ...GOOD_FIELDS, name }), index: '# I\n\n## Notes\n\n' })
    const lines = []
    execute({ argv: ['--write-index'], root, log: (l) => lines.push(l) })
    expect(lines).toEqual(['Wrote the 1 note lines of docs/knowledge/index.md.'])
    expect(fs.readFileSync(path.join(root, 'docs/knowledge/index.md'), 'utf8')).toContain(
      `[${name}]`,
    )
  })

  it('prints the counts before it fails to write them to an unwritable summary', () => {
    const root = fixture()
    const lines = []
    const env = { GITHUB_STEP_SUMMARY: path.join(root, 'no/such/dir/summary.md') }
    expect(() => execute({ argv: [], root, env, log: (l) => lines.push(l) })).toThrow()
    expect(lines.at(-1)).toMatch(/^Knowledge structure: /)
  })
})
