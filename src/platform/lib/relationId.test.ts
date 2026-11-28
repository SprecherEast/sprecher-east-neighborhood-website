import { describe, expect, it } from 'vitest'

import { relationId } from './relationId'

describe('relationId', () => {
  it('reads the id of a populated value, a bare id, and nothing', () => {
    expect(relationId({ id: 7 })).toBe(7)
    expect(relationId(7)).toBe(7)
    expect(relationId(null)).toBeNull()
    expect(relationId(undefined)).toBeNull()
  })
})
