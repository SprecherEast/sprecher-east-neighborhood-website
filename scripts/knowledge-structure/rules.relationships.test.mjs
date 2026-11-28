import { describe, expect, it } from 'vitest'

import { checkNote } from './rules.mjs'
import {
  GOOD_BODY,
  GOOD_FIELDS,
  GOOD_FILES,
  NOTE_PATH,
  errorsOf,
  goodNote,
  schema,
  strict,
} from './testkit.mjs'

const run = (text, files = GOOD_FILES) =>
  errorsOf(checkNote({ schema: strict, path: NOTE_PATH, text, files }))
const rulesOf = (text, files) => run(text, files).map((f) => f.rule)
const withFields = (over, body = GOOD_BODY) => goodNote({ ...GOOD_FIELDS, ...over }, body)

describe('NOTE-RELATIONSHIP and its target', () => {
  const rel = (type, target) => ({ relationships: [{ type, target }] })

  it('accepts a hand-written type pointing at a path that exists', () => {
    expect(run(withFields(rel('depends-on', 'src/modules/demo/domain/rule.ts')))).toEqual([])
  })

  it('fails an unknown relationship type', () => {
    expect(rulesOf(withFields(rel('befriends', NOTE_PATH)))).toEqual(['NOTE-RELATIONSHIP'])
  })

  it('does not read an inherited object key as a relationship type', () => {
    const found = run(withFields(rel('toString', NOTE_PATH)))
    expect(found.map((f) => f.rule)).toEqual(['NOTE-RELATIONSHIP'])
    expect(found[0].message).toMatch(/not in relationshipTypes/)
  })

  it('fails a type the scanner derives, so it is never written twice', () => {
    const found = run(withFields(rel('mentions', NOTE_PATH)))
    expect(found.map((f) => f.rule)).toEqual(['NOTE-RELATIONSHIP'])
    expect(found[0].message).toMatch(/derives/)
  })

  it.each([
    ['a bare file name', 'README.md'],
    ['the end of a path', 'demo/domain/rule.ts'],
    ['a folder tail', 'domain/'],
  ])('fails a target that is only %s: it must be the whole repository path', (_, target) => {
    expect(rulesOf(withFields(rel('depends-on', target)))).toEqual(['NOTE-RELATIONSHIP-TARGET'])
  })

  it('accepts a folder given by its whole repository path', () => {
    expect(run(withFields(rel('depends-on', 'src/modules/demo/domain/')))).toEqual([])
  })

  it('fails a target that does not exist', () => {
    expect(rulesOf(withFields(rel('depends-on', 'src/modules/gone/README.md')))).toEqual([
      'NOTE-RELATIONSHIP-TARGET',
    ])
  })
})

describe('fields are checked by the kind the schema gives them', () => {
  const owner = { key: 'owner', kind: 'text', maxChars: 5, what: 'x' }
  const withOwner = { ...strict, fields: [...strict.fields, owner] }
  const check = (fields) =>
    errorsOf(
      checkNote({ schema: withOwner, path: NOTE_PATH, text: goodNote(fields), files: GOOD_FILES }),
    )

  it('requires a field added to the schema, and checks its value, with no code change', () => {
    expect(check(GOOD_FIELDS).map((f) => f.rule)).toEqual(['NOTE-FIELDS'])
    expect(check({ ...GOOD_FIELDS, owner: 'tooLong' }).map((f) => f.rule)).toEqual([
      'NOTE-FIELD-VALUE',
    ])
    expect(check({ ...GOOD_FIELDS, owner: 'ok' })).toEqual([])
  })

  it('finds the type field by its kind, wherever it sits', () => {
    const moved = { ...strict, fields: [...strict.fields].reverse() }
    const text = goodNote({
      relationships: [],
      aliases: [],
      summary: 's',
      type: 'module',
      name: 'Demo',
    })
    expect(
      errorsOf(checkNote({ schema: moved, path: NOTE_PATH, text, files: GOOD_FILES })),
    ).toEqual([])
  })
})
