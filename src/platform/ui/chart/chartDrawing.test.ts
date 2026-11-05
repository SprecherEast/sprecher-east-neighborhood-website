import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { CHART_DRAWING_ATTRIBUTE } from './chartDrawing'
import { CHART_LARGE_WIDTH } from '../layoutSizes'

describe('the chart drawing marker', () => {
  it('is the attribute the Tailwind classes that style the drawing name', () => {
    expect(CHART_LARGE_WIDTH).toContain(`[${CHART_DRAWING_ATTRIBUTE}]`)
    const zoom = readFileSync(join(__dirname, 'ChartZoom.client.tsx'), 'utf8')
    expect(zoom).toContain(`scripted:[&_[${CHART_DRAWING_ATTRIBUTE}]]:cursor-zoom-in`)
  })
})
