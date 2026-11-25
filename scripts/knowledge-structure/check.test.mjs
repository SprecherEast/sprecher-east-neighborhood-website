import { describe, expect, it } from 'vitest'

import {
  GOOD_FIELDS,
  GOOD_FILES,
  NOTE_PATH,
  errorsOf,
  goodIndex,
  goodNote,
  repo,
} from './testkit.mjs'

const rules = (over) => errorsOf(repo(over)).map((f) => f.rule)

describe('checkKnowledge', () => {
  it('finds nothing in a repository that follows the structure', () => {
    expect(errorsOf(repo())).toEqual([])
  })

  it('NOTE-ORPHAN: fails a README under src that no map entry names', () => {
    const other = 'src/modules/other/README.md'
    const found = errorsOf(repo({ texts: { [other]: goodNote() } })).filter(
      (f) => f.rule === 'NOTE-ORPHAN',
    )
    expect(found).toEqual([expect.objectContaining({ note: other, severity: 'error' })])
  })

  it('does not call the folder entries orphans', () => {
    expect(rules({ texts: { 'src/modules/README.md': '# Modules\n' } })).toEqual([])
  })

  it('MAP-NOTE: fails a map entry whose note is missing, and one listed twice', () => {
    const missing = JSON.stringify([{ note: 'src/modules/gone/README.md', paths: ['src/**'] }])
    expect(rules({ map: missing })).toContain('MAP-NOTE')
    const twice = JSON.stringify([
      { note: NOTE_PATH, paths: ['src/modules/demo/**'] },
      { note: NOTE_PATH, paths: ['src/modules/demo/**'] },
    ])
    expect(rules({ map: twice })).toContain('MAP-NOTE')
  })

  it('NOTE-NO-CODE: fails map paths that match no file, and a note that names no code', () => {
    const empty = JSON.stringify([{ note: NOTE_PATH, paths: ['src/modules/nothing/**'] }])
    expect(rules({ map: empty })).toEqual(['NOTE-NO-CODE'])
    const bare = goodNote(undefined, '# Demo\n\nWhat it is.\n\n## Behaviors and events\n\n- x\n')
    expect(rules({ texts: { [NOTE_PATH]: bare } })).toEqual(['NOTE-NO-CODE'])
  })

  it('INDEX-DRIFT: fails a line that differs from the note, a missing line and a stale one', () => {
    const wrong = goodIndex('- [Demo](../../src/modules/demo/README.md): an older summary')
    const drift = (text) => [...new Set(rules({ texts: { 'docs/knowledge/index.md': text } }))]
    expect(drift(wrong)).toEqual(['INDEX-DRIFT'])
    expect(drift(goodIndex(''))).toEqual(['INDEX-DRIFT'])
    const extra = goodIndex().replace(
      '\n\n## Reference',
      '\n- [Z](../../src/z/README.md): z\n\n## Reference',
    )
    expect(drift(extra)).toEqual(['INDEX-DRIFT'])
  })

  it('INDEX-DRIFT: fails when the index file is missing altogether', () => {
    const found = errorsOf(repo({ texts: { 'docs/knowledge/index.md': undefined } }))
    expect(found.map((f) => f.rule)).toEqual(['INDEX-DRIFT'])
    expect(found[0].message).toBe('docs/knowledge/index.md does not exist')
  })

  it('INDEX-DRIFT: fails an index with no Notes section, so a broken index never passes', () => {
    const found = errorsOf(repo({ texts: { 'docs/knowledge/index.md': '# Index\n' } }))
    expect(found.map((f) => f.rule)).toEqual(['INDEX-DRIFT'])
    expect(found[0].message).toMatch(/## Notes/)
  })

  it('does not ask the index for a note that has no name or summary to make its line from', () => {
    const noName = goodNote({ ...GOOD_FIELDS, name: undefined })
    const found = errorsOf(
      repo({ texts: { [NOTE_PATH]: noName, 'docs/knowledge/index.md': goodIndex('') } }),
    )
    expect(found.map((f) => f.rule)).toEqual(['NOTE-FIELDS'])
  })

  it('INDEX-DRIFT: fails prose left under Notes, and lines in the wrong order', () => {
    const drift = (text) => rules({ texts: { 'docs/knowledge/index.md': text } })
    expect(drift(goodIndex().replace('- [Demo]', 'Some prose.\n- [Demo]'))).toEqual(['INDEX-DRIFT'])
    const two = JSON.stringify([
      { note: NOTE_PATH, paths: ['src/modules/demo/**'] },
      { note: 'src/modules/b/README.md', paths: ['src/modules/b/**'] },
    ])
    const b = goodNote({ ...GOOD_FIELDS, name: 'B', summary: 'bee' }).replace(
      'domain/rule.ts',
      'x.ts',
    )
    const lineA = '- [Demo](../../src/modules/demo/README.md): What the demo is for'
    const lineB = '- [B](../../src/modules/b/README.md): bee'
    const texts = { 'src/modules/b/README.md': b, 'src/modules/b/x.ts': '' }
    const files = [...GOOD_FILES, 'src/modules/b/README.md', 'src/modules/b/x.ts']
    const run2 = (index) =>
      errorsOf(repo({ map: two, files, texts: { ...texts, 'docs/knowledge/index.md': index } }))
    expect(run2(goodIndex(`${lineA}\n${lineB}`))).toEqual([])
    const swapped = run2(goodIndex(`${lineB}\n${lineA}`))
    expect(swapped.map((f) => f.rule)).toEqual(['INDEX-DRIFT'])
    expect(swapped[0].message).toMatch(/order/)
  })

  it('runs the per-note rules on every map note', () => {
    expect(rules({ texts: { [NOTE_PATH]: '# Demo\n' } })).toContain('NOTE-FRONTMATTER')
  })
})
