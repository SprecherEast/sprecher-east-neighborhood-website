import { describe, expect, it } from 'vitest'

import { toAccountId } from './accountRelation'

describe('toAccountId', () => {
  it('reads the id from an id, a row, or nothing', () => {
    expect(toAccountId(7)).toBe(7)
    expect(toAccountId({ id: 8 })).toBe(8)
    expect(toAccountId(null)).toBeNull()
    expect(toAccountId(undefined)).toBeNull()
  })
})
