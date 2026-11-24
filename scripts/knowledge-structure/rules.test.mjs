import { describe, expect, it } from 'vitest'

import { checkNote } from './rules.mjs'
import {
  GOOD_BODY,
  GOOD_FIELDS,
  GOOD_FILES,
  NOTE_PATH,
  errorsOf,
  frontmatter,
  goodNote,
  schema,
  strict,
} from './testkit.mjs'

const run = (text, files = GOOD_FILES) =>
  errorsOf(checkNote({ schema: strict, path: NOTE_PATH, text, files }))
const rulesOf = (text, files) => run(text, files).map((f) => f.rule)
const withFields = (over, body = GOOD_BODY) => goodNote({ ...GOOD_FIELDS, ...over }, body)
const allSections = (heads) =>
  GOOD_BODY.replace('## Behaviors and events', heads.map((h) => `## ${h}`).join('\n\n'))

describe('a note that follows the structure', () => {
  it('has no findings', () => {
    expect(run(goodNote())).toEqual([])
  })
})

describe('NOTE-FRONTMATTER', () => {
  it('fails a note with no front matter, naming the note', () => {
    const [finding] = run(GOOD_BODY)
    expect(finding).toMatchObject({ rule: 'NOTE-FRONTMATTER', note: NOTE_PATH, severity: 'error' })
    expect(finding.message).toMatch(/front matter/)
  })

  it('fails a front matter that does not parse', () => {
    expect(rulesOf('---\nname: a: b: c\n---\n' + GOOD_BODY)).toEqual(['NOTE-FRONTMATTER'])
  })
})

describe('NOTE-FIELDS', () => {
  it('fails a missing field, naming it', () => {
    const { aliases, ...rest } = GOOD_FIELDS
    const found = run(goodNote(rest))
    expect(found.map((f) => f.rule)).toEqual(['NOTE-FIELDS'])
    expect(found[0].message).toContain('aliases')
    expect(aliases).toEqual([])
  })

  it('fails an unknown field and a field out of order', () => {
    expect(rulesOf(withFields({ owner: 'x' }))).toEqual(['NOTE-FIELDS'])
    const swapped = { type: 'module', name: 'Demo', summary: 's', aliases: [], relationships: [] }
    expect(rulesOf(goodNote(swapped))).toEqual(['NOTE-FIELDS'])
  })
})

describe('NOTE-FIELD-VALUE', () => {
  it.each([
    ['a summary over the limit', { summary: 'x'.repeat(201) }],
    ['a name over the limit', { name: 'x'.repeat(41) }],
    ['a summary on two lines', { summary: '"one\\ntwo"' }],
    ['an empty summary', { summary: '""' }],
    ['a summary that is a list', { summary: ['a'] }],
    ['a name that is not text', { name: 5 }],
    ['aliases that are not a list of text', { aliases: 'foo' }],
    ['aliases with a non-text item', { aliases: '["a", 5]' }],
    ['aliases with an empty item', { aliases: '["a", ""]' }],
    ['relationships with a null item', { relationships: '[null]' }],
    ['relationships with a plain text item', { relationships: '["x"]' }],
    ['a relationship type that is not text', { relationships: [{ type: 5, target: 'x' }] }],
    ['relationships that are not a list', { relationships: 'foo' }],
    ['a relationship that is not { type, target }', { relationships: [{ type: 'depends-on' }] }],
  ])('fails %s', (_, over) => {
    expect(rulesOf(withFields(over))).toEqual(['NOTE-FIELD-VALUE'])
  })
})

describe('NOTE-TYPE', () => {
  it('fails an unknown note type, and a node type that is not a note type', () => {
    expect(rulesOf(withFields({ type: 'widget' }))).toEqual(['NOTE-TYPE'])
    expect(rulesOf(withFields({ type: 'screen' }))).toEqual(['NOTE-TYPE'])
    // inherited object keys are not types, whatever they are called
    expect(rulesOf(withFields({ type: 'constructor' }))).toEqual(['NOTE-TYPE'])
  })
})

describe('NOTE-TITLE', () => {
  it('fails a note with no level 1 title, or no purpose paragraph', () => {
    expect(rulesOf(goodNote(GOOD_FIELDS, GOOD_BODY.replace('# Demo\n', 'Demo\n')))).toContain(
      'NOTE-TITLE',
    )
    const bare = '# Demo\n\n## Behaviors and events\n\n- x (`domain/rule.ts`)\n'
    expect(rulesOf(goodNote(GOOD_FIELDS, bare))).toEqual(['NOTE-TITLE'])
    const sub =
      '# Demo\n### A heading is not a purpose\n\n## Behaviors and events\n\n- x (`domain/rule.ts`)\n'
    expect(rulesOf(goodNote(GOOD_FIELDS, sub))).toEqual(['NOTE-TITLE'])
  })

  it('wants a level 1 title, not a deeper one or one with no space', () => {
    for (const first of ['## Demo', '#Demo']) {
      const body = GOOD_BODY.replace('# Demo', first)
      expect(rulesOf(goodNote(GOOD_FIELDS, body))).toContain('NOTE-TITLE')
    }
  })
})

describe('NOTE-SECTIONS', () => {
  it('fails a missing required section, naming it', () => {
    const found = run(goodNote(GOOD_FIELDS, GOOD_BODY.replace('## Behaviors and events', '### x')))
    expect(found.map((f) => f.rule)).toEqual(['NOTE-SECTIONS'])
    expect(found[0].message).toContain('Behaviors and events')
  })

  it('fails a heading that is not in the set, and one used twice', () => {
    expect(rulesOf(goodNote(GOOD_FIELDS, allSections(['Behaviors and events', 'Limits'])))).toEqual(
      ['NOTE-SECTIONS'],
    )
    expect(
      rulesOf(goodNote(GOOD_FIELDS, allSections(['Behaviors and events', 'Behaviors and events']))),
    ).toEqual(['NOTE-SECTIONS'])
  })

  it('names a heading outside the set, and one used twice', () => {
    const messages = (heads) => run(goodNote(GOOD_FIELDS, allSections(heads))).map((f) => f.message)
    expect(messages(['Behaviors and events', 'Limits'])).toEqual([
      expect.stringContaining('"Limits" is not one of'),
    ])
    expect(messages(['Behaviors and events', 'Behaviors and events'])).toEqual([
      expect.stringContaining('appears twice'),
    ])
  })

  it('fails sections out of order', () => {
    expect(
      rulesOf(goodNote(GOOD_FIELDS, allSections(['Boundaries', 'Behaviors and events']))),
    ).toEqual(['NOTE-SECTIONS'])
  })

  it('fails Screens in a note whose type does not have it', () => {
    expect(
      rulesOf(withFields({ type: 'feature' }, allSections(['Screens', 'Behaviors and events']))),
    ).toEqual(['NOTE-SECTIONS'])
  })

  it('accepts a section the type does not require being absent', () => {
    expect(run(goodNote())).toEqual([])
  })
})

describe('NOTE-CAP', () => {
  it('fails a note over the cap, counting below the front matter only', () => {
    const long = GOOD_BODY + '- more\n'.repeat(80)
    const found = run(goodNote(GOOD_FIELDS, long))
    expect(found.map((f) => f.rule)).toEqual(['NOTE-CAP'])
    expect(found[0].message).toMatch(/80/)
    const exact = GOOD_BODY + '- more\n'.repeat(80 - GOOD_BODY.split('\n').length + 1)
    expect(run(goodNote(GOOD_FIELDS, exact))).toEqual([])
  })
})

describe('NOTE-PATH', () => {
  it('fails a backticked path and a link that point at nothing, naming each', () => {
    const body = GOOD_BODY + '\n- Gone: `domain/gone.ts` and [x](../../../docs/missing.md).\n'
    const found = run(goodNote(GOOD_FIELDS, body))
    expect(found.map((f) => f.rule)).toEqual(['NOTE-PATH', 'NOTE-PATH'])
    expect(found[0].message).toMatch(/^path domain\/gone\.ts/)
    expect(found[1].message).toMatch(/^link /)
    expect(found[1].message).toContain('missing.md')
  })
})

it('reports a field problem and a missing field together, each once', () => {
  const found = run(withFields({ aliases: 'foo', owner: 'x' }))
  expect(found.map((f) => f.rule)).toEqual(['NOTE-FIELDS', 'NOTE-FIELD-VALUE'])
})

describe('COVERAGE-SECTION', () => {
  it('warns, never fails, about an expected section that is missing', () => {
    const found = checkNote({ schema, path: NOTE_PATH, text: goodNote(), files: GOOD_FILES })
    const coverage = found.filter((f) => f.rule === 'COVERAGE-SECTION')
    expect(coverage.length).toBeGreaterThan(0)
    expect(coverage.every((f) => f.severity === 'warning')).toBe(true)
    expect(coverage.map((f) => f.message).join(' ')).toContain('Known gaps')
  })
})

describe('severity follows the schema', () => {
  it('reports a rule marked warn as a warning', () => {
    const lax = { ...strict, rules: { ...strict.rules, 'NOTE-CAP': 'warn' } }
    const text = goodNote(GOOD_FIELDS, GOOD_BODY + '- more\n'.repeat(80))
    const found = checkNote({ schema: lax, path: NOTE_PATH, text, files: GOOD_FILES })
    expect(found.filter((f) => f.rule === 'NOTE-CAP')).toEqual([
      expect.objectContaining({ severity: 'warning' }),
    ])
    expect(errorsOf(found)).toEqual([])
  })
})

it('keeps front matter out of the note when a body repeats the dashes', () => {
  expect(run(frontmatter(GOOD_FIELDS) + GOOD_BODY + '\n---\n\ntext\n')).toEqual([])
})

it('reads a note with Windows line endings like any other', () => {
  expect(run(goodNote().replace(/\n/g, '\r\n'))).toEqual([])
})
