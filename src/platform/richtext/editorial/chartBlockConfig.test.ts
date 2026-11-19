import type { Block, Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { CHART_KINDS, CHART_LIMITS, CHART_UNITS } from '@/platform/lib/chart/spec'

import { EDITORIAL_BLOCKS, EVENT_RICH_TEXT_BLOCKS, RICH_TEXT_BLOCKS } from '../blockConfigs'

import { ChartBlockConfig } from './chartBlockConfig'

/** Every field, including those inside rows and arrays (an array comes before its own fields) */
const fieldsOf = (fields: Field[]): Field[] =>
  fields.flatMap((f) =>
    'fields' in f ? (f.type === 'row' ? fieldsOf(f.fields) : [f, ...fieldsOf(f.fields)]) : [f],
  )
const byName = (name: string) =>
  fieldsOf(ChartBlockConfig.fields).find((f) => 'name' in f && f.name === name) as Field & {
    options?: { value: string }[]
    admin?: { condition?: (data: object, sibling: object) => boolean }
  }
const shownFor = (name: string, kind: string) =>
  byName(name).admin?.condition?.({}, { kind }) ?? true

describe('ChartBlockConfig', () => {
  it('gives every array an admin config: Payload reads admin.initCollapsed of each one', () => {
    const arrays = fieldsOf(ChartBlockConfig.fields).filter((f) => f.type === 'array')
    expect(arrays.length).toBeGreaterThan(4)
    for (const array of arrays) expect('admin' in array && array.admin).toBeTruthy()
  })

  it('has a checkbox to turn enlarging off, on by default, with its label (#686)', () => {
    const field = byName('enlarge') as Field & { defaultValue?: unknown; label?: unknown }
    expect(field.type).toBe('checkbox')
    expect(field.defaultValue).toBe(true)
    expect(field.label).toBe('Readers can tap to enlarge this chart')
  })

  it('is offered in posts and events', () => {
    const slugs = (blocks: Block[]) => blocks.map((b) => b.slug)
    expect(slugs(EDITORIAL_BLOCKS)).toContain('chart')
    expect(slugs(RICH_TEXT_BLOCKS)).toContain('chart')
    expect(slugs(EVENT_RICH_TEXT_BLOCKS)).toContain('chart')
    expect(ChartBlockConfig.interfaceName).toBe('ChartBlock')
  })

  it('offers exactly the kinds that exist, and the units the spec knows', () => {
    expect(byName('kind').options?.map((o) => o.value)).toEqual([...CHART_KINDS])
    expect(byName('unit').options?.map((o) => o.value)).toEqual([...CHART_UNITS])
  })

  it('leaves "at least one row" to the chart rules, so no native message competes with the reason', () => {
    for (const name of ['bars', 'series', 'rows', 'groups']) {
      expect(byName(name)).not.toHaveProperty('required')
      expect(byName(name)).not.toHaveProperty('minRows')
    }
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

  it('takes every limit from the spec, so the editor accepts what the spec does', () => {
    expect(byName('groups')).toMatchObject({ maxRows: CHART_LIMITS.groups })
    expect(byName('sources')).toMatchObject({ maxRows: CHART_LIMITS.sources })
    expect(byName('bars')).toMatchObject({ maxRows: CHART_LIMITS.rows })
    expect(byName('series')).toMatchObject({ maxRows: CHART_LIMITS.parts })
    expect(byName('title')).toMatchObject({ maxLength: CHART_LIMITS.title })
    expect(byName('summary')).toMatchObject({ maxLength: CHART_LIMITS.summary })
    expect(byName('unitNote')).toMatchObject({ maxLength: CHART_LIMITS.unitNote })
    // a 61 to 120 character citation passes the spec, so it must save
    expect(byName('linkLabel')).toMatchObject({ maxLength: CHART_LIMITS.sourceLabel })
    expect(byName('linkUrl')).toMatchObject({ maxLength: CHART_LIMITS.sourceHref })
  })

  it('converts to and from Markdown with the chart converter', () => {
    expect(typeof ChartBlockConfig.jsx?.export).toBe('function')
    expect(typeof ChartBlockConfig.jsx?.import).toBe('function')
  })
})
