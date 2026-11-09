import { describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { parseChartSpec } from '@/platform/lib/chart/spec'

import { fromChartSpec, toChartSpec } from './chart'
import { chartFromJsx, chartToJsx } from './chartMarkdown'

/** The day-to-day breakdown with its grid left out, as the editor and the Markdown tag carry it */
const barsOnly = parseChartSpec({ ...FIXTURES.dayToDay, squareValue: undefined, hideSquares: true })

describe('a breakdown that hides its squares', () => {
  it('goes to the stored fields and back, with no square value', () => {
    const fields = fromChartSpec(barsOnly)
    expect(fields).toMatchObject({ hideSquares: true })
    expect(toChartSpec({ blockType: 'chart', ...fields } as never)).toEqual(barsOnly)
  })

  it('is written as a tag with the setting and read back the same', () => {
    const tag = chartToJsx({ blockType: 'chart', ...fromChartSpec(barsOnly) } as never) as string
    expect(tag).toContain('hideSquares={true}')
    expect(tag).not.toContain('squareValue')
    expect(tag).toMatch(/^<Chart /)
  })

  it('reads the setting from a tag an agent wrote', () => {
    const fields = chartFromJsx({ ...FIXTURES.dayToDay, squareValue: undefined, hideSquares: true })
    expect(toChartSpec({ blockType: 'chart', ...fields } as never)).toMatchObject({
      hideSquares: true,
    })
  })
})
