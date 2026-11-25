import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { execute, listFiles } from './cli.mjs'
import { GOOD_FIELDS, NOTE_PATH, fixture, goodNote, removeFixtures, schema } from './testkit.mjs'

describe('listFiles', () => {
  afterEach(removeFixtures)

  it('lists tracked and untracked files, once each, with no empty entry', () => {
    const root = fixture()
    execFileSync('git', ['add', '-A'], { cwd: root })
    fs.writeFileSync(path.join(root, 'untracked.txt'), 'x')
    const files = listFiles(root)
    expect(files).toContain(NOTE_PATH)
    expect(files).toContain('untracked.txt')
    expect(files).not.toContain('')
    expect(new Set(files).size).toBe(files.length)
  })

  it('leaves out a tracked file that was deleted', () => {
    const root = fixture()
    execFileSync('git', ['add', '-A'], { cwd: root })
    fs.rmSync(path.join(root, 'src/modules/demo/domain/rule.ts'))
    expect(listFiles(root)).not.toContain('src/modules/demo/domain/rule.ts')
  })

  it('lists a repository whose file list is longer than a megabyte', () => {
    const root = fixture()
    const before = listFiles(root).length
    const dir = path.join(root, 'tmp-many')
    fs.mkdirSync(dir)
    for (let i = 0; i < 6000; i++)
      fs.writeFileSync(path.join(dir, `${'f'.repeat(200)}${i}.txt`), '')
    expect(listFiles(root)).toHaveLength(before + 6000)
  })
})

describe('execute, on what the file list holds', () => {
  afterEach(removeFixtures)

  const run = (root) => {
    const lines = []
    return { code: execute({ argv: [], root, log: (l) => lines.push(l) }), lines }
  }

  it('does not let an empty entry in the file list match a map path of *', () => {
    const root = fixture()
    fs.writeFileSync(
      path.join(root, 'docs/knowledge/map.json'),
      JSON.stringify([{ note: NOTE_PATH, paths: ['*'] }]),
    )
    const { code, lines } = run(root)
    expect(code).toBe(1)
    expect(lines).toContain(`error [NOTE-NO-CODE] ${NOTE_PATH}: its map paths match no file`)
  })

  it('rejects a relationship target of / (the file list holds no empty path)', () => {
    const note = goodNote({ ...GOOD_FIELDS, relationships: [{ type: 'depends-on', target: '/' }] })
    const { code, lines } = run(fixture({ note }))
    expect(code).toBe(1)
    expect(lines).toContain(
      `error [NOTE-RELATIONSHIP-TARGET] ${NOTE_PATH}: relationship target / is not a repository path that exists`,
    )
  })

  it('reads files git tracks, and files it does not yet, in the same way', () => {
    const root = fixture()
    execFileSync('git', ['add', '-A'], { cwd: root })
    expect(run(root).code).toBe(0)
    fs.writeFileSync(path.join(root, 'untracked.txt'), 'x')
    expect(run(root).code).toBe(0)
  })
})

describe('the job summary on a clean run', () => {
  afterEach(removeFixtures)

  it('is written when there is nothing to report, and appended to what is there', () => {
    const optional = {
      ...schema,
      sections: schema.sections.map((s) => ({ ...s, presence: 'optional' })),
    }
    const root = fixture({ schemaJson: optional })
    const summary = path.join(root, 'summary.md')
    fs.writeFileSync(summary, 'earlier\n')
    const lines = []
    execute({ argv: [], root, env: { GITHUB_STEP_SUMMARY: summary }, log: (l) => lines.push(l) })
    expect(lines).toEqual(['Knowledge structure: 0 errors, 0 warnings'])
    expect(fs.readFileSync(summary, 'utf8')).toBe(
      'earlier\nKnowledge structure: 0 errors, 0 warnings\n',
    )
  })
})
