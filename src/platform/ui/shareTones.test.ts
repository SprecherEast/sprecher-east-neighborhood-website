import { describe, expect, it } from 'vitest'

import { CHART_RAMP } from './chart/chartPalette'
import { SHARE_TONE_ORDER, SHARE_TONES } from './shareTones'

describe('SHARE_TONES', () => {
  it('draws each tone in one step of the breakdown chart ramp, so the bar and the chart share colors', () => {
    expect(SHARE_TONES.rust.fill).toBe(CHART_RAMP[0].fill)
    expect(SHARE_TONES.amber.fill).toBe(CHART_RAMP[1].fill)
    expect(SHARE_TONES.mint.fill).toBe(CHART_RAMP[2].fill)
    expect(SHARE_TONES.green.fill).toBe(CHART_RAMP[3].fill)
  })

  it('gives four different fills', () => {
    expect(new Set(Object.values(SHARE_TONES).map((t) => t.fill)).size).toBe(4)
  })

  it('gives every tone a swatch background and an order of four for a chart key (#1503)', () => {
    expect(SHARE_TONE_ORDER).toHaveLength(4)
    for (const name of SHARE_TONE_ORDER) expect(SHARE_TONES[name].bg).toMatch(/^bg-chart-ramp-\d/)
  })

  it('gives every tone a line of its own color for a nested row', () => {
    for (const tone of Object.values(SHARE_TONES)) {
      expect(tone.edge).toMatch(/^border-chart-ramp-\d/)
    }
  })
})
