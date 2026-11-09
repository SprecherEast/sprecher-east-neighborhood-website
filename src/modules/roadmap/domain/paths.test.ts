import { describe, expect, it } from 'vitest'

import { parseIssueNumber, planIssuePath } from './paths'

describe('parseIssueNumber', () => {
  it('reads plain digits and nothing else', () => {
    expect(parseIssueNumber('12')).toBe(12)
    for (const bad of ['0', '012', '1e3', '-4', 'abc', '1.5', '', '1234567890']) {
      expect(parseIssueNumber(bad)).toBeUndefined()
    }
  })

  it('is the reverse of an issue path', () => {
    expect(parseIssueNumber(planIssuePath(7).split('/').pop() ?? '')).toBe(7)
  })
})
