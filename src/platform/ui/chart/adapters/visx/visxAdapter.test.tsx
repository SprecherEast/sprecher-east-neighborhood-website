// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { parseChartSpec, type ChartSpec } from '@/platform/lib/chart/spec'
import { CHART_PALETTE } from '@/platform/ui/chart/chartPalette'

import { describeChartAdapter } from '../../chartAdapter.contract'

import { visxAdapter } from './visxAdapter'

afterEach(cleanup)

const IDS = { titleId: 'title', descId: 'desc', palette: CHART_PALETTE }
const draw = (spec: unknown) =>
  render(<>{visxAdapter.render(parseChartSpec(spec) as ChartSpec, IDS)}</>)

describeChartAdapter(visxAdapter, {
  markCount: (spec) =>
    spec.kind === 'bar'
      ? spec.data.length
      : spec.kind === 'stacked'
        ? spec.x.length * spec.series.length
        : 0,
})

describe('visxAdapter', () => {
  it('draws bar and stacked charts as svg, and nothing else', () => {
    expect(visxAdapter.output).toBe('svg')
    expect([...visxAdapter.kinds].sort()).toEqual(['bar', 'stacked'])
    expect(visxAdapter.usesColour).toBe(true)
  })

  it('is one svg img named by the title and description, scaling with its container', () => {
    const { container } = draw(FIXTURES.bars)
    const svg = container.querySelector('svg[role="img"]')
    expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(1)
    expect(svg?.getAttribute('aria-labelledby')).toBe('title desc')
    expect(svg?.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/)
    expect(svg?.hasAttribute('width')).toBe(false)
    expect(svg?.hasAttribute('height')).toBe(false)
    expect(svg?.getAttribute('class')).toContain('w-full')
    expect(svg?.getAttribute('class')).toContain('print-exact')
  })

  it('colours bars with fill-chart classes, one colour per series in order', () => {
    const { container } = draw(FIXTURES.borrowed)
    const marks = [...container.querySelectorAll('[data-chart-mark]')]
    expect(marks.map((m) => m.getAttribute('class')?.match(/fill-chart-\d/)?.[0])).toEqual([
      'fill-chart-1',
      'fill-chart-2',
      'fill-chart-1',
      'fill-chart-2',
    ])
  })

  it('hatches a patterned segment with a pattern from the theme’s background colour', () => {
    const { container } = draw(FIXTURES.borrowed)
    const pattern = container.querySelector('pattern')
    expect(pattern?.id).toBeTruthy()
    expect(pattern?.querySelector('path')?.getAttribute('class')).toContain('stroke-background')
    const overlays = [...container.querySelectorAll(`[fill="url(#${pattern?.id})"]`)]
    expect(overlays).toHaveLength(2)
    // the hatch lies on the second series only, on top of its own colour
    expect(container.querySelectorAll('[data-chart-mark].fill-chart-1')).toHaveLength(2)
  })

  it('draws no pattern when nothing is hatched', () => {
    const plain = {
      ...FIXTURES.borrowed,
      series: FIXTURES.borrowed.series.map(({ pattern: _unused, ...s }) => s),
    }
    expect(draw(plain).container.querySelector('pattern')).toBeNull()
  })

  it('prints values dollars-first as real text outside the marks: $452.7M, +$24.8M', () => {
    const { container } = draw(FIXTURES.operating)
    const texts = [...container.querySelectorAll('text')].map((t) => t.textContent)
    expect(texts.some((t) => t?.includes('2027 proposed') && t.includes('$477.5M'))).toBe(true)
    expect(texts).toContain('+$24.8M')
    expect(texts).toContain('$452.7M')
    expect(
      container.querySelectorAll('[data-chart-mark] text, text [data-chart-mark]'),
    ).toHaveLength(0)
  })

  it('prints a note under each row', () => {
    const { container } = draw(FIXTURES.borrowed)
    const texts = [...container.querySelectorAll('text')].map((t) => t.textContent)
    expect(texts).toContain('$60 of every $100 is borrowed')
    expect(texts).toContain('$66 of every $100 is borrowed')
  })

  it('labels a few ticks on the shared scale: $0, $250M, $500M', () => {
    const { container } = draw(FIXTURES.bars)
    const texts = [...container.querySelectorAll('text')].map((t) => t.textContent)
    expect(texts).toEqual(expect.arrayContaining(['$0', '$250M', '$500M']))
  })

  it('draws bars to the same scale when two charts share a scaleMax', () => {
    const capital = draw({ ...FIXTURES.borrowed, scaleMax: 500_000_000 }).container
    const operating = draw(FIXTURES.operating).container
    // each chart's first segment starts at the baseline, so its width is its value on the scale
    const borrowed = capital.querySelector('rect[data-chart-mark="borrowed"]')
    const same = operating.querySelector('rect[data-chart-mark="same"]')
    const width = (el: Element | null) => Number(el?.getAttribute('width'))
    expect(width(borrowed) / width(same)).toBeCloseTo(171_688_393 / 452_723_152, 5)
  })

  it('keeps a mark per datum even when a value is zero', () => {
    const { container } = draw(FIXTURES.operating)
    expect(container.querySelectorAll('[data-chart-mark]')).toHaveLength(4)
  })

  it('refuses a vertical chart instead of drawing it wrongly', () => {
    expect(() => draw({ ...FIXTURES.bars, orientation: 'vertical' })).toThrow(/horizontal/)
  })

  it('is a server component: no client directive and no hooks of its own', () => {
    const dir = join(process.cwd(), 'src/platform/ui/chart/adapters/visx')
    for (const file of ['visxAdapter.tsx', 'BarChartSvg.tsx', 'barModel.ts', 'barLayout.ts']) {
      const source = readFileSync(join(dir, file), 'utf8')
      expect(source, file).not.toMatch(/['"]use client['"]/)
      expect(source, file).not.toMatch(/\buse(State|Effect|Layout|Ref|Memo|Callback)\b/)
    }
  })
})
