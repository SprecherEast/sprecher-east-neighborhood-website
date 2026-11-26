import { describe, expect, it } from 'vitest'

import { parseNote } from './note.mjs'
import { GOOD_BODY, GOOD_FIELDS, frontmatter, goodNote } from './testkit.mjs'

describe('parseNote', () => {
  it('reads the fields in the order written, the title, the purpose and the sections', () => {
    const note = parseNote(goodNote())
    expect(Object.keys(note.data)).toEqual(Object.keys(GOOD_FIELDS))
    expect(note.title).toBe('Demo')
    expect(note.purposeLines).toBe(1)
    expect(note.sections).toEqual([{ heading: 'Behaviors and events', line: 5 }])
  })

  it('counts the lines below the front matter, trailing newline not counted', () => {
    expect(parseNote(goodNote()).bodyLines).toBe(GOOD_BODY.split('\n').length - 1)
  })

  it('says when there is no front matter, and when it does not parse', () => {
    expect(parseNote(GOOD_BODY).hasFrontmatter).toBe(false)
    const broken = parseNote('---\nname: a: b: c\n---\n' + GOOD_BODY)
    expect(broken.hasFrontmatter).toBe(true)
    expect(broken.error).toMatch(/\S/)
    expect(parseNote('---\n- a\n- b\n---\n' + GOOD_BODY).error).toMatch(/not a list of fields/)
  })

  it('keeps only the first line of the parser message, without its code snippet', () => {
    const { error } = parseNote('---\nname: [1,\n---\n' + GOOD_BODY)
    expect(error).toBe('unexpected end of the stream within a flow collection (2:1)')
  })

  it('starts the body after a closing line with trailing spaces or extra dashes', () => {
    for (const closing of ['---   ', '----']) {
      const note = parseNote(`---\nname: a\n${closing}\n# T\n\nText.\n\n## S\n`)
      expect(note.title).toBe('T')
      expect(note.sections).toEqual([{ heading: 'S', line: 5 }])
    }
  })

  it('says a front matter that is a plain value is not a list of fields', () => {
    expect(parseNote('---\njust text\n---\n# T\n').error).toMatch(/not a list of fields/)
  })

  it('ignores headings inside code fences and keeps deeper headings out of the sections', () => {
    const body = '# T\n\nPurpose.\n\n```md\n## Not a section\n```\n\n## Boundaries\n\n### Deeper\n'
    expect(parseNote(frontmatter(GOOD_FIELDS) + body).sections.map((s) => s.heading)).toEqual([
      'Boundaries',
    ])
  })

  it('reads Windows line endings as the same note', () => {
    const unix = parseNote(goodNote())
    const windows = parseNote(goodNote().replace(/\n/g, '\r\n'))
    expect(windows).toEqual(unix)
  })

  it('finds no title when the first line is not a level 1 heading', () => {
    expect(parseNote(frontmatter(GOOD_FIELDS) + '\nText first\n# Late\n').title).toBeNull()
  })

  it('says exactly why a front matter that is not a list of fields is refused', () => {
    expect(parseNote('---\njust text\n---\n# T\n').error).toBe(
      'the front matter is not a list of fields (key: value)',
    )
  })

  it('skips several blank lines before the title, and trims the title and each heading', () => {
    const note = parseNote(
      frontmatter(GOOD_FIELDS) + '\n\n\n# Demo  \n\nPurpose.\n\n## Boundaries   \n',
    )
    expect(note.title).toBe('Demo')
    expect(note.sections.map((s) => s.heading)).toEqual(['Boundaries'])
  })

  it('reads a title only from a line that starts with one # and a space', () => {
    expect(parseNote('## Deeper\n\nText.\n').title).toBeNull()
    expect(parseNote('See # here\n').title).toBeNull()
    expect(parseNote('#Nospace\n').title).toBeNull()
  })

  it('counts a line of spaces as no purpose, and a line of words as one', () => {
    expect(parseNote('# T\n   \n\n## S\n').purposeLines).toBe(0)
    expect(parseNote('# T\n  \nOne.\n\n## S\n').purposeLines).toBe(1)
  })

  it('opens a code fence only at the start of a line, so a ``` inside text hides nothing', () => {
    const body = '# T\n\nUse ``` for code.\n\n## Boundaries\n'
    expect(parseNote(body).sections.map((s) => s.heading)).toEqual(['Boundaries'])
    const indented = '# T\n\n  ```\n## Hidden\n  ```\n\n## Shown\n'
    expect(parseNote(indented).sections.map((s) => s.heading)).toEqual(['Shown'])
  })

  it('starts the body after the same closing line the front matter ends at, whatever it holds', () => {
    const doubled = parseNote('---\n---\nname: a\n---\n# T\n\nPurpose.\n\n## S\n')
    expect(doubled.error).toBeNull()
    expect(doubled.data).toEqual({ name: 'a' })
    expect(doubled.title).toBe('T')
    expect(doubled.sections).toEqual([{ heading: 'S', line: 5 }])
  })

  it.each(['---\nname: a\n---', '---\nname: a\n---  ', '---\nname: a\n--- text'])(
    'has an empty body when the closing line ends the file: %j',
    (text) => {
      const note = parseNote(text)
      expect(note.hasFrontmatter).toBe(true)
      expect(note.title).toBeNull()
      expect(note.body).toBe('')
    },
  )

  it('keeps data an empty object when the front matter is not a mapping, and says why', () => {
    for (const fields of ['- a', 'abc', '5', 'true']) {
      const note = parseNote(`---\n${fields}\n---\n# T\n`)
      expect(note.data).toEqual({})
      expect(note.error).toBe('the front matter is not a list of fields (key: value)')
    }
  })
})

describe('parseNote: sections with nothing under their heading', () => {
  const empties = (body) =>
    parseNote(frontmatter(GOOD_FIELDS) + '\n# T\n\nPurpose.\n\n' + body).emptySections

  it('lists a heading followed by another heading, by blank lines or by a comment only', () => {
    expect(empties('## A\n\n## B\n\n\n## C\n<!-- x -->\n\n## D\n\ntext\n')).toEqual(['A', 'B', 'C'])
  })

  it('does not list a section with text, a list, a deeper heading or a code block', () => {
    expect(empties('## A\ntext\n## B\n- x\n## C\n### d\n## D\n```\nx\n```\n')).toEqual([])
  })

  it('lists the last heading of the note when nothing follows it', () => {
    expect(empties('## A\n\ntext\n\n## B\n')).toEqual(['B'])
  })
})
