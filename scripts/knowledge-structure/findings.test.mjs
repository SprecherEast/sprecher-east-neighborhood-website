/** Notes with one thing wrong, or several: what is reported, and in what order. */
import { describe, expect, it } from 'vitest'

import { checkNote } from './rules.mjs'
import {
  GOOD_BODY,
  GOOD_FIELDS,
  GOOD_FILES,
  NOTE_PATH,
  goodNote,
  messagesOf,
  schema,
  strict,
} from './testkit.mjs'

const optional = {
  ...strict,
  sections: schema.sections.map((s) => ({ ...s, presence: 'optional' })),
}
const check = (text, over = {}) =>
  checkNote({
    schema: over.schema ?? strict,
    path: NOTE_PATH,
    text,
    files: over.files ?? GOOD_FILES,
  })
const LONG = 'a'.repeat(70)
const SECTIONS = schema.sections
  .filter((s) => s.appliesTo.includes('module'))
  .map((s) => s.heading)
  .join(', ')

describe('a note with one thing wrong', () => {
  it('reports a note over its cap, a missing path and a missing target even when nothing else is wrong', () => {
    const over = goodNote(GOOD_FIELDS, GOOD_BODY + '- x\n'.repeat(80))
    expect(check(over, { schema: optional }).map((f) => f.rule)).toEqual(['NOTE-CAP'])
    const body = GOOD_BODY + `\n- See \`domain/${LONG}.ts\` and [x](./${LONG}.md).\n`
    expect(check(goodNote(GOOD_FIELDS, body), { schema: optional }).map((f) => f.rule)).toEqual([
      'NOTE-PATH',
      'NOTE-PATH',
    ])
    const rel = {
      ...GOOD_FIELDS,
      relationships: [{ type: 'depends-on', target: `src/${LONG}.ts` }],
    }
    expect(check(goodNote(rel), { schema: optional }).map((f) => f.rule)).toEqual([
      'NOTE-RELATIONSHIP-TARGET',
    ])
  })

  it('names an unknown section however long its heading, and a missing link as a link', () => {
    const body = GOOD_BODY + `\n## ${LONG} ${LONG}\n\n- x\n`
    expect(messagesOf(check(goodNote(GOOD_FIELDS, body)), 'NOTE-SECTIONS')).toEqual([
      `section "${LONG} ${LONG}" is not one of: ${SECTIONS}`,
    ])
    const longSchema = {
      ...strict,
      sections: strict.sections.map((s) =>
        s.heading === 'Boundaries' ? { ...s, heading: LONG } : s,
      ),
    }
    const twice = GOOD_BODY + `\n## ${LONG}\n\n- x\n\n## ${LONG}\n\n- y\n`
    expect(
      messagesOf(check(goodNote(GOOD_FIELDS, twice), { schema: longSchema }), 'NOTE-SECTIONS'),
    ).toEqual([`section "${LONG}" appears twice`])
    const link = GOOD_BODY + '\n- See [x](./gone.md).\n'
    expect(
      messagesOf(check(goodNote(GOOD_FIELDS, link), { schema: optional }), 'NOTE-PATH'),
    ).toEqual(['link ./gone.md does not exist (body line 10)'])
  })

  it('accepts long lists: 61 aliases, and 61 relationships', () => {
    const aliases = Array.from({ length: 61 }, (_, i) => `a${i}`)
    expect(check(goodNote({ ...GOOD_FIELDS, aliases }), { schema: optional })).toEqual([])
    const target = 'src/modules/demo/domain/rule.ts'
    const relationships = Array.from({ length: 61 }, () => ({ type: 'depends-on', target }))
    expect(check(goodNote({ ...GOOD_FIELDS, relationships }), { schema: optional })).toEqual([])
    const badRel = [...relationships.slice(1), { type: 'depends-on' }]
    expect(
      messagesOf(check(goodNote({ ...GOOD_FIELDS, relationships: badRel })), 'NOTE-FIELD-VALUE'),
    ).toEqual(['relationships must be a list of { type, target }'])
    const bad = [...aliases.slice(1), 5]
    expect(
      messagesOf(check(goodNote({ ...GOOD_FIELDS, aliases: bad })), 'NOTE-FIELD-VALUE'),
    ).toEqual(['aliases must be a list of one-line texts'])
  })

  it('lists its findings in the order of the rules: front matter, title, sections, cap, paths', () => {
    const none = check('# \n\n## Bogus\n\n' + '- x\n'.repeat(80) + '`gone/x.ts`\n')
    expect(none.map((f) => f.rule)).toEqual([
      'NOTE-FRONTMATTER',
      'NOTE-TITLE',
      'NOTE-CAP',
      'NOTE-PATH',
    ])
    const text = goodNote(GOOD_FIELDS, GOOD_BODY.replace('## Behaviors', '## Foo\n\n## Behaviors'))
    const rules = check(text).map((f) => f.rule)
    expect(rules.indexOf('NOTE-SECTIONS')).toBeLessThan(rules.indexOf('COVERAGE-SECTION'))
  })

  it('lists a missing field, an unknown one and the order, in that order', () => {
    const text = goodNote({ extra: 'x', type: 'module', name: 'Demo', summary: 's', aliases: [] })
    expect(messagesOf(check(text), 'NOTE-FIELDS')).toEqual([
      'missing field relationships',
      'unknown field extra',
      'fields must be in this order: name, type, summary, aliases, relationships',
    ])
  })

  it('lists the order of the fields after a bad value, the sections order and the cap last', () => {
    const swapped = goodNote({
      type: 'module',
      name: 5,
      summary: 's',
      aliases: [],
      relationships: [],
    })
    expect(
      check(swapped)
        .map((f) => f.rule)
        .slice(0, 2),
    ).toEqual(['NOTE-FIELDS', 'NOTE-FIELD-VALUE'])
    const body =
      GOOD_BODY.replace(
        '## Behaviors and events',
        '## Boundaries\n\n- x\n\n## Screens\n\n- x\n\n## Behaviors and events',
      ) + '- x\n'.repeat(80)
    const rules = check(goodNote(GOOD_FIELDS, body)).map((f) => f.rule)
    expect(rules.indexOf('NOTE-SECTIONS')).toBeLessThan(rules.indexOf('NOTE-CAP'))
    expect(check(goodNote(GOOD_FIELDS, body))[0].message).toMatch(/^sections must be in this order/)
  })

  it('names a derived type and a missing target in the order they are written', () => {
    const relationships = [
      { type: 'reads', target: 'src/gone' },
      { type: 'nope', target: 'src/gone' },
    ]
    const found = check(goodNote({ ...GOOD_FIELDS, relationships }))
    expect(found.filter((f) => f.rule.startsWith('NOTE-RELATIONSHIP')).map((f) => f.rule)).toEqual([
      'NOTE-RELATIONSHIP',
      'NOTE-RELATIONSHIP-TARGET',
      'NOTE-RELATIONSHIP',
      'NOTE-RELATIONSHIP-TARGET',
    ])
  })
})
