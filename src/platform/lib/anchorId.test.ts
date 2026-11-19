import { describe, expect, it } from 'vitest'

import { anchorId } from './anchorId'

describe('anchorId', () => {
  it('writes words as a readable address part, folding accents to their letters', () => {
    expect(anchorId('Café & the "Big" Plan')).toBe('cafe-the-big-plan')
  })

  it('never comes back empty', () => {
    expect(anchorId('???')).toBe('section')
  })
})
