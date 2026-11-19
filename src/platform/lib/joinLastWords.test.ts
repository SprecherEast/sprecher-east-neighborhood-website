import { describe, expect, it } from 'vitest'

import { joinLastWords } from './joinLastWords'

describe('joinLastWords', () => {
  it('ties the last two words with a no-break space, so a phrase never ends a line on a lone short word', () => {
    expect(joinLastWords('+$90 a year')).toBe('+$90 a\u00a0year')
    expect(joinLastWords('$1.2 billion')).toBe('$1.2\u00a0billion')
  })

  it('leaves a single word, an empty string and trailing space as they are', () => {
    expect(joinLastWords('$477.5M')).toBe('$477.5M')
    expect(joinLastWords('')).toBe('')
    expect(joinLastWords('  ')).toBe('  ')
  })

  it('only touches the last gap', () => {
    expect(joinLastWords('one two three four')).toBe('one two three\u00a0four')
  })
})
