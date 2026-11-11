import { describe, expect, it } from 'vitest'

import { tabAnchors } from './tabAnchors'

describe('tabAnchors (#1097)', () => {
  it('names each tab from its label, with a prefix so a heading of the same words is not mistaken for it', () => {
    expect(tabAnchors(['Your share', 'The City’s budget'])).toEqual([
      'tab-your-share',
      'tab-the-citys-budget',
    ])
  })

  it('numbers a repeated name, so every tab keeps a link of its own', () => {
    expect(tabAnchors(['Home', 'Home', 'Home'])).toEqual(['tab-home', 'tab-home-2', 'tab-home-3'])
  })

  it('is the same on every render', () => {
    expect(tabAnchors(['A', 'B'])).toEqual(tabAnchors(['A', 'B']))
  })
})
