// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { parseChartSpec, type ChartSpec } from '@/platform/lib/chart/spec'
import { CHART_PALETTE } from '@/platform/ui/chart/chartPalette'

import { describeChartAdapter } from '../../chartAdapter.contract'

import { changeAdapter } from './changeAdapter'

afterEach(cleanup)

const draw = (input: ChartSpec) =>
  render(
    <>
      {changeAdapter.render(parseChartSpec(input), {
        titleId: 't',
        descId: 'd',
        palette: CHART_PALETTE,
      })}
    </>,
  )

describeChartAdapter(changeAdapter, {
  // One swatch in the key for each part with something in the later row
  markCount: (spec) =>
    spec.kind === 'stacked' ? spec.series.filter((s) => s.values[spec.x.length - 1] > 0).length : 0,
})

describe('changeAdapter', () => {
  it('draws the change look of stacked charts only, as html at full width with its own key', () => {
    expect(changeAdapter.output).toBe('html')
    expect([...changeAdapter.kinds]).toEqual(['stacked'])
    expect(changeAdapter.accepts?.(parseChartSpec(FIXTURES.operatingChange))).toBe(true)
    expect(changeAdapter.accepts?.(parseChartSpec(FIXTURES.borrowed))).toBe(false)
    expect(changeAdapter.enlargeable).toBe(false)
    expect(changeAdapter.usesColour).toBe(false)
  })

  it('leads with the later figure and its signed change from the earlier row', () => {
    const { container } = draw(FIXTURES.operatingChange)
    const figure = container.querySelector('[data-change-figure]')
    expect(figure?.textContent).toContain('2027 adopted')
    expect(figure?.textContent).toContain('$477.7M')
    expect(figure?.textContent).toContain('+$25M (+5.5%)')
    expect(figure?.textContent).toContain('from 2026 adopted')
  })

  it('writes a fall with its minus sign', () => {
    const { container } = draw({
      ...FIXTURES.capitalChange,
      x: ['2026 adopted', '2027 adopted'],
      series: [{ key: 'a', label: 'A', values: [200_000_000, 150_000_000] }],
    })
    expect(container.querySelector('[data-signed-change="down"]')?.textContent).toContain(
      '−$50M (−25.0%)',
    )
  })

  it('splits the later row in one slim strip and a key with each share and amount', () => {
    const { container } = draw(FIXTURES.capitalChange)
    const strip = container.querySelector('svg[role="img"]')
    expect(strip?.getAttribute('aria-label')).toContain('Borrowed 62.4')
    const items = [...container.querySelectorAll('ul[aria-label="Chart key"] li')].map(
      (li) => li.textContent,
    )
    expect(items).toEqual(['Borrowed62.4%$184.8M', 'Other sources37.6%$111.2M'])
  })

  it('draws no big bars: no chart svg beyond the slim strip', () => {
    const { container } = draw(FIXTURES.operatingChange)
    expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(1)
    expect(container.querySelector('svg[role="img"]')?.getAttribute('class')).toContain('h-[7px]')
  })

  it('refuses another kind', () => {
    expect(() =>
      changeAdapter.render(parseChartSpec(FIXTURES.bars), {
        titleId: 't',
        descId: 'd',
        palette: CHART_PALETTE,
      }),
    ).toThrow(/does not draw bar/)
  })
})
