import { describe, expect, it } from 'vitest'

import { idsOf } from './idsOf'

describe('idsOf', () => {
  it('reads ids from ids and from loaded documents, and skips anything else', () => {
    expect(idsOf([3, { id: 4 }, null, undefined])).toEqual([3, 4])
    expect(idsOf(undefined)).toEqual([])
    expect(idsOf(null)).toEqual([])
  })
})
