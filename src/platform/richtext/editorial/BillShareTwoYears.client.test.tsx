// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { computeBillShare } from '@/platform/lib/billShare'
import { present } from '@/platform/payload/testing/present'

import { BillShare } from './BillShare.client'
import { BARS, estimate, PROPS, city } from './billShareFixtures'
import { homeInYear, increaseIn, yearRatesOf } from './billFigures'

afterEach(cleanup)

const answer = () => screen.getByRole('region', { name: 'Your City tax' }).textContent ?? ''
const dollars = (text: string) => Number(text.replace(/[^0-9]/g, ''))
/** The City's tax the answer card shows */
const taxShown = () => dollars(/(\$[\d,]+)a year/.exec(answer())?.[1] ?? '')
/** The yearly increase the answer card's line says, or null for "No increase" or no line */
const lineShown = () => {
  const found = /Up (\$[\d,]+) a year/.exec(answer())?.[1]
  return found ? dollars(found) : null
}
const year = (label: string) =>
  act(async () => fireEvent.click(screen.getByRole('button', { name: label })))

// The same home in both years, for homes below, at and above the City's average, one of them a
// round number a neighbor would type
const HOMES = [150000, 330000, 420000, 500300, 912345, 1750000]

describe('the increase and the year switch tell one story (#1121)', () => {
  it.each(HOMES)(
    'for a $%s home: the later year’s City tax less the earlier year’s is the increase shown',
    async (home) => {
      render(
        <BillShare {...PROPS} {...city}>
          x
        </BillShare>,
      )
      await estimate(String(home))
      const later = taxShown()
      const line = lineShown()
      await year('2026')
      const earlier = taxShown()
      expect(line, 'the later year shows an increase').not.toBeNull()
      expect(later - earlier).toBe(line)
      // The bar's hatched part is the same number
      await year('2027')
      expect(screen.getByText(`+$${line?.toLocaleString('en-US')}`)).toBeTruthy()
    },
  )

  it.each(HOMES)(
    'for a $%s home: the same, to the cent before rounding, from the one pricing function',
    (home) => {
      const years = PROPS.years
      const rates = yearRatesOf(years)
      const city = (index: number) =>
        computeBillShare(homeInYear(years, index, home), rates[index] ?? {}).parts.find(
          (p) => p.key === 'city',
        )?.amount ?? NaN
      const exact = city(1) - city(0)
      const shown = increaseIn(BARS, years, 1, home)
      // The line is the difference of the two dollar amounts the cards show, within the rounding of each
      expect(shown).toBe(Math.round(city(1)) - Math.round(city(0)))
      expect(Math.abs((shown ?? NaN) - exact)).toBeLessThan(1)
    },
  )

  it('shows the same increase for the average home as the two years’ cards: $3,467 less $3,376', () => {
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    expect(taxShown()).toBe(3467)
    expect(lineShown()).toBe(91)
  })

  it('prices the earlier year at the home’s earlier value, and says which value it used', async () => {
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    await estimate('420000')
    expect(screen.getByText(/^Your home: \$420,000\./)).toBeTruthy()
    await year('2026')
    // $420,000 × $481,300 / $500,300 = $404,050 (to the dollar)
    expect(screen.getByText(/^Your home’s assumed value in 2026: \$404,050\./)).toBeTruthy()
    const priced = computeBillShare(404049.5702578453, PROPS.years[0]?.rates ?? {})
    expect(screen.getByText('Total property tax').parentElement?.textContent).toContain(
      `$${Math.round(priced.total ?? 0).toLocaleString('en-US')}`,
    )
    expect(taxShown()).toBe(Math.round(priced.parts.find((p) => p.key === 'city')?.amount ?? 0))
    // The box still holds what was typed
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('$420,000')
    // And back: the later year uses the typed value itself
    await year('2027')
    expect(screen.getByText(/^Your home: \$420,000\./)).toBeTruthy()
  })

  it('keeps the average home as it is in each year, and the box on the latest year’s average', async () => {
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    await year('2026')
    expect(screen.getByText(/^Average home: \$481,300\./)).toBeTruthy()
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('$500,300')
  })

  it('says in one plain sentence how last year’s value is assumed, in the row on how it is estimated', () => {
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    const row = screen.getByText('How we estimate this').closest('details') as HTMLElement
    expect(row.textContent).toContain(
      'Your home’s 2026 value is assumed to have changed as the average home’s did.',
    )
  })

  it('has no such sentence for a tab of one year', () => {
    render(
      <BillShare {...PROPS} years={PROPS.years.slice(0, 1)}>
        x
      </BillShare>,
    )
    expect(screen.queryByText(/is assumed to have changed/)).toBeNull()
  })

  it('falls back to the typed value, and shows no increase the data cannot support, for a year with no average home', async () => {
    const [first, second] = PROPS.years
    const years = [{ ...present(first), averageHome: 0 }, present(second)]
    render(
      <BillShare {...PROPS} {...city} years={years}>
        x
      </BillShare>,
    )
    expect(lineShown()).toBeNull()
    expect(answer()).not.toMatch(/Up \$/)
    await estimate('420000')
    await year('2026')
    expect(screen.getByText(/^Your home’s assumed value in 2026: \$420,000\./)).toBeTruthy()
  })
})

describe('the earliest year is the base year (#1135)', () => {
  it('says "Base year" in the primary green in the earliest year and the increase in the accent in the later one', async () => {
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    const line = () => document.querySelector('[data-answer-increase]') as HTMLElement
    expect(line().className).toContain('text-accent-strong')
    expect(line().textContent).toMatch(/^Up \$/)
    await year('2026')
    expect(line().textContent).toBe('Base year')
    expect(line().className).toContain('text-primary-strong')
    expect(line().className).not.toContain('text-accent-strong')
    // The sentence a screen reader hears gives the figures, with no increase
    expect(screen.getByRole('status').textContent).not.toMatch(/increase|Up \$|Base year/i)
    await year('2027')
    expect(line().textContent).toMatch(/^Up \$/)
  })

  it('keeps today’s line with one stored year, where nothing is compared', () => {
    render(
      <BillShare {...PROPS} years={PROPS.years.slice(-1)} {...city}>
        x
      </BillShare>,
    )
    expect(screen.queryByText('Base year')).toBeNull()
  })

  it('shows no base-year line when the later year’s increase cannot be computed, so the line and the card keep today’s room', async () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    await year('2026')
    expect(screen.queryByText('Base year')).toBeNull()
    expect(document.querySelector('[data-answer-increase]')?.textContent).toBe('')
  })
})
