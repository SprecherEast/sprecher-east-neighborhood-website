import { describe, expect, it } from 'vitest'

import { skeleton, summarize } from './cli.mjs'
import { parseNote } from './note.mjs'
import { checkNote } from './rules.mjs'
import { NOTE_PATH, errorsOf, schema, strict } from './testkit.mjs'

describe('skeleton', () => {
  it('prints the fields and the sections of a type, read from the schema', () => {
    const text = skeleton(schema, 'module')
    const note = parseNote(text)
    expect(Object.keys(note.data)).toEqual(schema.fields.map((f) => f.key))
    expect(note.sections.map((s) => s.heading)).toEqual(
      schema.sections.filter((s) => s.appliesTo.includes('module')).map((s) => s.heading),
    )
  })

  it('leaves Screens out for a type that has no routes, and fails for an unknown type', () => {
    expect(skeleton(schema, 'feature')).not.toContain('## Screens')
    expect(() => skeleton(schema, 'widget')).toThrow(/module, platform-area, feature/)
  })

  it('is a note that already follows the structure, so the author fills it in', () => {
    const text = skeleton(schema, 'module')
    expect(errorsOf(checkNote({ schema: strict, path: NOTE_PATH, text, files: [] }))).toEqual([])
  })
})

describe('summarize', () => {
  it('counts errors and warnings by rule, for the job summary', () => {
    const text = summarize([
      { rule: 'NOTE-CAP', severity: 'error', note: 'a', message: 'm' },
      { rule: 'COVERAGE-CODE', severity: 'warning', note: 'b', message: 'm' },
      { rule: 'COVERAGE-CODE', severity: 'warning', note: 'c', message: 'm' },
    ])
    expect(text).toContain('1 error')
    expect(text).toContain('2 warnings')
    expect(text).toContain('COVERAGE-CODE: 2')
    expect(summarize([])).toContain('0 errors, 0 warnings')
  })
})
