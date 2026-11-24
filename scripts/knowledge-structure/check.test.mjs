import { describe, expect, it } from 'vitest'

import { checkKnowledge } from './check.mjs'
import {
  GOOD_FILES,
  GOOD_MAP,
  NOTE_PATH,
  errorsOf,
  goodIndex,
  goodNote,
  schema,
  strict,
} from './testkit.mjs'

const repo = (over = {}) => {
  const texts = {
    [NOTE_PATH]: goodNote(),
    'docs/knowledge/index.md': goodIndex(),
    ...over.texts,
  }
  const files = over.files ?? [...new Set([...GOOD_FILES, ...Object.keys(texts)])]
  return checkKnowledge({
    schema: over.schema ?? strict,
    mapJson: over.map ?? GOOD_MAP,
    files,
    read: (path) => texts[path],
  })
}
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

  it('COVERAGE-CODE: warns once about source code no map entry describes', () => {
    const files = [...GOOD_FILES, 'src/lib/a.ts', 'src/lib/a.test.ts', 'src/app/x/page.tsx']
    const found = repo({ schema, files }).filter((f) => f.rule === 'COVERAGE-CODE')
    expect(found).toHaveLength(1)
    expect(found[0].severity).toBe('warning')
    expect(found[0].message).toMatch(/2 source files/)
  })

  it('runs the per-note rules on every map note', () => {
    expect(rules({ texts: { [NOTE_PATH]: '# Demo\n' } })).toContain('NOTE-FRONTMATTER')
  })
})
