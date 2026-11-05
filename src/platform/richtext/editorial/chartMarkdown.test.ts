import { readFileSync } from 'node:fs'
import path from 'node:path'

import { extractPropsFromJSXPropsString } from '@payloadcms/richtext-lexical/shared'
import { describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { parseChartSpec } from '@/platform/lib/chart/spec'

import { isEnlargeable, toChartSpec } from './chart'
import { chartFromJsx, chartToJsx } from './chartMarkdown'

/** What Payload hands `jsx.import`: the tag's props, read back from the Markdown by its own reader. */
const propsOf = (tag: string): Record<string, unknown> =>
  extractPropsFromJSXPropsString({
    propsString: tag.replace(/^<Chart\s+/, '').replace(/\s*\/>$/, ''),
  })

const asBlock = (fields: ReturnType<typeof chartFromJsx>) =>
  ({ blockType: 'chart', ...fields }) as Parameters<typeof chartToJsx>[0]

describe('chartToJsx', () => {
  it('writes one self-closing <Chart> tag with the spec as props, the kind first', () => {
    const tag = chartToJsx(asBlock(chartFromJsx(FIXTURES.bars)))
    expect(tag).toMatch(/^<Chart kind="bar" title="/)
    expect(tag).toMatch(/ data=\{\[\{"key":"y2026"/)
    expect(tag).toMatch(/\/>$/)
    expect(tag).not.toContain('\n')
  })

  it('leaves out orientation (always horizontal) and empty fields', () => {
    const tag = chartToJsx(asBlock(chartFromJsx(FIXTURES.bars))) as string
    expect(tag).not.toContain('orientation')
    expect(tag).not.toContain('null')
  })

  it('writes false for a block that is not a valid chart, so it is left out', () => {
    expect(chartToJsx({ blockType: 'chart', kind: 'bar', title: '' } as never)).toBe(false)
  })
})

describe('chartFromJsx', () => {
  it.each(Object.entries(FIXTURES))(
    'round-trips the %s sample: Markdown to block to Markdown',
    (_name, fixture) => {
      const tag = chartToJsx(asBlock(chartFromJsx(fixture))) as string
      const block = chartFromJsx(propsOf(tag))
      expect(chartToJsx(asBlock(block))).toBe(tag)
      expect(toChartSpec(asBlock(block))).toEqual(parseChartSpec(fixture))
    },
  )

  it('accepts horizontal and refuses a vertical chart, which is not drawn yet', () => {
    expect(() => chartFromJsx({ ...FIXTURES.bars, orientation: 'horizontal' })).not.toThrow()
    expect(() => chartFromJsx({ ...FIXTURES.bars, orientation: 'vertical' })).toThrow(/vertical/)
  })

  it('refuses a malformed chart with every reason, naming the property', () => {
    expect(() => chartFromJsx({ kind: 'bar', title: 'T' })).toThrow(/summary/)
    expect(() => chartFromJsx({ ...FIXTURES.bars, unit: 'euros' })).toThrow(/unit/)
    expect(() => chartFromJsx({ ...FIXTURES.bars, scaleMax: '5' })).toThrow(/scaleMax/)
    expect(() =>
      chartFromJsx({ ...FIXTURES.bars, data: [{ key: 'a', label: 'A', value: -1 }] }),
    ).toThrow(/data/)
    expect(() =>
      chartFromJsx({
        ...FIXTURES.paysFor,
        groups: [{ key: 'g', label: 'G', total: 5, data: [{ key: 'a', label: 'A', value: 90 }] }],
      }),
    ).toThrow(/total/)
  })

  it('refuses an unknown kind or property instead of dropping it', () => {
    expect(() => chartFromJsx({ ...FIXTURES.bars, kind: 'pie' })).toThrow(/kind/)
    expect(() => chartFromJsx({ ...FIXTURES.bars, colour: 'red' })).toThrow(/colour/)
    expect(() => chartFromJsx({ ...FIXTURES.bars, groups: [] })).toThrow(/groups/)
  })

  it('refuses a source link that is not a site path or an https address', () => {
    for (const href of [
      'javascript:alert(1)',
      'data:text/html,x',
      '//evil.example',
      'mailto:a@b.c',
    ]) {
      expect(() =>
        chartFromJsx({ ...FIXTURES.bars, sources: [{ label: 'Source', href }] }),
      ).toThrow(/sources\.0\.href/)
    }
    expect(() =>
      chartFromJsx({ ...FIXTURES.bars, sources: [{ label: 'Source', href: '/budget' }] }),
    ).not.toThrow()
  })

  it('refuses a stacked tag whose series have more or fewer values than the rows', () => {
    const series = [{ key: 'a', label: 'A', values: [1, 2, 3] }]
    expect(() => chartFromJsx({ ...FIXTURES.borrowed, series, rowNotes: undefined })).toThrow(
      /one value for each/,
    )
  })

  it('says a name that is not a property means the tag was not readable, not that the name is a property', () => {
    expect(() => chartFromJsx({ ...FIXTURES.bars, '}': '}' })).toThrow(/could not be read.*\\u007d/)
    expect(() => chartFromJsx({ ...FIXTURES.bars, '}': '}' })).not.toThrow(/is not a property/)
  })

  it('starts the message with <Chart> so an agent knows which tag to fix', () => {
    expect(() => chartFromJsx({})).toThrow(/^Invalid <Chart>/)
  })
})

describe('the examples in the draft prompt', () => {
  const prompt = readFileSync(
    path.resolve(__dirname, '../../../../intelligence/prompts/draft.md'),
    'utf8',
  )
  const tags = prompt.match(/<Chart kind=[^`]*\/>/g) ?? []

  it('has one example for each kind', () => {
    expect(tags.map((tag) => propsOf(tag).kind).sort()).toEqual(['bar', 'stacked', 'units'])
  })

  it.each([0, 1, 2])('reads example %i back as a valid chart', (index) => {
    expect(() => chartFromJsx(propsOf(tags[index]))).not.toThrow()
  })
})

describe('enlarge (#686)', () => {
  const off = () => chartFromJsx({ ...FIXTURES.bars, enlarge: 'false' })

  it('is on when the tag leaves it out, and the tag stays as it was', () => {
    const block = chartFromJsx(FIXTURES.bars)
    expect(block.enlarge).toBeUndefined()
    expect(chartToJsx(asBlock(block))).not.toContain('enlarge')
  })

  it('writes enlarge="false" only when it is off, and reads it back', () => {
    const tag = chartToJsx(asBlock(off())) as string
    expect(tag).toMatch(/ enlarge="false" /)
    expect(tag.match(/enlarge/g)).toHaveLength(1)
    const back = chartFromJsx(propsOf(tag))
    expect(back.enlarge).toBe(false)
    expect(chartToJsx(asBlock(back))).toBe(tag)
    expect(toChartSpec(asBlock(back))).toEqual(parseChartSpec(FIXTURES.bars))
  })

  it('accepts enlarge="true" as the default, writing nothing for it', () => {
    const block = chartFromJsx({ ...FIXTURES.bars, enlarge: 'true' })
    expect(isEnlargeable(asBlock(block))).toBe(true)
    expect(chartToJsx(asBlock(block))).not.toContain('enlarge')
  })

  it('takes it on every kind of chart', () => {
    for (const fixture of Object.values(FIXTURES)) {
      const block = chartFromJsx({ ...fixture, enlarge: 'false' })
      expect(chartToJsx(asBlock(block))).toContain('enlarge="false"')
    }
  })

  it('refuses any other value, with the reason', () => {
    expect(() => chartFromJsx({ ...FIXTURES.bars, enlarge: 'maybe' })).toThrow(
      /Invalid <Chart>:.*enlarge.*"true" or "false"/,
    )
    expect(() => chartFromJsx({ ...FIXTURES.bars, enlarge: '' })).toThrow(/enlarge/)
  })
})
