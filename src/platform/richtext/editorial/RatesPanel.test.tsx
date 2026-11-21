// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { BillShareYear } from './billShare'
import { rateLinesFor } from './billRates'
import { PROPS } from './billShareFixtures'
import { RatesPanel } from './RatesPanel'

afterEach(cleanup)

describe('RatesPanel', () => {
  it('draws a line per body with its percent, its dollars per $1,000, its name and its year', () => {
    render(<RatesPanel title="Rates used" lines={rateLinesFor(PROPS.years, 1)} />)
    const lines = screen.getAllByRole('listitem')
    expect(lines).toHaveLength(4)
    const county = within(lines[2] as HTMLElement)
    expect(county.getByText('Dane County')).toBeTruthy()
    expect(county.getByText('0.236%')).toBeTruthy()
    expect(county.getByText('$2.36 per $1,000')).toBeTruthy()
    expect(county.getByText('2026 rate')).toBeTruthy()
  })

  it('labels the City’s own 2027 rate 2027 and the others’ carried rates 2026', () => {
    render(<RatesPanel title="Rates used" lines={rateLinesFor(PROPS.years, 1)} />)
    const city = within(screen.getByText('City of Madison').closest('li') as HTMLElement)
    expect(city.getByText('2027 rate')).toBeTruthy()
    expect(screen.getAllByText('2026 rate')).toHaveLength(3)
  })

  it('highlights the City’s line and no other', () => {
    render(<RatesPanel title="Rates used" lines={rateLinesFor(PROPS.years, 0)} />)
    const marked = screen.getAllByRole('listitem').filter((item) => item.hasAttribute('data-city'))
    expect(marked).toHaveLength(1)
    expect(marked[0]?.textContent).toContain('City of Madison')
  })

  it('draws the toast it is given inside the card, and keeps every line whether or not there is one', () => {
    const lines = rateLinesFor(PROPS.years, 1)
    const { rerender } = render(
      <RatesPanel title="Rates used" lines={lines} toast={<p>Rates from 2026 are in use.</p>} />,
    )
    const card = screen.getByRole('region', { name: 'Rates used' })
    expect(within(card).getByText('Rates from 2026 are in use.')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    rerender(<RatesPanel title="Rates used" lines={lines} />)
    expect(screen.queryByText('Rates from 2026 are in use.')).toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })

  it('writes a body with no rate as a dash, so every year’s panel has the same lines', () => {
    const lines = rateLinesFor([{ ...(PROPS.years[1] as BillShareYear), rates: { city: 6.93 } }], 0)
    render(<RatesPanel title="Rates used" lines={lines} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getAllByText('No rate yet').length).toBe(3)
  })

  it('shortens a long name on the narrowest phones as the whole bill does, the rest kept for screen readers', () => {
    render(<RatesPanel title="Rates used" lines={rateLinesFor(PROPS.years, 1)} />)
    const name = screen.getByText('Madison College')
    expect(name.textContent).toBe('Madison College, MATC')
    expect(within(name).getByText(', MATC').className).toContain('max-[24rem]:sr-only')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <RatesPanel title="Rates used" lines={rateLinesFor(PROPS.years, 1)} />,
    )
    await expectAccessible(container)
  })
})
