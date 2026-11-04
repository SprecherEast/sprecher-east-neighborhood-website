import { describe, expect, it } from 'vitest'

import { CERTAINTIES, CERTAINTY_LABELS, CERTAINTY_OPTIONS, isCertainty } from './certainty'

describe('certainty', () => {
  it('has a word and an editor choice for every level', () => {
    expect(Object.keys(CERTAINTY_LABELS)).toEqual([...CERTAINTIES])
    expect(CERTAINTY_OPTIONS.map((option) => option.value)).toEqual([...CERTAINTIES])
  })

  it('recognises only the three levels', () => {
    expect(isCertainty('estimate')).toBe(true)
    expect(isCertainty('sure')).toBe(false)
    expect(isCertainty(undefined)).toBe(false)
  })
})
