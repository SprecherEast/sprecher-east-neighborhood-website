// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BillShare } from './BillShare.client'
import { city, PROPS, stubView, RATES_PANEL } from './billShareFixtures'
import { toastsOf } from './billToasts'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const panel = () => screen.getByRole('region', { name: RATES_PANEL })
const choose = (label: string) =>
  act(async () => fireEvent.click(screen.getByRole('button', { name: label })))
const accept = () =>
  act(async () => fireEvent.click(within(panel()).getByRole('button', { name: 'Got it' })))
const calculate = async (value: string) => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Enter your assessed value' }), {
    target: { value },
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Estimate' }))
  })
}

describe('BillShare, the rates panel toast (#1380, #1392, #1413)', () => {
  it('shows no toast and no hidden note taking room until the panel is in view (#1413)', () => {
    const view = stubView()
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    expect(within(panel()).queryByText(/The others aren’t out yet/)).toBeNull()
    expect(within(panel()).queryByRole('button', { name: 'Got it' })).toBeNull()
    expect(view.watching()).toBe(1)
  })

  it('warns when the panel first comes into view, and not again for the same view', async () => {
    const view = stubView()
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    await view.enter()
    expect(within(panel()).getByText(/These are the City’s 2027 rates/)).toBeTruthy()
    // The reader accepts it; it was one showing of the two
    await act(async () => fireEvent.click(within(panel()).getByRole('button', { name: 'Got it' })))
    expect(within(panel()).queryByRole('button', { name: 'Got it' })).toBeNull()
  })

  it('warns again on a calculation in the later year, then never more than twice in a visit', async () => {
    const view = stubView()
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    await view.enter()
    await accept()
    await calculate('750000')
    expect(within(panel()).getByText(/These are the City’s 2027 rates/)).toBeTruthy()
    await accept()
    // Two showings are spent: a further calculation or a switch back and forth stays quiet
    await calculate('800000')
    expect(within(panel()).queryByRole('button', { name: 'Got it' })).toBeNull()
    await choose('2026')
    await choose('2027')
    expect(within(panel()).queryByRole('button', { name: 'Got it' })).toBeNull()
  })

  it('says nothing for a calculation in the earlier year', async () => {
    const view = stubView()
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    await choose('2026')
    await calculate('750000')
    expect(within(panel()).queryByRole('button', { name: 'Got it' })).toBeNull()
    await view.enter()
    expect(within(panel()).queryByRole('button', { name: 'Got it' })).toBeNull()
  })

  it('switching to the later year warns only if nothing has warned yet this visit', async () => {
    const view = stubView()
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    await choose('2026')
    await choose('2027')
    expect(within(panel()).getByText(/These are the City’s 2027 rates/)).toBeTruthy()
    await accept()
    await choose('2026')
    await choose('2027')
    expect(within(panel()).queryByRole('button', { name: 'Got it' })).toBeNull()
    // The panel coming into view later is the second and last showing
    await view.enter()
    expect(within(panel()).getByText(/These are the City’s 2027 rates/)).toBeTruthy()
    expect(view.watching()).toBe(0)
  })

  it('warns on load when the browser cannot tell what is in view', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    expect(within(panel()).getByText(/These are the City’s 2027 rates/)).toBeTruthy()
  })

  it('shows the own-rates toast when the editor gives it a message', async () => {
    stubView()
    const own = toastsOf([
      { toast: 'ratesCarried', message: 'Carried.' },
      { toast: 'ratesOwn', message: 'All four rates are the {year} rates.' },
    ])
    render(
      <BillShare {...PROPS} {...city} toasts={own}>
        x
      </BillShare>,
    )
    await choose('2026')
    expect(within(panel()).getByText('All four rates are the 2026 rates.')).toBeTruthy()
  })

  it('shows none when the editor turned the warning off', async () => {
    const view = stubView()
    render(
      <BillShare {...PROPS} {...city} toasts={{ ...PROPS.toasts, ratesCarried: null }}>
        x
      </BillShare>,
    )
    await view.enter()
    await calculate('750000')
    expect(within(panel()).queryByRole('button', { name: 'Got it' })).toBeNull()
  })
})
