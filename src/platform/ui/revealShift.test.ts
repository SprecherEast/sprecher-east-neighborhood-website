import { describe, expect, it } from 'vitest'

import { revealShift } from './revealShift'

// A 800 px screen whose sticky header takes the top 80 px
const SCREEN = { viewportHeight: 800, offset: 80 }

describe('revealShift (#1178)', () => {
  it('moves nothing when the end shows and the anchor is clear of the header', () => {
    expect(revealShift({ ...SCREEN, anchorTop: 200, boxBottom: 700 })).toBe(0)
  })

  it('scrolls down just far enough to show the end when the anchor can stay below the header', () => {
    expect(revealShift({ ...SCREEN, anchorTop: 400, boxBottom: 900 })).toBe(100)
  })

  it('lets the anchor win when the end and the anchor cannot both show', () => {
    // The end is 600 px down, but the anchor may only move 120 px before it meets the header
    expect(revealShift({ ...SCREEN, anchorTop: 200, boxBottom: 1400 })).toBe(120)
  })

  it('scrolls back up to an anchor that sits under the header, even when the end shows', () => {
    expect(revealShift({ ...SCREEN, anchorTop: 20, boxBottom: 500 })).toBe(-60)
  })

  it('scrolls up to an anchor under the header even when the end is below the screen', () => {
    expect(revealShift({ ...SCREEN, anchorTop: 20, boxBottom: 1000 })).toBe(-60)
  })

  it('rounds to whole pixels', () => {
    expect(revealShift({ ...SCREEN, anchorTop: 400.4, boxBottom: 900.2 })).toBe(100)
  })
})
