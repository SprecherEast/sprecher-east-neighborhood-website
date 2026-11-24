/** The wording of the repository-level findings, whole. */
import { describe, expect, it } from 'vitest'

import {
  GOOD_FIELDS,
  GOOD_FILES,
  NOTE_PATH,
  errorsOf,
  goodIndex,
  goodNote,
  messagesOf,
  repo,
} from './testkit.mjs'

const FIX =
  ' (the lines under Notes are made from each note: run `npm run knowledge:structure -- --write-index`)'
const LINE_DEMO = '- [Demo](../../src/modules/demo/README.md): What the demo is for'

describe('check messages', () => {
  it('INDEX-DRIFT: says which line is missing and which is stale, cut at 90 characters, with the fix', () => {
    const long = 'y'.repeat(150)
    const longNote = goodNote({ ...GOOD_FIELDS, summary: long })
    const stale = '- [Z](../../src/z/README.md): ' + 'z'.repeat(120)
    const found = repo({
      texts: { [NOTE_PATH]: longNote, 'docs/knowledge/index.md': goodIndex(stale) },
    })
    const wanted = `- [Demo](../../src/modules/demo/README.md): ${long}`
    expect(messagesOf(found, 'INDEX-DRIFT')).toEqual([
      `missing line: ${wanted.slice(0, 90)}${FIX}`,
      `line not made from a note: ${stale.slice(0, 90)}${FIX}`,
    ])
    expect(wanted.length).toBeGreaterThan(90)
  })

  it('INDEX-DRIFT: says the lines are not in the order of the map', () => {
    const two = JSON.stringify([
      { note: NOTE_PATH, paths: ['src/modules/demo/**'] },
      { note: 'src/modules/b/README.md', paths: ['src/modules/b/**'] },
    ])
    const b = goodNote({ ...GOOD_FIELDS, name: 'B', summary: 'bee' }).replace(
      'domain/rule.ts',
      'x.ts',
    )
    const lineB = '- [B](../../src/modules/b/README.md): bee'
    const found = repo({
      map: two,
      files: [...GOOD_FILES, 'src/modules/b/README.md', 'src/modules/b/x.ts'],
      texts: {
        'src/modules/b/README.md': b,
        'docs/knowledge/index.md': goodIndex(`${lineB}\n${LINE_DEMO}`),
      },
    })
    expect(messagesOf(found, 'INDEX-DRIFT')).toEqual([
      `the lines are not in the order of the map${FIX}`,
    ])
  })

  it('says why a map entry fails: listed twice, or its note does not exist', () => {
    const twice = JSON.stringify([
      { note: NOTE_PATH, paths: ['src/modules/demo/**'] },
      { note: NOTE_PATH, paths: ['src/modules/demo/**'] },
    ])
    expect(messagesOf(repo({ map: twice }), 'MAP-NOTE')).toEqual([
      'listed twice in docs/knowledge/map.json',
    ])
    const gone = JSON.stringify([{ note: 'src/modules/gone/README.md', paths: ['src/x/**'] }])
    expect(messagesOf(repo({ map: gone }), 'MAP-NOTE')).toEqual([
      'listed in docs/knowledge/map.json but the file does not exist',
    ])
  })

  it('says why a note has no code: its paths match no file, or it names none that exists', () => {
    const empty = JSON.stringify([{ note: NOTE_PATH, paths: ['src/modules/nothing/**'] }])
    expect(messagesOf(repo({ map: empty }), 'NOTE-NO-CODE')).toEqual([
      'its map paths match no file',
    ])
    const bare = goodNote(undefined, '# Demo\n\nWhat it is.\n\n## Behaviors and events\n\n- x\n')
    expect(messagesOf(repo({ texts: { [NOTE_PATH]: bare } }), 'NOTE-NO-CODE')).toEqual([
      'it names no code: no path in it exists',
    ])
  })

  it('counts a path written from the note folder (../) as the code a note names', () => {
    const up = goodNote(
      undefined,
      '# Demo\n\nWhat it is.\n\n## Behaviors and events\n\n- See `../shared/thing.ts`.\n',
    )
    const found = repo({
      files: [...GOOD_FILES, 'src/modules/shared/thing.ts'],
      texts: { [NOTE_PATH]: up },
    })
    expect(messagesOf(found, 'NOTE-NO-CODE')).toEqual([])
  })

  it('NOTE-ORPHAN says no map entry names the note', () => {
    const other = 'src/modules/other/README.md'
    const found = repo({ texts: { [other]: goodNote() } })
    expect(messagesOf(found, 'NOTE-ORPHAN')).toEqual(['no map entry names this note'])
  })

  it('does not ask the index for a note that has a name but no summary', () => {
    const noSummary = goodNote({ ...GOOD_FIELDS, summary: undefined })
    const found = errorsOf(
      repo({ texts: { [NOTE_PATH]: noSummary, 'docs/knowledge/index.md': goodIndex('') } }),
    )
    expect(found.map((f) => f.rule)).toEqual(['NOTE-FIELDS'])
  })
})
