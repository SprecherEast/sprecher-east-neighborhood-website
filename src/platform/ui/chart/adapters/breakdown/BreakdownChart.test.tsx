// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { toBreakdown, valuesAt } from '@/platform/lib/chart/breakdown'
import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { parseChartSpec } from '@/platform/lib/chart/spec'

import { BreakdownChart } from './BreakdownChart'

afterEach(cleanup)

const spec = parseChartSpec(Object.values(FIXTURES).find((fixture) => fixture.kind === 'breakdown'))
if (spec.kind !== 'breakdown') throw new Error('the fixtures need a breakdown')
const model = toBreakdown(spec)
const draw = (progress: number) =>
  render(
    <BreakdownChart
      model={valuesAt(model, progress)}
      squareValue={spec.squareValue ?? 0}
      titleId="t"
      descId="d"
    />,
  )

describe('BreakdownChart amounts while counting (#1165)', () => {
  it('shows the counted amount, with the final amount hidden from everyone holding its room', () => {
    const { container } = draw(0)
    const amount = container.querySelector('[data-amount]') as HTMLElement
    const spacer = amount.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(spacer.className).toContain('invisible')
    expect(spacer.textContent).toMatch(/^\$[1-9]/)
    // The visible copy, the one screen readers hear, is counting from nothing
    const shown = Array.from(amount.querySelectorAll('span')).find(
      (span) => !span.hasAttribute('aria-hidden') && span.children.length === 0,
    )
    expect(shown?.textContent).toBe('$0')
    // Both copies share one cell, so the row is as wide as the final amount
    expect(amount.firstElementChild?.className).toContain('inline-grid')
  })

  it('shows the plain amount once the count is done, with no hidden copy', () => {
    const { container } = draw(1)
    const amount = container.querySelector('[data-amount]') as HTMLElement
    expect(amount.querySelector('[aria-hidden="true"]')).toBeNull()
    expect(amount.textContent).toMatch(/^\$[1-9]/)
  })
})

describe('BreakdownChart rows read name, percent, then dollars flush right (#1184)', () => {
  it('puts the percent before the dollars in every row, in the same columns on a phone and wider', () => {
    const { container } = draw(1)
    const rows = Array.from(container.querySelectorAll('[data-breakdown-row]'))
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const amount = row.querySelector('[data-amount]') as HTMLElement
      const percent = amount.parentElement?.previousElementSibling as HTMLElement
      expect(percent.textContent).toMatch(/^(<\s?)?\d+(\.\d+)?%$/)
      // The dollars are the row's last cell, so they end at the row's right edge
      expect(row.lastElementChild).toBe(amount.parentElement)
      // Narrow columns on a phone, so a long one-word name never reaches its percent
      expect(row.className).toContain('grid-cols-[minmax(0,1fr)_2.75rem_4rem]')
      expect(row.className).toContain('sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_3rem_4.5rem]')
      // A long one-word name breaks inside its own column rather than run into the percent
      expect(row.querySelector('[data-label]')?.className).toContain('wrap-break-word')
      // On the narrowest phones the name is a size smaller, so a long one-word name fits whole
      expect(row.querySelector('[data-label] > span')?.className).toContain('max-[24rem]:text-sm')
    }
  })
})
