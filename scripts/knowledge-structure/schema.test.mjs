/** What the check reads from the real schema: a value changed there changes what is reported. */
import { describe, expect, it } from 'vitest'

import { pathReferences } from './paths.mjs'
import { checkNote } from './rules.mjs'
import {
  GOOD_BODY,
  GOOD_FIELDS,
  GOOD_FILES,
  NOTE_PATH,
  goodNote,
  repo,
  schema,
  strict,
} from './testkit.mjs'

const found = (text, rule) =>
  checkNote({ schema: strict, path: NOTE_PATH, text, files: GOOD_FILES })
    .filter((f) => f.rule === rule)
    .map((f) => f.message)

describe('the limits', () => {
  it.each([
    ['name', 40],
    ['summary', 200],
  ])('a %s of %i characters passes and one more fails', (key, limit) => {
    const at = goodNote({ ...GOOD_FIELDS, [key]: 'x'.repeat(limit) })
    const over = goodNote({ ...GOOD_FIELDS, [key]: 'x'.repeat(limit + 1) })
    expect(found(at, 'NOTE-FIELD-VALUE')).toEqual([])
    expect(found(over, 'NOTE-FIELD-VALUE')).toEqual([
      `${key} must be one line of text, at most ${limit} characters`,
    ])
  })

  it('a note of 80 lines below its fields passes and one of 81 fails', () => {
    const body = (lines) =>
      GOOD_BODY.trimEnd() + '\n' + '- x\n'.repeat(lines - GOOD_BODY.trimEnd().split('\n').length)
    expect(GOOD_BODY.trimEnd().split('\n').length).toBeLessThan(80)
    expect(found(goodNote(GOOD_FIELDS, body(80)), 'NOTE-CAP')).toEqual([])
    expect(found(goodNote(GOOD_FIELDS, body(81)), 'NOTE-CAP')).toEqual([
      '81 lines below the front matter, over the limit of 80',
    ])
  })
})

describe('the paths a note may name', () => {
  const taken = (token) => pathReferences(`\`${token}\``, schema).length === 1

  it.each([
    'ts',
    'tsx',
    'mjs',
    'cjs',
    'js',
    'json',
    'jsonc',
    'md',
    'scss',
    'css',
    'sh',
    'yml',
    'yaml',
    'html',
    'svg',
    'png',
    'jpg',
    'webp',
  ])('a file ending in .%s is a path', (extension) => {
    expect(taken(`a/b.${extension}`)).toBe(true)
  })

  it.each([
    'src/',
    'docs/',
    'ops/',
    'e2e/',
    'scripts/',
    'public/',
    '.github/',
    '.claude/',
    '.agents/',
    '.storybook/',
    'intelligence/',
  ])('a name under %s is a path without an extension', (root) => {
    expect(taken(`${root}thing`)).toBe(true)
  })

  it('a name under another folder, with no extension, is not', () => {
    expect(taken('other/thing')).toBe(false)
  })
})

describe('the sections', () => {
  it('say how much each is wanted, in the order they are written', () => {
    const wanted = schema.sections.map((s) => `${s.heading}: ${s.presence}`)
    expect(wanted).toEqual([
      'Screens: optional',
      'How the pieces link: expected',
      'Behaviors and events: required',
      'Shared pieces it uses: expected',
      'Rules and the tests that protect them: expected',
      'Boundaries: expected',
      'Decisions: expected',
      'Known gaps: expected',
    ])
  })

  it('give a warning for each expected section a module lacks, and an error for a required one', () => {
    const text = goodNote(GOOD_FIELDS, '# Demo\n\nWhat.\n\n## Behaviors and events\n\n- x\n')
    const said = found(text, 'COVERAGE-SECTION')
    expect(said).toHaveLength(6)
    expect(found(goodNote(GOOD_FIELDS, '# Demo\n\nWhat.\n'), 'NOTE-SECTIONS')).toEqual([
      'missing required section "Behaviors and events"',
    ])
  })
})

describe('the vocabulary', () => {
  it('names the derived relationship types the scanner makes, with where each comes from', () => {
    const rel = (type) =>
      checkNote({
        schema: strict,
        path: NOTE_PATH,
        text: goodNote({ ...GOOD_FIELDS, relationships: [{ type, target: 'src/modules/demo' }] }),
        files: GOOD_FILES,
      })
        .filter((f) => f.rule === 'NOTE-RELATIONSHIP')
        .map((f) => f.message)
    const derived = {
      contains: 'folders and the screens and content-type references',
      renders: 'the components reference',
      reads: 'the routes and content-type references',
      writes: 'the content-type reference and the code',
      calls: 'the routes reference and the code',
      exposes: 'the endpoint and tool references',
      uses: 'imports and the components reference',
      documents: 'docs/knowledge/map.json',
      'decided-by': 'the Decisions section links',
      mentions: 'Markdown links between notes',
    }
    expect(Object.keys(schema.relationshipTypes.derived)).toEqual(Object.keys(derived))
    for (const [type, from] of Object.entries(derived))
      expect(rel(type)).toEqual([`the scanner derives "${type}" (${from}); do not write it`])
    for (const type of Object.keys(schema.relationshipTypes.hand)) expect(rel(type)).toEqual([])
  })

  it('makes every note type a node type, so the scanner needs no second list', () => {
    for (const type of Object.keys(schema.noteTypes))
      expect(Object.keys(schema.nodeTypes.product)).toContain(type)
  })
})

describe('the source files that need a note', () => {
  it('leave out migrations, generated types and stories, and count the rest of src', () => {
    const files = [
      ...GOOD_FILES,
      'src/migrations/20240101_x.ts',
      'src/payload-types.ts',
      'src/a/Card.stories.tsx',
      'src/a/Card.tsx',
    ]
    const found = repo({ schema, files }).filter((f) => f.rule === 'COVERAGE-CODE')
    expect(found.map((f) => f.message)).toEqual(['1 source files have no note: src/a/Card.tsx'])
  })
})
