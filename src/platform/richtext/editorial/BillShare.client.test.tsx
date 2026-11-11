// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

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

  it('says which rates are last year’s when a body has not set its own', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    expect(screen.getByText(/not set 2027 rates yet/i).textContent).toMatch(
      /Madison schools, Dane County and Madison College/,
    )
  })

  it('shows the bill for the home value typed, and the City’s part of it', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    fireEvent.click(screen.getByRole('button', { name: /2026 rates/ }))
    expect(box().value).toBe('$481,300')
    const result = screen.getByRole('status')
    expect(result.textContent).toMatch(/\$481,300/)
    expect(result.textContent).toMatch(/about \$8,9\d\d/)
    fireEvent.change(box(), { target: { value: '962600' } })
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
    expect(screen.getByText(/enter your home’s value/i)).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('lists each body with its dollars and its percent, and the source', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    fireEvent.click(screen.getByRole('button', { name: /2026 rates/ }))
    for (const name of ['Madison schools', 'City of Madison', 'Dane County', 'Madison College']) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0)
    }
    expect(screen.getByText(/about 38%/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /City tax detail/ })).toBeTruthy()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<BillShare {...PROPS}>City detail</BillShare>)
    await expectAccessible(container)
  })
})
