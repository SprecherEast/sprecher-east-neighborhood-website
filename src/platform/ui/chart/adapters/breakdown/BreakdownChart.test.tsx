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
