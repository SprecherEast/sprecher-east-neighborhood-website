// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { BillAnswer } from './BillAnswer'
import { figuresFor } from './billFigures'

afterEach(cleanup)

const base = {
  tax: '$3,467',
  increase: 90,
  certainty: 'confirmed' as const,
  note: '',
  yours: false,
  home: '$500,300',
  cityPercent: 37,
}

describe('BillAnswer', () => {
  it('labels the top row for the average home, and for the reader’s own home after an estimate', () => {
    render(<BillAnswer {...base} />)
    expect(screen.getByText('City tax on an average home')).toBeTruthy()
    cleanup()
    render(<BillAnswer {...base} yours />)
    expect(screen.getByText('City tax on your home')).toBeTruthy()
    expect(screen.queryByText('City tax on an average home')).toBeNull()
  })

  it('puts the badge on the right of the same row as the label', () => {
    render(<BillAnswer {...base} />)
    const row = screen.getByText('City tax on an average home').parentElement as HTMLElement
    expect(row.className).toContain('justify-between')
    expect(row.textContent).toContain('Confirmed')
    const label = screen.getByText('City tax on an average home')
    const badge = screen.getByText('Confirmed')
    expect(label.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows the City’s tax as the biggest text, followed by a small "a year"', () => {
    render(<BillAnswer {...base} />)
    const tax = screen.getByText('$3,467')
    expect(tax.className).toContain('text-4xl')
    const small = screen.getByText('a year', { selector: 'span' })
    expect(small.className).toContain('text-sm')
    expect(tax.compareDocumentPosition(small) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('writes the increase in the estimator’s accent, orange, from the same figures as {yearly} and {monthly}', () => {
    render(<BillAnswer {...base} />)
    const figures = figuresFor(90)
    const line = screen.getByText(`Up ${figures.yearly} a year, about ${figures.monthly} a month`)
    expect(line.textContent).toBe('Up $90 a year, about $7.50 a month')
    expect(line.className).toContain('text-accent-strong')
  })

  it('says there is no increase when there is none, on a line of the same kind', () => {
    render(<BillAnswer {...base} increase={0} />)
    expect(screen.getByText('No increase').className).toContain('text-accent-strong')
    expect(screen.queryByText(/Up \$/)).toBeNull()
  })

  it('keeps the room of the increase line when the chart gives no increase', () => {
    const { container } = render(<BillAnswer {...base} increase={null} />)
    expect(container.querySelector('[data-answer-increase]')?.textContent).toBe('')
  })

  it('shows the stored certainty as the one badge when the year has no note', () => {
    render(<BillAnswer {...base} certainty="estimate" />)
    expect(screen.getAllByText('Estimate')).toHaveLength(1)
    cleanup()
    render(<BillAnswer {...base} />)
    expect(screen.getAllByText('Confirmed')).toHaveLength(1)
  })

  it('shows the year’s stored note as the badge, capitalized, with the "not final" look', () => {
    const { container } = render(<BillAnswer {...base} note="proposed" />)
    const badge = screen.getByText('Proposed')
    expect(badge.className).toContain('text-warning-strong')
    expect(screen.queryByText('Confirmed')).toBeNull()
    expect(container.textContent).not.toContain('(')
  })

  it('writes one small sentence with the home value and the City’s share, in both forms', () => {
    render(<BillAnswer {...base} />)
    expect(
      screen.getByText('Average home: $500,300. The City is 37% of the whole bill.'),
    ).toBeTruthy()
    cleanup()
    render(<BillAnswer {...base} yours home="$1,000,600" cityPercent={38} />)
    expect(
      screen.getByText('Your home: $1,000,600. The City is 38% of the whole bill.'),
    ).toBeTruthy()
    cleanup()
    render(<BillAnswer {...base} cityPercent={null} />)
    expect(screen.getByText('Average home: $500,300.')).toBeTruthy()
  })

  it('says the value is the one assumed for an earlier year, only after an estimate (#1121)', () => {
    render(<BillAnswer {...base} yours home="$404,050" assumedYear={2026} />)
    expect(
      screen.getByText(
        'Your home’s assumed value in 2026: $404,050. The City is 37% of the whole bill.',
      ),
    ).toBeTruthy()
    cleanup()
    // The City's average home in that year is its own figure, not an assumption
    render(<BillAnswer {...base} home="$481,300" assumedYear={2026} />)
    expect(
      screen.getByText('Average home: $481,300. The City is 37% of the whole bill.'),
    ).toBeTruthy()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<BillAnswer {...base} note="proposed" />)
    await expectAccessible(container)
  })
})
