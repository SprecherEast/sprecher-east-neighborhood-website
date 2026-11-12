// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { BillAnswer } from './BillAnswer'
import { figuresFor } from './billFigures'

afterEach(cleanup)

const base = {
  year: 2027,
  tax: '$3,467',
  increase: 90,
  certainty: 'estimate' as const,
  home: '$500,300',
  cityPercent: 38,
}

describe('BillAnswer', () => {
  it('shows the City’s tax as the biggest text, with the increase for a year and a month', () => {
    render(<BillAnswer {...base} />)
    const tax = screen.getByText('$3,467')
    expect(tax.className).toContain('text-4xl')
    const figures = figuresFor(90)
    expect(screen.getByText(`Up ${figures.yearly} a year, ${figures.monthly} a month`)).toBeTruthy()
    expect(screen.getByText(/City tax in 2027/)).toBeTruthy()
  })

  it('says there is no increase when there is none, on a line of the same kind', () => {
    render(<BillAnswer {...base} increase={0} />)
    expect(screen.getByText('No increase')).toBeTruthy()
    expect(screen.queryByText(/a year/)).toBeNull()
  })

  it('keeps the room of the increase line when the chart gives no increase', () => {
    const { container } = render(<BillAnswer {...base} increase={null} />)
    expect(container.querySelector('[data-answer-increase]')?.textContent).toBe('')
  })

  it('shows how sure we are once, as a badge from the stored certainty', () => {
    render(<BillAnswer {...base} />)
    expect(screen.getAllByText('Estimate')).toHaveLength(1)
    cleanup()
    render(<BillAnswer {...base} certainty="confirmed" />)
    expect(screen.getAllByText('Confirmed')).toHaveLength(1)
  })

  it('writes one small line with the home value and the City’s share of the whole bill', () => {
    render(<BillAnswer {...base} />)
    expect(screen.getByText('$500,300 home · City is 38% of the bill')).toBeTruthy()
    cleanup()
    render(<BillAnswer {...base} cityPercent={null} />)
    expect(screen.getByText('$500,300 home')).toBeTruthy()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<BillAnswer {...base} />)
    await expectAccessible(container)
  })
})
