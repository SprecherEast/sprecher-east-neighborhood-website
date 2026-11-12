import { describe, expect, it } from 'vitest'

import { SHARE_TONES } from './shareTones'

describe('SHARE_TONES', () => {
  it('draws the highlighted slice in the primary green, solid, in the bar and the receipt square', () => {
    expect(SHARE_TONES.highlight.fill).toBe('fill-primary')
    expect(SHARE_TONES.highlight.swatch).toContain('bg-primary')
  })

  it('draws the other slices in neutral tones of three different lightness', () => {
    const fills = [SHARE_TONES.strong, SHARE_TONES.medium, SHARE_TONES.light].map((t) => t.fill)
    expect(new Set(fills).size).toBe(3)
    for (const fill of fills) expect(fill).toContain('muted-foreground')
  })
})
