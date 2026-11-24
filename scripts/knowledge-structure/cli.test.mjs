import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { execute, skeleton, summarize } from './cli.mjs'
import { parseNote } from './note.mjs'
import { checkNote } from './rules.mjs'
import {
  GOOD_BODY,
  GOOD_MAP,
  NOTE_PATH,
  errorsOf,
  goodIndex,
  goodNote,
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

describe('execute', () => {
  const roots = []
  afterEach(() =>
    roots.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })),
  )

  /** A throwaway repository with the schema, a map, an index, one note and its code file. */
  function fixture({ note = goodNote(), index = goodIndex(), schemaJson = schema } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-'))
    roots.push(root)
    const files = {
      'docs/knowledge/note-schema.json': JSON.stringify(schemaJson),
      'docs/knowledge/map.json': GOOD_MAP,
      'docs/knowledge/index.md': index,
      [NOTE_PATH]: note,
      'src/modules/demo/domain/rule.ts': 'export {}\n',
    }
    for (const [file, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
      fs.writeFileSync(path.join(root, file), text)
    }
    execFileSync('git', ['init', '-q'], { cwd: root })
    return root
  }
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

  it('--skeleton prints a note for the type and exits 0', () => {
    const { code, lines } = run(fixture(), ['--skeleton', 'feature'])
    expect(code).toBe(0)
    expect(lines[0]).toMatch(/^---\nname: TODO\ntype: feature\n/)
  })
})
