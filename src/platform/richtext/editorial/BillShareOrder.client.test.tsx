// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { BillShare } from './BillShare.client'
import { city, PROPS } from './billShareFixtures'

afterEach(cleanup)

describe('BillShare, the order of the tab and its three closed rows (#1111)', () => {
  it('shows the estimate’s notes only in the row on how it works, closed until opened (#1111)', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    const row = screen.getByText('How we estimate').closest('details') as HTMLDetailsElement
    expect(row.open).toBe(false)
    expect(row.textContent).toMatch(/a rough estimate/i)
    expect(row.textContent).toContain('Uses 2027 rates.')
    expect(screen.getAllByText(/a rough estimate/i)).toHaveLength(1)
  })

  it('draws the tab in one order: intro, the estimator, the answer, the whole bill, the three rows, the rest (#1111)', () => {
    render(
      <BillShare {...PROPS} {...city} certainty="estimate" source={PROPS.years[0]?.source}>
        <p>The rest</p>
      </BillShare>,
    )
    const order = [
      screen.getByText(PROPS.intro),
      screen.getByRole('region', { name: 'Rough Estimator' }),
      screen.getByRole('region', { name: 'Your City tax' }),
      screen.getByRole('region', { name: 'Your whole property tax bill' }),
      screen.getByText('Where the tax goes'),
      screen.getByText('How we estimate'),
      screen.getByText('Sources'),
      screen.getByText('The rest'),
    ]
    order.slice(1).forEach((node, i) => {
      const before = order[i] as Node
      expect(before.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })

  it('shows the intro once, with the estimator drawing none of its own', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    expect(screen.getAllByText(PROPS.intro)).toHaveLength(1)
  })

  it('closes the three rows by default, and each source appears once (#1111)', () => {
    const { container } = render(
      <BillShare {...PROPS} {...city} source={PROPS.years[0]?.source}>
        x
      </BillShare>,
    )
    const rows = Array.from(container.querySelectorAll('details'))
    expect(rows).toHaveLength(3)
    expect(rows.every((row) => !row.open)).toBe(true)
    // The tab's source and the year's source are the same link: listed once
    fireEvent.click(screen.getByRole('button', { name: /2026 rates/ }))
    expect(screen.getAllByRole('link', { name: /City tax detail/ })).toHaveLength(1)
  })

  it('answers with the City’s tax, its increase and how sure we are, once', () => {
    render(
      <BillShare {...PROPS} {...city} certainty="estimate">
        x
      </BillShare>,
    )
    const answer = screen.getByRole('region', { name: 'Your City tax' })
    expect(answer.textContent).toContain('$3,467')
    expect(answer.textContent).toContain('Up $90 a year, $7.50 a month')
    expect(answer.textContent).toContain('City 37%')
    expect(screen.getAllByText('Estimate')).toHaveLength(1)
  })

  it('has no accessibility violations with every row open', async () => {
    const { container } = render(
      <BillShare {...PROPS} {...city} certainty="estimate" source={PROPS.years[0]?.source}>
        x
      </BillShare>,
    )
    container.querySelectorAll('details').forEach((row) => row.setAttribute('open', ''))
    await expectAccessible(container)
  })
})
