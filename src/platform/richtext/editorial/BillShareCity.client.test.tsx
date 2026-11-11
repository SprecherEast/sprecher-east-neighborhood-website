// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { BillShare } from './BillShare.client'
import { BARS, BREAKDOWN, box, city, PROPS } from './billShareFixtures'

afterEach(cleanup)

describe('BillShare, the City’s panel (#1020)', () => {
  const rows = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('[data-breakdown-row] [data-amount]')).map((n) =>
      Number(n.textContent?.replace(/[^0-9]/g, '')),
    )

  it('starts with the City’s tax as one bar, then the short line, then where it goes, then the rest', () => {
    const { container } = render(
      <BillShare {...PROPS} {...city}>
        <p>The rest</p>
      </BillShare>,
    )
    const order = ['2027 proposed', 'Short line', 'Where that City tax goes', 'The rest'].map(
      (text) => screen.getAllByText(new RegExp(text))[0] as HTMLElement,
    )
    order.slice(1).forEach((node, i) => {
      const before = order[i] as HTMLElement
      expect(before.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
    expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(2)
  })

  it('shows the City’s part of the bill above as the bar’s whole amount, split as the chart splits it', () => {
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    // 6.93 mills on $500,300, in the City's slice above and in the bar
    expect(screen.getAllByText('$3,467').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('+$90')).toBeTruthy()
  })

  it('redraws the bar and every breakdown amount at once for the home typed', () => {
    const { container } = render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    const sum = () => rows(container).reduce((all, n) => all + n, 0)
    expect(sum()).toBe(3467)
    fireEvent.change(box(), { target: { value: '200000' } })
    expect(sum()).toBe(1386)
    expect(screen.getAllByText('$1,386').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('+$36')).toBeTruthy()
  })

  it('switches the bar to the other year’s amount, with no increase for last year', () => {
    const { container } = render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    fireEvent.click(screen.getByRole('button', { name: /2026 rates/ }))
    expect(screen.getByText('2026 adopted')).toBeTruthy()
    expect(screen.queryByText(/Proposed increase/)).toBeNull()
    expect(container.querySelector('rect[data-amount-hatch]')).toBeNull()
    // 7.0139 mills on $481,300
    expect(screen.getAllByText('$3,376').length).toBeGreaterThanOrEqual(2)
  })

  it('keeps the panel on the average home while the box holds no number', () => {
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    fireEvent.change(box(), { target: { value: 'abc' } })
    expect(screen.getByText('2027 proposed')).toBeTruthy()
    expect(screen.getAllByText('$3,467').length).toBeGreaterThan(0)
  })

  it('adds the breakdown up to the City’s slice exactly, for any home typed', () => {
    const uneven: typeof BREAKDOWN = {
      ...BREAKDOWN,
      areas: [1, 1, 1, 1, 1, 1, 1].map((value, i) => ({
        key: `a${i}`,
        label: `Area ${i}`,
        value,
      })),
    }
    const { container } = render(
      <BillShare {...PROPS} {...city} cityBreakdown={uneven}>
        x
      </BillShare>,
    )
    for (const value of ['123457', '287311', '419999', '641234', '777777']) {
      fireEvent.change(box(), { target: { value } })
      const total = rows(container).reduce((all, n) => all + n, 0)
      expect(
        screen.getAllByText(`$${total.toLocaleString('en-US')}`).length,
      ).toBeGreaterThanOrEqual(2)
    }
  })

  it('draws no bar when the chart’s columns are not these years, rather than a wrong year', () => {
    render(
      <BillShare {...PROPS} {...city} cityBars={{ ...BARS, x: ['2027 proposed'] }}>
        x
      </BillShare>,
    )
    expect(screen.queryByText('2027 proposed')).toBeNull()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    await expectAccessible(container)
  })
})
