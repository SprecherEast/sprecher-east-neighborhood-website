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
    expect(found[0].message).toBe('1 source files have no note: src/lib/a.ts')
  })

  it('COVERAGE-CODE names the files, not only the folder', () => {
    const files = [...GOOD_FILES, 'src/app/(frontend)/newpage/page.tsx', 'src/lib/a.ts']
    const [found] = errors(repo({ schema: realSchema, files }), 'COVERAGE-CODE')
    expect(found.message).toBe(
      '2 source files have no note: src/app/(frontend)/newpage/page.tsx, src/lib/a.ts',
    )
  })

  it('has no rule left as a warning', () => {
    expect(Object.values(realSchema.rules).filter((state) => state !== 'block')).toEqual([])
  })
})

/** A heading with nothing under it is not a written section, whatever the rule says about its heading. */
describe('a section with a heading and nothing under it', () => {
  const found = (body) =>
    checkNote({
      schema: realSchema,
      path: NOTE_PATH,
      text: goodNote(undefined, body),
      files: GOOD_FILES,
    })
  const emptyBehaviors = `# Demo

The demo module, for a test. See \`domain/rule.ts\`.

## Behaviors and events

## Known gaps

None known.
`

  it('fails a required section, saying it is empty', () => {
    const errors = found(emptyBehaviors).filter((f) => f.message.includes('is empty'))
    expect(errors.map((f) => [f.rule, f.message])).toEqual([
      ['NOTE-SECTIONS', 'section "Behaviors and events" is empty: write what belongs under it'],
    ])
  })

  it('fails an expected section, saying it is empty', () => {
    const body = GOOD_BODY + '\n## Known gaps\n\n<!-- later -->\n'
    const errors = found(body).filter((f) => f.message.includes('is empty'))
    expect(errors.map((f) => [f.rule, f.message])).toEqual([
      ['COVERAGE-SECTION', 'section "Known gaps" is empty: write what belongs under it'],
    ])
  })

  it('passes a section with a line, a list, a sub heading or a code block', () => {
    for (const under of ['None known.', '- a (`domain/rule.ts`)', '### Limits', '```\ncode\n```']) {
      const body = GOOD_BODY + `\n## Known gaps\n\n${under}\n`
      expect(found(body).filter((f) => f.message.includes('is empty'))).toEqual([])
    }
  })
})
