import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { VIEWPORTS, parseViewports, viewportOptions } from './viewports'

const GUIDELINE = path.join(__dirname, '../docs/guidelines/nextjs-tailwind.md')

describe('parseViewports', () => {
  it('reads the numbered rows of the guideline table, name and width', () => {
    const table = [
      '## Responsive Design — 6-Viewport Testing',
      '| #   | Name     | Width | Represents |',
      '| --- | -------- | ----- | ---------- |',
      '| 1   | Phone    | 320px | small      |',
      '| 2   | Big desk | 1920px | large     |',
    ].join('\n')

    expect(parseViewports(table)).toEqual([
      { name: 'Phone', width: 320 },
      { name: 'Big desk', width: 1920 },
    ])
  })

  it('reads only the viewport section, not another table with a px column', () => {
    const doc = [
      '## Spacing',
      '| 1 | Gap | 8px | x |',
      '## Responsive Design — 6-Viewport Testing',
      '| 1 | Phone | 320px | small |',
      '## Images',
      '| 2 | Thumb | 96px | y |',
    ].join('\n')

    expect(parseViewports(doc)).toEqual([{ name: 'Phone', width: 320 }])
  })

  it('fails loudly when the table is gone, so the list is never silently empty', () => {
    expect(() => parseViewports('no table here')).toThrow(/viewport table/i)
  })
})

describe('the showcase viewports', () => {
  // Read the table again by the rows' own text, not through the parser under test
  const section =
    readFileSync(GUIDELINE, 'utf8')
      .split(/^## /m)
      .find((part) => part.startsWith('Responsive Design')) ?? ''
  const guidelineWidths = [...section.matchAll(/^\|\s*\d+\s*\|[^|]+\|\s*(\d+)px\s*\|/gm)].map(
    (row) => Number(row[1]),
  )

  it('are exactly the widths the design guideline names, in its order', () => {
    expect(guidelineWidths.length).toBeGreaterThan(0)
    expect(VIEWPORTS.map((viewport) => viewport.width)).toEqual(guidelineWidths)
  })

  it('reach the toolbar as one option per width, sized to that width', () => {
    const options = viewportOptions(VIEWPORTS)

    expect(Object.values(options).map((option) => option.styles.width)).toEqual(
      guidelineWidths.map((width) => `${width}px`),
    )
    expect(Object.values(options).map((option) => option.name)).toEqual(
      VIEWPORTS.map((viewport) => `${viewport.name} (${viewport.width}px)`),
    )
  })
})
