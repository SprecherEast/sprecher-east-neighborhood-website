// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { BillShare } from './BillShare.client'
import { BARS, BREAKDOWN, box, city, estimate, PROPS } from './billShareFixtures'

afterEach(cleanup)

describe('BillShare, the City’s panel (#1020)', () => {
  const rows = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('[data-breakdown-row] [data-amount]')).map((n) =>
      Number(n.textContent?.replace(/[^0-9]/g, '')),
    )

  it('opens the first row on the takeaway and the split, then the short line, then the rest (#1068, #1111, #1144)', () => {
    const { container } = render(
      <BillShare {...PROPS} {...city}>
        <p>The rest</p>
      </BillShare>,
    )
    const order = ['Our estimate\\.', 'Public safety', 'Short line', 'The rest'].map(
      (text) => screen.getAllByText(new RegExp(text))[0] as HTMLElement,
    )
    order.slice(1).forEach((node, i) => {
      const before = order[i] as HTMLElement
      expect(before.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
    // Only the whole bill's bar: the City's tax is not drawn again as a bar
    expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(1)
    const first = container.querySelector('details') as HTMLDetailsElement
    expect(first.textContent).toContain('Our estimate.')
    // The first row is open when the tab loads (#1121)
    expect(first.open).toBe(true)
  })

  it('does not repeat the answer card in the first row: no year amount, no bar, no second visible heading (#1144)', () => {
    const { container } = render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    const first = container.querySelector('details') as HTMLDetailsElement
    for (const year of ['2026', '2027']) {
      fireEvent.click(screen.getByRole('button', { name: year }))
      expect(first.textContent).not.toMatch(/2027 proposed|2026 adopted|Same as 2026/)
      expect(screen.queryByText(/Proposed increase/)).toBeNull()
      expect(container.querySelector('[data-amount-part]')).toBeNull()
    }
    // The breakdown's title still names the drawing, for screen readers only
    expect(screen.getByText('Where that City tax goes, estimated').className).toContain('sr-only')
    expect(screen.getByText('Our estimate.').closest('.sr-only')).toBeNull()
  })

  it('keeps the “See the smaller pieces” list in the City’s panel (#1068)', () => {
    const withSmall = {
      ...BREAKDOWN,
      areas: [
        {
          key: 'safety',
          label: 'Public safety',
          value: 1500,
          pieces: [
            { key: 'police', label: 'Police', value: 1000, shown: true as const },
            { key: 'health', label: 'Public Health', value: 500 },
          ],
        },
        { key: 'other', label: 'Everything else', value: 1500 },
      ],
    }
    render(
      <BillShare {...PROPS} {...city} cityBreakdown={withSmall}>
        x
      </BillShare>,
    )
    expect(screen.getByText('See the smaller pieces')).toBeTruthy()
    expect(screen.getByText('Public Health')).toBeTruthy()
  })

  it('shows the City’s part of the bill in the answer card and the receipt, with its increase', () => {
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    // 6.93 mills on $500,300, in the answer card and the receipt
    expect(screen.getAllByText('$3,467')).toHaveLength(2)
    // The increase is the City's tax priced for both years: $3,467 less $3,376 (#1121)
    expect(screen.getByText(/Up \$91 a year/)).toBeTruthy()
  })

  it('redraws the answer and every breakdown amount at once for the home estimated', async () => {
    const { container } = render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    const sum = () => rows(container).reduce((all, n) => all + n, 0)
    expect(sum()).toBe(3467)
    await estimate('200000')
    expect(sum()).toBe(1386)
    expect(screen.getAllByText('$1,386').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/Up \$36 a year/)).toBeTruthy()
  })

  it('switches the answer to the other year’s amount, the base year (#1135)', () => {
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    fireEvent.click(screen.getByRole('button', { name: '2026' }))
    expect(screen.getByText('Base year')).toBeTruthy()
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
    expect(screen.getAllByText('$3,467').length).toBeGreaterThan(0)
  })

  it('adds the breakdown up to the City’s slice exactly, for any home estimated', async () => {
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
      await estimate(value)
      const total = rows(container).reduce((all, n) => all + n, 0)
      expect(
        screen.getAllByText(`$${total.toLocaleString('en-US')}`).length,
      ).toBeGreaterThanOrEqual(2)
    }
  })

  it('has no first row when the tab has no breakdown chart, even with the City’s chart by year (#1144)', () => {
    render(
      <BillShare {...PROPS} cityBars={BARS}>
        x
      </BillShare>,
    )
    expect(screen.queryByText('Your City tax share, estimated')).toBeNull()
    // The answer card still takes its increase from that chart
    expect(screen.getByText(/Up \$91 a year/)).toBeTruthy()
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
