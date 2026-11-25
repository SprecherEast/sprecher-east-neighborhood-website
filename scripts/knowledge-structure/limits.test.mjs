/** Inputs a note can really hold that are long, rare in shape, or that raise two findings at once. */
import { describe, expect, it } from 'vitest'

import { noteLinesOf, renderIndex } from './indexLines.mjs'
import { parseNote } from './note.mjs'
import { pathReferences, resolves } from './paths.mjs'
import { GOOD_FILES, goodNote, messagesOf, repo, schema } from './testkit.mjs'

const tokens = (body) => pathReferences(body, schema).map((r) => r.token)
const withBody = (body) => parseNote(`---\nname: a\n---\n${body}`)
const LONG = 'a'.repeat(70)

describe('a fence', () => {
  it('opens on two fences in a row, on a long info string, and on the first line', () => {
    expect(withBody('```\n```\n\n## Shown\n').sections.map((s) => s.heading)).toEqual(['Shown'])
    expect(
      withBody(`~~~${LONG}\n## Hidden\n~~~\n\n## Shown\n`).sections.map((s) => s.heading),
    ).toEqual(['Shown'])
    expect(withBody('~~~\n## Hidden\n~~~\n').purposeLines).toBe(1)
    expect(tokens('~~~ `src/x.ts`\n`src/y.ts`\n~~~\n`src/z.ts`')).toEqual(['src/z.ts'])
    expect(tokens(`~~~${LONG}\n\`src/y.ts\`\n~~~\n\`src/z.ts\``)).toEqual(['src/z.ts'])
  })

  it('is three backticks or three tildes, not two, and not inline code or strikethrough', () => {
    const body = '``code`` first\n\n## A\n\n~~gone~~ text\n\n## B\n'
    expect(withBody(body).sections.map((s) => s.heading)).toEqual(['A', 'B'])
    expect(tokens('``x`` first\n`src/a.ts`\n~~y~~ `src/b.ts`')).toEqual(['src/a.ts', 'src/b.ts'])
  })
})

describe('a note with Windows line ends', () => {
  it('has a body with plain line ends, with and without front matter', () => {
    expect(parseNote('# T\r\n\r\nWhat.\r\n').body).toBe('# T\n\nWhat.\n')
    expect(parseNote('---\r\nname: a\r\n---\r\n# T\r\n\r\nWhat.\r\n').body).toBe('# T\n\nWhat.\n')
  })
})

describe('headings and purpose', () => {
  it('takes a heading of any length, and one on the first line of the body', () => {
    const note = withBody(`## First\n\n## ${LONG} ${LONG}\n`)
    expect(note.sections.map((s) => s.line)).toEqual([1, 3])
    expect(note.title).toBeNull()
  })

  it('counts a purpose line that is the first line of the body', () => {
    expect(withBody('Just text.\n\n## S\n').purposeLines).toBe(1)
  })

  it('reads a body with blank lines inside it as many lines, and one with none up front', () => {
    expect(withBody('# T\n\nWhat.\n\n## S\n\nx\n').bodyLines).toBe(7)
    expect(withBody('\n\n# T\n\nWhat.\n').bodyLines).toBe(3)
  })
})

describe('what is taken from a path or a link', () => {
  it('takes a hyphenated name, and a link target with a comma, a colon or a closing bracket', () => {
    expect(tokens('`scripts/agent-context-maps.mjs`')).toEqual(['scripts/agent-context-maps.mjs'])
    expect(tokens('[a](docs/a,b.md) [b](a,b:c.md) [c](:x.md)')).toEqual([
      'docs/a,b.md',
      'a,b:c.md',
      ':x.md',
    ])
    expect(tokens('[a](x.md)(y.md)')).toEqual(['x.md'])
  })

  it('does not take text before a lone backtick, or a lone backtick and what follows it', () => {
    expect(tokens('src/a.ts` then')).toEqual([])
    expect(tokens('`src/a.ts then')).toEqual([])
    expect(tokens('`a b`src/c.ts`')).toEqual([])
    expect(tokens('`a,b`src/c.ts`')).toEqual([])
  })

  it('takes a long link target and a long backticked path', () => {
    expect(tokens(`[a](docs/${LONG}.md)`)).toEqual([`docs/${LONG}.md`])
  })
})

describe('resolves, for long paths and for paths that only look like a prefix', () => {
  const files = [
    `src/x/${LONG}/y.ts`,
    `src/app/(frontend)/${LONG}/[slug]/page.tsx`,
    'src/y/.a/rule.ts',
    'src/y/..../y.ts',
    'node_modules/a.js',
  ]
  const ctx = { noteDir: 'src/x', files, schema }

  it.each([
    [`/src/x/${LONG}/y.ts`, true],
    [`./${LONG}/y.ts`, true],
    [`../x/${LONG}/y.ts`, true],
    [`src/x/${LONG}/*.ts`, true],
    [`node_modules/${LONG}/b.js`, true],
    ['.a/rule.ts', true], // a hidden folder of one letter is not ./
    ['..../y.ts', true], // four dots are not ../
    [`/src/app/(frontend)/${LONG}/[slug]/page.tsx`, true],
    ['x../y.ts', false], // three dots only start a token
    ['.x./y.ts', false],
    ['..x/y.ts', false],
    ['.x../y.ts', false],
    ['..x./y.ts', false],
  ])('%s is %s', (token, expected) => {
    expect(resolves(token, ctx)).toBe(expected)
  })
})

describe('the index and the map', () => {
  it('ends the Notes lines at a heading of any length, and keeps a line that ends with two returns', () => {
    const long = `## ${LONG} ${LONG}`
    expect(noteLinesOf(`# I\n\n## Notes\n\n- a\n\n${long}\n\n- b\n`, 'i.md')).toEqual(['- a'])
    expect(() => noteLinesOf('## Notes\r\r\n- a\r\n', 'i.md')).toThrow(/no "## Notes"/)
    expect(() => renderIndex('## Notes\r\r\n- a\r\n', [], 'i.md')).toThrow(/no "## Notes"/)
  })

  it('names a note listed twice and missing twice, once for each time after the first', () => {
    const twice = JSON.stringify([
      { note: 'src/modules/gone/README.md', paths: ['src/x/**'] },
      { note: 'src/modules/gone/README.md', paths: ['src/x/**'] },
    ])
    const found = repo({ map: twice }).filter((f) => f.rule === 'MAP-NOTE')
    expect(found.map((f) => f.message)).toEqual([
      'listed in docs/knowledge/map.json but the file does not exist',
      'listed twice in docs/knowledge/map.json',
      'listed in docs/knowledge/map.json but the file does not exist',
    ])
  })

  it('finds an orphan note, and a source file, at a long path', () => {
    const orphan = `src/modules/${LONG}/README.md`
    const found = repo({ texts: { [orphan]: goodNote() } })
    expect(messagesOf(found, 'NOTE-ORPHAN')).toEqual(['no map entry names this note'])
    const files = [...GOOD_FILES, `src/${LONG}/${LONG}.ts`, 'src/a/B.TS']
    const [loose] = messagesOf(repo({ schema, files }), 'COVERAGE-CODE')
    expect(loose).toBe(`1 source files have no note: src/${LONG}/${LONG}.ts 1`)
  })
})
