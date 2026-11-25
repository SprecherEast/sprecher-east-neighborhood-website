/** How a note's text is read (its dashes, its line endings) and how the schema is read for it. */
import { expect, it } from 'vitest'

import { checkNote, keyOfKind } from './rules.mjs'
import {
  GOOD_BODY,
  GOOD_FIELDS,
  GOOD_FILES,
  NOTE_PATH,
  errorsOf,
  frontmatter,
  goodNote,
  strict,
} from './testkit.mjs'

const run = (text) =>
  errorsOf(checkNote({ schema: strict, path: NOTE_PATH, text, files: GOOD_FILES }))

it('keeps front matter out of the note when a body repeats the dashes', () => {
  expect(run(frontmatter(GOOD_FIELDS) + GOOD_BODY + '\n---\n\ntext\n')).toEqual([])
})

it('reads a note with Windows line endings like any other', () => {
  expect(run(goodNote().replace(/\n/g, '\r\n'))).toEqual([])
})

it('finds the key of the first field of a kind, or nothing', () => {
  const fields = [
    { key: 'first', kind: 'noteType' },
    { key: 'other', kind: 'text' },
    { key: 'second', kind: 'noteType' },
  ]
  expect(keyOfKind({ fields }, 'noteType')).toBe('first')
  expect(keyOfKind({ fields }, 'text')).toBe('other')
  expect(keyOfKind({ fields }, 'relationships')).toBeUndefined()
})
