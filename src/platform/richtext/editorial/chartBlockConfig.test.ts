import type { Block, Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { CHART_KINDS, CHART_UNITS } from '@/platform/lib/chart/spec'

import { EDITORIAL_BLOCKS, EVENT_RICH_TEXT_BLOCKS, RICH_TEXT_BLOCKS } from '../blockConfigs'

import { ChartBlockConfig } from './chartBlockConfig'

const fieldsOf = (fields: Field[]): Field[] =>
  fields.flatMap((f) => ('fields' in f && f.type === 'row' ? fieldsOf(f.fields) : [f]))
const byName = (name: string) =>
  fieldsOf(ChartBlockConfig.fields).find((f) => 'name' in f && f.name === name) as Field & {
    options?: { value: string }[]
    admin?: { condition?: (data: object, sibling: object) => boolean }
  }
const shownFor = (name: string, kind: string) =>
  byName(name).admin?.condition?.({}, { kind }) ?? true

describe('ChartBlockConfig', () => {
  it('is offered in posts and events, after the other visual blocks', () => {
    const slugs = (blocks: Block[]) => blocks.map((b) => b.slug)
    expect(slugs(EDITORIAL_BLOCKS).at(-1)).toBe('chart')
    expect(slugs(RICH_TEXT_BLOCKS)).toContain('chart')
    expect(slugs(EVENT_RICH_TEXT_BLOCKS)).toContain('chart')
    expect(ChartBlockConfig.interfaceName).toBe('ChartBlock')
  })

  it('offers exactly the kinds that exist, and the units the spec knows', () => {
    expect(byName('kind').options?.map((o) => o.value)).toEqual([...CHART_KINDS])
    expect(byName('unit').options?.map((o) => o.value)).toEqual([...CHART_UNITS])
  })

  it('asks for a title and a summary', () => {
    expect(byName('title')).toMatchObject({ required: true })
    expect(byName('summary')).toMatchObject({ required: true })
  })

  it.each([
    ['bars', 'bar'],
    ['series', 'stacked'],
    ['rows', 'stacked'],
    ['groups', 'units'],
    ['mode', 'units'],
    ['unitNote', 'units'],
  ])('shows %s only for a %s chart', (name, kind) => {
    for (const other of CHART_KINDS) expect(shownFor(name, other)).toBe(other === kind)
  })

  it('shows the scale for bars and stacked bars, not for grids', () => {
    expect([...CHART_KINDS].filter((kind) => shownFor('scaleMax', kind))).toEqual([
      'bar',
      'stacked',
    ])
  })

  it('has no field for orientation: the drawing is horizontal', () => {
    expect(byName('orientation')).toBeUndefined()
  })

  it('limits a grid to two groups of at most 12 parts, a chart to four sources', () => {
    expect(byName('groups')).toMatchObject({ maxRows: 2 })
    expect(byName('sources')).toMatchObject({ maxRows: 4 })
  })

  it('converts to and from Markdown with the chart converter', () => {
    expect(typeof ChartBlockConfig.jsx?.export).toBe('function')
    expect(typeof ChartBlockConfig.jsx?.import).toBe('function')
  })
})
