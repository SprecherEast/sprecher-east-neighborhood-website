// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { BillShare } from './BillShare.client'
import { city, PROPS } from './billShareFixtures'

afterEach(cleanup)

const panel = () => screen.getByRole('region', { name: PROPS.rates.title })
const lineOf = (name: string) => within(panel()).getByText(name).closest('li') as HTMLElement
const choose = (label: string) =>
  act(async () => fireEvent.click(screen.getByRole('button', { name: label })))

describe('BillShare, the rates panel (#1351)', () => {
  it('opens on the latest year: the City’s 2027 rate and the others’ 2026 rates, each labeled', () => {
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    expect(within(lineOf('City of Madison')).getByText('2027 rate')).toBeTruthy()
    expect(within(lineOf('City of Madison')).getByText('$6.93 per $1,000')).toBeTruthy()
    expect(within(lineOf('Dane County')).getByText('2026 rate')).toBeTruthy()
    expect(within(lineOf('Metropolitan Schools')).getByText('2026 rate')).toBeTruthy()
  })

  it('follows the year chosen, and says in 2027 that the other rates come in January', async () => {
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    const note = () => within(panel()).getByText(/come out in January/)
    expect(note().className).not.toContain('invisible')
    await choose('2026')
    expect(within(lineOf('City of Madison')).getByText('2026 rate')).toBeTruthy()
    expect(within(lineOf('City of Madison')).getByText('$7.01 per $1,000')).toBeTruthy()
    // Not shown in 2026, but its room is kept so the panel keeps its height
    expect(note().className).toContain('invisible')
  })

  it('sits beside the answer card in the tab’s order: after the answer, before the whole bill', () => {
    const { container } = render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    const answer = screen.getByRole('region', { name: 'Your City tax' })
    const bill = screen.getByRole('region', { name: 'Your whole property tax bill' })
    expect(answer.compareDocumentPosition(panel()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(panel().compareDocumentPosition(bill) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelectorAll('[data-city]')).toHaveLength(1)
  })

  it('does not change when a home value is estimated: the rates are the year’s, not the home’s', async () => {
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    const before = panel().textContent
    fireEvent.change(screen.getByRole('textbox', { name: 'Enter your assessed value' }), {
      target: { value: '750000' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Estimate' }))
    })
    expect(panel().textContent).toBe(before)
  })
})
