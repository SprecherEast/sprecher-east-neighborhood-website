/** The wording of each finding, whole: what an author reads in the job log to fix a note. */
import { describe, expect, it } from 'vitest'

import { checkNote } from './rules.mjs'
import {
  GOOD_BODY,
  GOOD_FIELDS,
  GOOD_FILES,
  NOTE_PATH,
  frontmatter,
  goodNote,
  schema,
  strict,
} from './testkit.mjs'

const found = (text, rule) =>
  checkNote({ schema: strict, path: NOTE_PATH, text, files: GOOD_FILES })
    .filter((f) => f.rule === rule)
    .map((f) => f.message)
const withFields = (over) => goodNote({ ...GOOD_FIELDS, ...over })
const withBody = (body) => goodNote(GOOD_FIELDS, body)
const SECTIONS = schema.sections
  .filter((s) => s.appliesTo.includes('module'))
  .map((s) => s.heading)
  .join(', ')

describe('field messages', () => {
  it('names the missing, the unknown and the misplaced fields, and the order wanted', () => {
    const missing = frontmatter({ name: 'Demo', type: 'module', summary: 'x', relationships: [] })
    expect(found(missing + '\n' + GOOD_BODY, 'NOTE-FIELDS')).toEqual(['missing field aliases'])
    expect(found(withFields({ owner: 'x' }), 'NOTE-FIELDS')).toEqual(['unknown field owner'])
    const swapped = frontmatter({ type: 'module', name: 'Demo', ...GOOD_FIELDS, summary: 'x' })
    expect(found(swapped + '\n' + GOOD_BODY, 'NOTE-FIELDS')).toEqual([
      'fields must be in this order: name, type, summary, aliases, relationships',
    ])
  })

  it('lists every missing and every unknown field', () => {
    const few = frontmatter({ name: 'Demo', type: 'module', summary: 'x', owner: 'a', extra: 'b' })
    expect(found(few + '\n' + GOOD_BODY, 'NOTE-FIELDS')).toEqual([
      'missing field aliases, relationships',
      'unknown field owner, extra',
    ])
  })

  it.each([
    ['a list holding a type', '[module]', ['module']],
    ['a number', '5', 5],
    ['an object', '{ a: 1 }', { a: 1 }],
    ['an empty text', '""', ''],
  ])('refuses a type written as %s', (_, type, parsed) => {
    expect(found(withFields({ type }), 'NOTE-TYPE')).toEqual([
      `type ${JSON.stringify(parsed)} is not one of module, platform-area, feature`,
    ])
  })

  it('says what a value must be', () => {
    expect(found(withFields({ type: 'widget' }), 'NOTE-TYPE')).toEqual([
      'type "widget" is not one of module, platform-area, feature',
    ])
    expect(found(withFields({ aliases: 'foo' }), 'NOTE-FIELD-VALUE')).toEqual([
      'aliases must be a list of one-line texts',
    ])
    expect(found(withFields({ relationships: 'foo' }), 'NOTE-FIELD-VALUE')).toEqual([
      'relationships must be a list of { type, target }',
    ])
  })

  it.each([
    ['a summary of spaces', { summary: '"   "' }],
    [
      'a relationship with an empty target',
      { relationships: [{ type: 'depends-on', target: '' }] },
    ],
    ['a relationship with no target', { relationships: [{ type: 'depends-on' }] }],
    ['an alias of spaces', { aliases: '["a", "  "]' }],
  ])('fails %s', (_, over) => {
    expect(found(withFields(over), 'NOTE-FIELD-VALUE')).toHaveLength(1)
  })

  it('names a derived relationship type with what derives it, an unknown type, a missing target', () => {
    const [derived, how] = Object.entries(schema.relationshipTypes.derived)[0]
    const target = 'src/modules/demo/domain/rule.ts'
    const rel = (type, to) => withFields({ relationships: [{ type, target: to }] })
    expect(found(rel(derived, target), 'NOTE-RELATIONSHIP')).toEqual([
      `the scanner derives "${derived}" (${how}); do not write it`,
    ])
    expect(found(rel('likes', target), 'NOTE-RELATIONSHIP')).toEqual([
      'relationship type "likes" is not in relationshipTypes',
    ])
    expect(found(rel('depends-on', 'src/gone.ts'), 'NOTE-RELATIONSHIP-TARGET')).toEqual([
      'relationship target src/gone.ts is not a repository path that exists',
    ])
  })
})

describe('text and section messages', () => {
  it('says the front matter is missing, or why it does not parse', () => {
    expect(found(GOOD_BODY, 'NOTE-FRONTMATTER')).toEqual([
      'no front matter: a note starts with its fields',
    ])
    expect(found('---\nname: [1,\n---\n' + GOOD_BODY, 'NOTE-FRONTMATTER')).toEqual([
      'the front matter does not parse: unexpected end of the stream within a flow collection (2:1)',
    ])
  })

  it('says what the title and the purpose need', () => {
    expect(found(withBody('Just text.\n'), 'NOTE-TITLE')).toEqual([
      'the body must start with a level 1 title',
    ])
    expect(found(withBody('# Demo\n\n## Behaviors and events\n'), 'NOTE-TITLE')).toEqual([
      'the title needs a purpose paragraph before the first section',
    ])
  })

  it('gives one finding, not two, to a note with no title and no purpose', () => {
    expect(found(withBody('## Behaviors and events\n\n- x\n'), 'NOTE-TITLE')).toEqual([
      'the body must start with a level 1 title',
    ])
  })

  it('names the unknown section, the repeated one, the order and the missing required one', () => {
    const body = (heads) => `# Demo\n\nWhat.\n\n${heads.map((h) => `## ${h}\n\n- x\n`).join('\n')}`
    expect(found(withBody(body(['Behaviors and events', 'Foo'])), 'NOTE-SECTIONS')).toEqual([
      `section "Foo" is not one of: ${SECTIONS}`,
    ])
    expect(
      found(withBody(body(['Behaviors and events', 'Behaviors and events'])), 'NOTE-SECTIONS'),
    ).toEqual(['section "Behaviors and events" appears twice'])
    expect(found(withBody(body(['Boundaries', 'Behaviors and events'])), 'NOTE-SECTIONS')).toEqual([
      `sections must be in this order: ${SECTIONS}`,
    ])
    expect(found(withBody(body(['Boundaries'])), 'NOTE-SECTIONS')).toEqual([
      'missing required section "Behaviors and events"',
    ])
  })

  it('says how long the note is and the limit', () => {
    const n = schema.limits.noteLines
    const long = GOOD_BODY + '- more\n'.repeat(n)
    const lines = long.replace(/\n$/, '').split('\n').length
    expect(found(withBody(long), 'NOTE-CAP')).toEqual([
      `${lines} lines below the front matter, over the limit of ${n}`,
    ])
  })

  it('reads ./ and ../ from the note folder, for a link and for a path in backticks', () => {
    const body =
      GOOD_BODY +
      '\n- See `./domain/rule.ts`, `../shared/thing.ts` and [x](../shared/thing.ts), [y](./domain/rule.ts).\n'
    const files = [...GOOD_FILES, 'src/modules/shared/thing.ts']
    const text = withBody(body)
    expect(
      checkNote({ schema: strict, path: NOTE_PATH, text, files }).filter(
        (f) => f.rule === 'NOTE-PATH',
      ),
    ).toEqual([])
  })

  it('names a path or a link that does not exist, with its body line', () => {
    const body = GOOD_BODY + '\n- See `domain/gone.ts` and [x](../gone.md).\n'
    // lines count from the one after the front matter's closing line, which is blank here
    const line = body.split('\n').findIndex((l) => l.startsWith('- See')) + 2
    expect(found(withBody(body), 'NOTE-PATH')).toEqual([
      `path domain/gone.ts does not exist (body line ${line})`,
      `link ../gone.md does not exist (body line ${line})`,
    ])
  })
})
