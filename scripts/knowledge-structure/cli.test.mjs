import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { execute, skeleton, summarize } from './cli.mjs'
import { parseNote } from './note.mjs'
import { checkNote } from './rules.mjs'
import {
  GOOD_BODY,
  GOOD_FIELDS,
  NOTE_PATH,
  errorsOf,
  goodIndex,
  fixture,
  goodNote,
  messageOf,
  removeFixtures,
  schema,
  strict,
} from './testkit.mjs'

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
    for (const inherited of ['constructor', 'toString', '__proto__', 'hasOwnProperty'])
      expect(messageOf(() => skeleton(schema, inherited))).toContain(`unknown type "${inherited}"`)
    expect(messageOf(() => skeleton(schema, 'widget'))).toBe(
      'unknown type "widget"; use one of: module, platform-area, feature',
    )
  })

  it('says in each section hint whether the section is required, expected or optional', () => {
    const text = skeleton(schema, 'module')
    for (const { heading, presence, hint } of schema.sections) {
      expect(text).toContain(`## ${heading}\n\n<!-- ${presence}: ${hint} -->`)
    }
  })

  it('follows the structure except that its sections are not written yet', () => {
    const text = skeleton(schema, 'module')
    const errors = errorsOf(checkNote({ schema: strict, path: NOTE_PATH, text, files: [] }))
    expect(errors.map((f) => f.message)).toEqual([
      'section "Behaviors and events" is empty: write what belongs under it',
    ])
  })
})

describe('a skeleton, in full', () => {
  it('is the fields as placeholders, a title, a purpose line, then each section with its hint', () => {
    const tiny = {
      noteTypes: { thing: {} },
      kinds: { text: { placeholder: 'TODO' }, noteType: { placeholder: '$type' } },
      fields: [
        { key: 'name', kind: 'text' },
        { key: 'type', kind: 'noteType' },
      ],
      sections: [
        { heading: 'One', presence: 'required', hint: 'First.', appliesTo: ['thing'] },
        { heading: 'Two', presence: 'optional', hint: 'Second.', appliesTo: ['other'] },
        { heading: 'Three', presence: 'expected', hint: 'Third.', appliesTo: ['thing'] },
      ],
    }
    expect(skeleton(tiny, 'thing')).toBe(
      '---\nname: TODO\ntype: thing\n---\n\n# TODO\n\nTODO: what this part is for, in one or two sentences.\n\n' +
        '## One\n\n<!-- required: First. -->\n\n## Three\n\n<!-- expected: Third. -->\n',
    )
  })
})

describe('a skeleton for a schema with a field of an unknown kind', () => {
  it('says which field and kind, as the check does', () => {
    const odd = { ...schema, fields: [{ key: 'weight', kind: 'number' }, ...schema.fields] }
    expect(messageOf(() => skeleton(odd, 'module'))).toBe(
      'field "weight" has kind "number", which the check does not handle: a new kind needs code here',
    )
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
    expect(text).toContain('NOTE-CAP: 1')
    expect(summarize([{ rule: 'X', severity: 'error', note: 'a', message: 'm' }])).toContain(
      '1 error,',
    )
    const three = ['a', 'b', 'c'].map((note) => ({
      rule: 'X',
      severity: 'warning',
      note,
      message: 'm',
    }))
    expect(summarize(three)).toBe('Knowledge structure: 0 errors, 3 warnings\n- X: 3')
    expect(summarize([])).toBe('Knowledge structure: 0 errors, 0 warnings')
    expect(
      summarize([
        { rule: 'NOTE-CAP', severity: 'error', note: 'a', message: 'm' },
        { rule: 'COVERAGE-CODE', severity: 'warning', note: 'b', message: 'm' },
        { rule: 'COVERAGE-CODE', severity: 'warning', note: 'c', message: 'm' },
      ]),
    ).toBe('Knowledge structure: 1 error, 2 warnings\n- NOTE-CAP: 1\n- COVERAGE-CODE: 2')
  })
})

describe('execute', () => {
  afterEach(removeFixtures)

  const run = (root, argv = [], env = {}) => {
    const lines = []
    return { code: execute({ argv, root, env, log: (l) => lines.push(l) }), lines }
  }

  it('exits 0 for a repository that follows the structure, warnings included', () => {
    const { code, lines } = run(fixture())
    expect(code).toBe(0)
    expect(lines.at(-1)).toMatch(/- COVERAGE-SECTION/)
  })

  it('exits 1 when a rule that blocks finds something, naming the note and the rule', () => {
    const { code, lines } = run(fixture({ note: '# Demo\n' }))
    expect(code).toBe(1)
    expect(lines.join('\n')).toContain(`error [NOTE-FRONTMATTER] ${NOTE_PATH}`)
  })

  it('exits 0 when the same finding is only a warning in the schema', () => {
    const lax = { ...schema, rules: { ...schema.rules, 'NOTE-FRONTMATTER': 'warn' } }
    const { code, lines } = run(fixture({ note: GOOD_BODY, index: goodIndex(''), schemaJson: lax }))
    expect(code).toBe(0)
    expect(lines.join('\n')).toContain('warning [NOTE-FRONTMATTER]')
  })

  it('appends the counts to the job summary file when there is one', () => {
    const root = fixture()
    const summary = path.join(root, 'summary.md')
    run(root, [], { GITHUB_STEP_SUMMARY: summary })
    expect(fs.readFileSync(summary, 'utf8')).toContain('Knowledge structure: 0 errors')
  })

  it('--write-index makes the index lines from the notes, and then the check passes', () => {
    const root = fixture({ index: goodIndex('- [Old](../../x.md): stale') })
    expect(run(root).code).toBe(1)
    const { code, lines } = run(root, ['--write-index'])
    expect(code).toBe(0)
    expect(lines).toEqual(['Wrote the 1 note lines of docs/knowledge/index.md.'])
    expect(fs.readFileSync(path.join(root, 'docs/knowledge/index.md'), 'utf8')).toBe(goodIndex())
    expect(run(root).code).toBe(0)
  })

  it('--write-index leaves out a note that has no name or summary, instead of writing undefined', () => {
    const root = fixture({
      note: goodNote({ ...GOOD_FIELDS, summary: undefined }),
      index: goodIndex(''),
    })
    const { lines } = run(root, ['--write-index'])
    expect(lines).toEqual(['Wrote the 0 note lines of docs/knowledge/index.md.'])
    expect(fs.readFileSync(path.join(root, 'docs/knowledge/index.md'), 'utf8')).not.toContain(
      'undefined',
    )
  })

  it('does not count a tracked file that was deleted, nor a file git ignores', () => {
    const root = fixture({
      note: goodNote(GOOD_FIELDS, GOOD_BODY + '- Ignored `domain/skipped.ts`.\n'),
    })
    fs.writeFileSync(path.join(root, 'src/modules/demo/domain/skipped.ts'), 'x')
    fs.writeFileSync(path.join(root, '.gitignore'), 'skipped.ts\n')
    expect(run(root).lines.join('\n')).toContain('path domain/skipped.ts does not exist')
    execFileSync('git', ['add', '-f', '.'], { cwd: root })
    fs.rmSync(path.join(root, NOTE_PATH))
    expect(run(root).lines.join('\n')).toContain(
      'listed in docs/knowledge/map.json but the file does not exist',
    )
  })

  it('prints each finding as severity, rule, note and message, then the counts', () => {
    const { lines } = run(fixture({ note: '# Demo\n' }))
    expect(lines).toContain(
      `error [NOTE-FRONTMATTER] ${NOTE_PATH}: no front matter: a note starts with its fields`,
    )
    expect(lines.at(-1)).toMatch(/^Knowledge structure: \d+ errors?, \d+ warnings?\n- /)
  })

  it('adds to a job summary file that already has text, never replaces it', () => {
    const root = fixture()
    const summary = path.join(root, 'summary.md')
    fs.writeFileSync(summary, 'earlier step\n')
    const { lines } = run(root, [], { GITHUB_STEP_SUMMARY: summary })
    expect(fs.readFileSync(summary, 'utf8')).toBe(`earlier step\n${lines.at(-1)}\n`)
  })

  it('writes the same counts to the job summary file, then a line end', () => {
    const root = fixture()
    const summary = path.join(root, 'summary.md')
    const { lines } = run(root, [], { GITHUB_STEP_SUMMARY: summary })
    expect(fs.readFileSync(summary, 'utf8')).toBe(`${lines.at(-1)}\n`)
  })

  it('runs with no environment given, as a library call', () => {
    const lines = []
    expect(execute({ argv: [], root: fixture(), log: (l) => lines.push(l) })).toBe(0)
  })

  it('--write-index leaves out a note with a summary but no name', () => {
    const root = fixture({
      note: goodNote({ ...GOOD_FIELDS, name: undefined }),
      index: goodIndex(''),
    })
    expect(run(root, ['--write-index']).lines).toEqual([
      'Wrote the 0 note lines of docs/knowledge/index.md.',
    ])
  })

  it('--write-index says nothing when it cannot write: an index with no Notes section', () => {
    const root = fixture({ index: '# Index\n' })
    const lines = []
    expect(() => execute({ argv: ['--write-index'], root, log: (l) => lines.push(l) })).toThrow(
      /no "## Notes" section/,
    )
    expect(lines).toEqual([])
  })

  it('--skeleton prints only the note: it does not go on to check the repository', () => {
    const { lines } = run(fixture({ note: '# Demo\n' }), ['--skeleton', 'feature'])
    expect(lines).toHaveLength(1)
  })

  it('--skeleton prints a note for the type and exits 0', () => {
    const { code, lines } = run(fixture(), ['--skeleton', 'feature'])
    expect(code).toBe(0)
    expect(lines[0]).toMatch(/^---\nname: TODO\ntype: feature\n/)
  })
})
