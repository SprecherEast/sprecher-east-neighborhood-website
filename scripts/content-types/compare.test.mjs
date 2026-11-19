import { describe, expect, it } from 'vitest'

import { compareFiles, describeDifferences } from './compare.mjs'

describe('compareFiles', () => {
  it('finds no difference between equal sets', () => {
    const files = new Map([['a.md', 'one']])
    expect(compareFiles(files, new Map(files))).toEqual({ changed: [], missing: [], extra: [] })
  })

  it('finds a changed page, a page not yet written and a page no longer generated', () => {
    const expected = new Map([
      ['a.md', 'new'],
      ['b.md', 'x'],
    ])
    const actual = new Map([
      ['a.md', 'old'],
      ['c.md', 'y'],
    ])
    expect(compareFiles(expected, actual)).toEqual({
      changed: ['a.md'],
      missing: ['b.md'],
      extra: ['c.md'],
    })
  })
})

describe('describeDifferences', () => {
  it('is empty when nothing differs', () => {
    expect(describeDifferences({ changed: [], missing: [], extra: [] }, 'docs/x')).toBe('')
  })

  it('names each file and tells the author to run docs:generate', () => {
    const message = describeDifferences(
      { changed: ['events.md'], missing: [], extra: [] },
      'docs/x',
    )
    expect(message).toContain('changed: events.md')
    expect(message).toContain('Run `npm run docs:generate`')
  })
})
