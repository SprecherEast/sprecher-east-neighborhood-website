import { describe, expect, it } from 'vitest'

import { checkNote } from './rules.mjs'
import { GOOD_BODY, GOOD_FILES, NOTE_PATH, goodNote, realSchema, repo } from './testkit.mjs'

/** The three rules that only reported until #1004 wrote the content: now they fail the check. */
describe('the rules #1004 turned from warnings into errors, on the real schema', () => {
  const errors = (found, rule) => found.filter((f) => f.rule === rule && f.severity === 'error')

  it('NOTE-PATH fails a path in a note that does not exist', () => {
    const text = goodNote(undefined, GOOD_BODY + '- A test: `domain/missing.test.ts`.\n')
    const found = checkNote({ schema: realSchema, path: NOTE_PATH, text, files: GOOD_FILES })
    expect(errors(found, 'NOTE-PATH').map((f) => f.message)).toEqual([
      expect.stringContaining('domain/missing.test.ts does not exist'),
    ])
  })

  it('COVERAGE-SECTION fails an expected section that is not written', () => {
    const found = checkNote({
      schema: realSchema,
      path: NOTE_PATH,
      text: goodNote(),
      files: GOOD_FILES,
    })
    const said = errors(found, 'COVERAGE-SECTION').map((f) => f.message)
    expect(said).toContain('section "Known gaps" is not written yet')
  })

  it('COVERAGE-CODE fails source code that no map entry describes', () => {
    const files = [...GOOD_FILES, 'src/lib/a.ts']
    const found = errors(repo({ schema: realSchema, files }), 'COVERAGE-CODE')
    expect(found).toHaveLength(1)
    expect(found[0].message).toBe('1 source files have no note: src/lib/a.ts 1')
  })

  it('has no rule left as a warning', () => {
    expect(Object.values(realSchema.rules).filter((state) => state !== 'block')).toEqual([])
  })
})
