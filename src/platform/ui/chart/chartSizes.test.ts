import { describe, expect, it } from 'vitest'

import { SMALL_TEXT } from '@/platform/ui/Text'
import { CHART_SMALL_WIDTH } from '@/platform/ui/layoutSizes'

import { BAR_HEIGHT, FONT_SIZE, SMALL_FONT_SIZE, VIEW_WIDTH } from './adapters/visx/barLayout'
import { CHART_BAR_THICKNESS_CLASS, CHART_BAR_THICKNESS_PX, CHART_TEXT_PX } from './chartSizes'

/** Tailwind's own scale, in px: 1 unit is 4px, and these two text steps are the ones the kit uses */
const TEXT_STEP_PX: Record<string, number> = { 'text-sm': 14, 'text-base': 16 }
const classPx = (name: string) => Number(name.replace(/^h-/, '')) * 4

describe('the sizes every chart and data display of bars shares (#1503)', () => {
  it('draws a bar as thick as the breakdown chart’s own bars, from one class', () => {
    expect(classPx(CHART_BAR_THICKNESS_CLASS)).toBe(CHART_BAR_THICKNESS_PX)
  })

  it('sets a detail (values, notes) in the kit’s small text, and a name and total in the body text', () => {
    const small = SMALL_TEXT.split(' ').find((c) => c in TEXT_STEP_PX)
    expect(small && TEXT_STEP_PX[small]).toBe(CHART_TEXT_PX.detail)
    expect(CHART_TEXT_PX.name).toBe(TEXT_STEP_PX['text-base'])
  })

  it('has the bar chart draw with those sizes, one for one', () => {
    expect(BAR_HEIGHT).toBe(CHART_BAR_THICKNESS_PX)
    expect(FONT_SIZE).toBe(CHART_TEXT_PX.name)
    expect(SMALL_FONT_SIZE).toBe(CHART_TEXT_PX.detail)
  })

  it('shows the drawing 1:1 at the thumbnail width, so its units are the page’s pixels', () => {
    expect(CHART_SMALL_WIDTH).toContain('--chart-small-width')
    expect(VIEW_WIDTH).toBe(20 * 16)
  })
})
