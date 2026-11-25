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

  it('gives one finding, not two, to a note whose paths match nothing and that names no code', () => {
    const empty = JSON.stringify([{ note: NOTE_PATH, paths: ['src/modules/nothing/**'] }])
    const bare = goodNote(undefined, '# Demo\n\nWhat it is.\n\n## Behaviors and events\n\n- x\n')
    const found = repo({ map: empty, texts: { [NOTE_PATH]: bare } })
    expect(messagesOf(found, 'NOTE-NO-CODE')).toEqual(['its map paths match no file'])
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

  const notesOf = (found, rule) => found.filter((f) => f.rule === rule).map((f) => f.note)

  it('names, in each finding, the note or file it is about', () => {
    const twice = JSON.stringify([
      { note: NOTE_PATH, paths: ['src/modules/demo/**'] },
      { note: NOTE_PATH, paths: ['src/modules/demo/**'] },
    ])
    expect(notesOf(repo({ map: twice }), 'MAP-NOTE')).toEqual([NOTE_PATH])
    const gone = JSON.stringify([{ note: 'src/modules/gone/README.md', paths: ['src/x/**'] }])
    expect(notesOf(repo({ map: gone }), 'MAP-NOTE')).toEqual(['src/modules/gone/README.md'])
    const empty = JSON.stringify([{ note: NOTE_PATH, paths: ['src/modules/nothing/**'] }])
    expect(notesOf(repo({ map: empty }), 'NOTE-NO-CODE')).toEqual([NOTE_PATH])
    const other = 'src/modules/other/README.md'
    expect(notesOf(repo({ texts: { [other]: goodNote() } }), 'NOTE-ORPHAN')).toEqual([other])
    const drift = repo({ texts: { 'docs/knowledge/index.md': goodIndex('') } })
    expect(notesOf(drift, 'INDEX-DRIFT')).toEqual(['docs/knowledge/index.md'])
    const lonely = repo({ files: [...GOOD_FILES, 'src/c/y.ts'] })
    expect(notesOf(lonely, 'COVERAGE-CODE')).toEqual(['docs/knowledge/map.json'])
  })

  it('names the index in every index finding: missing, stale, order, no section, no file', () => {
    const stale = goodIndex('- [Z](../../src/z/README.md): z')
    const two = JSON.stringify([
      { note: NOTE_PATH, paths: ['src/modules/demo/**'] },
      { note: 'src/modules/b/README.md', paths: ['src/modules/b/**'] },
    ])
    const b = goodNote({ ...GOOD_FIELDS, name: 'B', summary: 'bee' }).replace(
      'domain/rule.ts',
      'x.ts',
    )
    const lineB = '- [B](../../src/modules/b/README.md): bee'
    const swapped = repo({
      map: two,
      files: [...GOOD_FILES, 'src/modules/b/README.md', 'src/modules/b/x.ts'],
      texts: {
        'src/modules/b/README.md': b,
        'docs/knowledge/index.md': goodIndex(`${lineB}\n${LINE_DEMO}`),
      },
    })
    const cases = [
      repo({ texts: { 'docs/knowledge/index.md': stale } }),
      swapped,
      repo({ texts: { 'docs/knowledge/index.md': '# x\n' } }),
      repo({ texts: { 'docs/knowledge/index.md': undefined } }),
    ]
    for (const found of cases) {
      const notes = notesOf(found, 'INDEX-DRIFT')
      expect(notes.length).toBeGreaterThan(0)
      expect(new Set(notes)).toEqual(new Set(['docs/knowledge/index.md']))
    }
    expect(notesOf(cases[0], 'INDEX-DRIFT')).toHaveLength(2)
  })

  it('says a note names no code when every path it names is missing', () => {
    const body = '# Demo\n\nWhat it is.\n\n## Behaviors and events\n\n- See `domain/gone.ts`.\n'
    const found = repo({ texts: { [NOTE_PATH]: goodNote(undefined, body) } })
    expect(messagesOf(found, 'NOTE-NO-CODE')).toEqual(['it names no code: no path in it exists'])
    expect(notesOf(found, 'NOTE-NO-CODE')).toEqual([NOTE_PATH])
  })

  it('names the index in the message when it has no Notes section, or does not exist', () => {
    const none = repo({ texts: { 'docs/knowledge/index.md': '# Index\n' } })
    expect(messagesOf(none, 'INDEX-DRIFT')).toEqual([
      'docs/knowledge/index.md has no "## Notes" section',
    ])
    const absent = repo({ texts: { 'docs/knowledge/index.md': undefined } })
    expect(messagesOf(absent, 'INDEX-DRIFT')).toEqual(['docs/knowledge/index.md does not exist'])
  })

  it('reports the map findings first, then each note in map order, then the index and the code', () => {
    const empty = JSON.stringify([{ note: NOTE_PATH, paths: ['src/modules/nothing/**'] }])
    const bad = goodNote({ ...GOOD_FIELDS, type: 'widget' })
    const found = repo({
      map: empty,
      texts: { [NOTE_PATH]: bad, 'docs/knowledge/index.md': goodIndex('') },
      files: [...GOOD_FILES, 'src/c/y.ts'],
    })
    const order = found.map((f) => f.rule).filter((rule, i, all) => all.indexOf(rule) === i)
    expect(order).toEqual(['NOTE-NO-CODE', 'NOTE-TYPE', 'INDEX-DRIFT', 'COVERAGE-CODE'])
  })
})
