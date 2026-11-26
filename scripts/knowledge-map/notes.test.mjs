import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

import { bulletsOf, linkedPaths, readNote, resolveToken } from './notes.mjs'

const schema = JSON.parse(fs.readFileSync('docs/knowledge/note-schema.json', 'utf8'))

const NOTE = `---
name: 'Demo'
type: module
summary: 'what the demo is for.'
aliases: ['sample', 'trial']
relationships:
  - type: depends-on
    target: src/platform/lib
---

# Demo module

Purpose, in a line. See [events](../events/README.md#top) and [outside](https://example.com/x.md).

## Behaviors and events

- Saving refreshes the page (\`cms/save.ts\`).

## Rules and the tests that protect them

- Only a Google address is stored: \`cms/map.test.ts\`, \`ui/Map.test.tsx\`.
- A save refreshes the right routes and tags,
  and nothing else: \`cms/save.test.ts\`.
- A rule with no test.

## Decisions

- [0008](../../../docs/architecture/decisions/0008-composition-root.md) and issue #12.

## Known gaps

- Search ignores accents (#44).
- The hero has no dark variant.
`

const FILES = [
  'src/modules/demo/README.md',
  'src/modules/demo/cms/map.test.ts',
  'src/modules/demo/ui/Map.test.tsx',
  'src/modules/demo/cms/save.test.ts',
  'src/modules/events/README.md',
  'docs/architecture/decisions/0008-composition-root.md',
]

describe('bulletsOf', () => {
  it('splits list items, joins a wrapped line and drops comments', () => {
    expect(bulletsOf('<!-- hint -->\n- one\n- two\n  wrapped\n\n- three')).toEqual([
      'one',
      'two wrapped',
      'three',
    ])
  })

  it('reads a paragraph as one item and "None" as no item', () => {
    expect(bulletsOf('Just a sentence.\nIt goes on.')).toEqual(['Just a sentence. It goes on.'])
    expect(bulletsOf('None')).toEqual([])
    expect(bulletsOf('None.\n')).toEqual([])
    expect(bulletsOf('')).toEqual([])
  })
})

describe('resolveToken', () => {
  it('reads a path from the note folder, then as the end of a path in the repository', () => {
    expect(resolveToken('cms/map.test.ts', 'src/modules/demo', FILES)).toBe(
      'src/modules/demo/cms/map.test.ts',
    )
    expect(resolveToken('src/modules/events/README.md', 'src/modules/demo', FILES)).toBe(
      'src/modules/events/README.md',
    )
    expect(resolveToken('nope.ts', 'src/modules/demo', FILES)).toBeNull()
  })
})

describe('linkedPaths', () => {
  it('resolves relative links to repository paths and leaves outside links and anchors out', () => {
    const links = linkedPaths(NOTE, 'src/modules/demo/README.md')
    expect(links).toEqual([
      'docs/architecture/decisions/0008-composition-root.md',
      'src/modules/events/README.md',
    ])
  })
})

describe('readNote', () => {
  const note = readNote('src/modules/demo/README.md', NOTE, { schema, files: FILES })

  it('takes the fields from the front matter', () => {
    expect(note).toMatchObject({
      name: 'Demo',
      type: 'module',
      summary: 'what the demo is for.',
      aliases: ['sample', 'trial'],
      relationships: [{ type: 'depends-on', target: 'src/platform/lib' }],
    })
  })

  it('reads the known gaps as watch-outs', () => {
    expect(note.watchOuts).toEqual([
      'Search ignores accents (#44).',
      'The hero has no dark variant.',
    ])
  })

  it('reads each rule with the tests that exist', () => {
    expect(note.rules).toEqual([
      {
        text: 'Only a Google address is stored: `cms/map.test.ts`, `ui/Map.test.tsx`.',
        tests: ['src/modules/demo/cms/map.test.ts', 'src/modules/demo/ui/Map.test.tsx'],
      },
      {
        text: 'A save refreshes the right routes and tags, and nothing else: `cms/save.test.ts`.',
        tests: ['src/modules/demo/cms/save.test.ts'],
      },
      { text: 'A rule with no test.', tests: [] },
    ])
  })

  it('lists the decision records the Decisions section links', () => {
    expect(note.decisions).toEqual(['docs/architecture/decisions/0008-composition-root.md'])
  })

  it('lists the headings and the purpose', () => {
    expect(note.sections).toEqual([
      'Behaviors and events',
      'Rules and the tests that protect them',
      'Decisions',
      'Known gaps',
    ])
    expect(note.title).toBe('Demo module')
  })

  it('counts the paths the text names', () => {
    expect(note.names).toBeGreaterThan(3)
    expect(readNote('x.md', '# X\n\nNothing named.\n', { schema, files: [] }).names).toBe(0)
  })

  it('gives empty fields for a note with no front matter', () => {
    const bare = readNote('x.md', '# X\n\nText.\n', { schema, files: [] })
    expect(bare).toMatchObject({
      name: '',
      type: '',
      summary: '',
      aliases: [],
      relationships: [],
      watchOuts: [],
    })
  })
})
