import { describe, expect, it } from 'vitest'

import { plainTitle } from './title'

describe('plainTitle', () => {
  it.each([
    ['feat: Fact tabs', 'Fact tabs'],
    ['fix(ui): Tabs wrap on a phone', 'Tabs wrap on a phone'],
    ['docs!: New guide', 'New guide'],
    ['Feat: Capital first', 'Capital first'],
    ['chore:   Spaces trimmed', 'Spaces trimmed'],
  ])('drops the type prefix of %s', (title, expected) => {
    expect(plainTitle(title)).toBe(expected)
  })

  it('leaves titles without a prefix alone', () => {
    expect(plainTitle('Where our property tax goes')).toBe('Where our property tax goes')
    expect(plainTitle('Question: who pays?')).toBe('Question: who pays?')
  })

  it('starts the title with a capital letter once the prefix is gone', () => {
    expect(plainTitle('feat: add charts')).toBe('Add charts')
  })

  it('keeps the whole title when nothing would be left', () => {
    expect(plainTitle('feat:')).toBe('feat:')
  })
})
