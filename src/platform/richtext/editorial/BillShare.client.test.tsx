// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { ChartSpec } from '@/platform/lib/chart/spec'

import { BillShare } from './BillShare.client'
import type { BillShareProps } from './billShare'

afterEach(cleanup)

const PROPS: BillShareProps = {
  intro: 'Based on the City’s average home. Change the value to see yours.',
  years: [
    {
      year: 2026,
      label: '2026 rates (last year)',
      averageHome: 481300,
      rates: { schools: 8.6814, county: 2.3564, matc: 0.6153, city: 7.0139 },
      source: {
        label: 'City tax detail',
        href: 'https://example.org/tax',
        external: true,
        appearance: 'default',
      },
    },
    {
      year: 2027,
      label: '2027 rates (proposed)',
      averageHome: 500300,
      rates: { city: 6.93 },
      source: null,
    },
  ],
}

const BARS: Extract<ChartSpec, { kind: 'stacked' }> = {
  kind: 'stacked',
  title: 'City tax on an average home',
  summary: 'Up $90.',
  unit: 'usd',
  orientation: 'horizontal',
  x: ['2026 adopted', '2027 proposed'],
  series: [
    { key: 'same', label: 'Same as 2026', values: [3375.89, 3375.89] },
    {
      key: 'more',
      label: 'Proposed increase',
      pattern: 'hatch',
      increase: true,
      values: [0, 90.04],
    },
  ],
}

const BREAKDOWN: Extract<ChartSpec, { kind: 'breakdown' }> = {
  kind: 'breakdown',
  title: 'Where that City tax goes, estimated',
  summary: 'Our estimate.',
  unit: 'usd',
  hideSquares: true,
  areas: [
    { key: 'safety', label: 'Public safety', value: 1500 },
    { key: 'other', label: 'Everything else', value: 1500 },
  ],
}

const city = { cityBars: BARS, cityBreakdown: BREAKDOWN, definition: <p>Short line</p> }

const box = () => screen.getByRole('textbox', { name: /home’s value/i }) as HTMLInputElement

describe('BillShare', () => {
  it('starts on the latest year with the City’s average home for it', () => {
    render(<BillShare {...PROPS}>City detail</BillShare>)
    expect(box().value).toBe('$500,300')
    expect(screen.getByRole('button', { name: /2027 rates/ }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByText('City detail')).toBeTruthy()
  })

  it('says which rates are last year’s when a body has not set its own, in a note that is always there', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    const note = screen.getByText(/2027 rates are not confirmed/i)
    expect(note.textContent).toMatch(/Madison schools, Dane County and Madison College \(MATC\)/)
    expect(note.closest('li')?.getAttribute('aria-hidden')).toBeNull()
    // Last year's rates have nothing to confirm: the note keeps its room and is hidden from everyone
    fireEvent.click(screen.getByRole('button', { name: /2026 rates/ }))
    const kept = screen.getByText(/2027 rates are not confirmed/i).closest('li')
    expect(kept?.getAttribute('aria-hidden')).toBe('true')
    expect(kept?.className).toContain('invisible')
    expect(screen.getByText(/this is a rough estimate/i)).toBeTruthy()
  })

  it('shows the bill for the home value typed, and the City’s part of it', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    fireEvent.click(screen.getByRole('button', { name: /2026 rates/ }))
    expect(box().value).toBe('$481,300')
    const result = screen.getByRole('status')
    expect(result.textContent).toMatch(/\$481,300/)
    expect(result.textContent).toMatch(/about \$8,9\d\d/)
    fireEvent.change(box(), { target: { value: '962600' } })
    // A screen reader is told when the reader leaves the box, not on every key
    expect(screen.getByRole('status').textContent).toBe('')
    expect(screen.getByText(/about \$17,9\d\d/)).toBeTruthy()
    fireEvent.blur(box())
    expect(screen.getByRole('status').textContent).toMatch(/about \$17,9\d\d/)
  })

  it('keeps what the reader typed when the year changes', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    fireEvent.change(box(), { target: { value: '300000' } })
    fireEvent.click(screen.getByRole('button', { name: /2026 rates/ }))
    expect(box().value).toBe('300000')
  })

  it('asks for a number instead of showing a wrong bill', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    fireEvent.change(box(), { target: { value: 'abc' } })
    expect(screen.getByRole('alert').textContent).toMatch(/enter your home’s value/i)
    expect(screen.getByRole('status').textContent).toBe('')
    expect(screen.queryByRole('img', { name: /your rough property tax/i })).toBeNull()
  })

  it('draws the whole bill as one pie of the four bodies, with the source', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    fireEvent.click(screen.getByRole('button', { name: /2026 rates/ }))
    const pie = screen.getByRole('img', { name: /^Your rough property tax:/ })
    const label = pie.getAttribute('aria-label') ?? ''
    for (const name of [
      'Madison schools',
      'City of Madison',
      'Dane County',
      'Madison College (MATC)',
    ]) {
      expect(label).toContain(name)
    }
    expect(label).toMatch(/City of Madison \$[\d,]+, 38%/)
    expect(screen.getByRole('link', { name: /City tax detail/ })).toBeTruthy()
  })

  it('puts the Rough Estimator and the pie in two cards, and the City’s panel under both', () => {
    render(
      <BillShare {...PROPS} {...city}>
        <p>The rest</p>
      </BillShare>,
    )
    const estimator = screen.getByRole('heading', { name: 'Rough Estimator' })
    const pie = screen.getByRole('heading', { name: 'Your rough property tax' })
    const panel = screen.getByText('Short line')
    const follows = (a: Node, b: Node) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
    expect(follows(estimator, pie)).toBeTruthy()
    expect(follows(pie, panel)).toBeTruthy()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<BillShare {...PROPS}>City detail</BillShare>)
    await expectAccessible(container)
  })

  describe('the City’s panel (#1020)', () => {
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
})
