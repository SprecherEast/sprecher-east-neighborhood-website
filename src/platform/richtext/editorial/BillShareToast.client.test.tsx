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
const pressBadge = (name: RegExp | string) =>
  act(async () => fireEvent.click(within(panel()).getByRole('button', { name })))
const anyToast = () => screen.queryByRole('button', { name: 'Got it' })
const calculate = async (value: string) => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Enter your assessed value' }), {
    target: { value },
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Estimate' }))
  })
}

describe('BillShare, toasts open only from the Estimate button (#1380, #1392, #1417)', () => {
  it('shows nothing on load, and watches nothing that could open a toast by scrolling', () => {
    const view = stubView()
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    expect(anyToast()).toBeNull()
    expect(within(panel()).queryByText(/The others aren’t out yet/)).toBeNull()
    expect(view.watching()).toBe(0)
  })

  it('also shows nothing on load where the browser cannot tell what is in view', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    expect(anyToast()).toBeNull()
  })

  it('opens none on an estimate or a year switch, in either year', async () => {
    stubView()
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    await calculate('750000')
    expect(anyToast()).toBeNull()
    await choose('2026')
    await calculate('800000')
    await choose('2027')
    expect(anyToast()).toBeNull()
  })

  it('says the others are not out yet when the reader presses the rates button, as often as they press it', async () => {
    stubView()
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    for (let times = 0; times < 4; times += 1) {
      await pressBadge(/what this means$/)
      expect(within(panel()).getByText(/These are the City’s 2027 rates/)).toBeTruthy()
      await pressBadge('Got it')
      expect(anyToast()).toBeNull()
    }
  })

  it('shows the own-rates toast on a press when the editor gives it a message', async () => {
    stubView()
    const own = toastsOf([
      { toast: 'ratesCarried', message: 'Carried.' },
      { toast: 'ratesOwn', message: 'All four rates are the {year} rates.' },
    ])
    render(
      <BillShare
        {...PROPS}
        {...city}
        years={PROPS.years.map((year, at) => (at === 0 ? { ...year, note: 'proposed' } : year))}
        toasts={own}
      >
        x
      </BillShare>,
    )
    await choose('2026')
    expect(anyToast()).toBeNull()
    await pressBadge(/what this means$/)
    expect(within(panel()).getByText('All four rates are the 2026 rates.')).toBeTruthy()
  })

  it('makes the badge a plain label when the editor turned the warning off', () => {
    stubView()
    render(
      <BillShare
        {...PROPS}
        {...city}
        toasts={{ ...PROPS.toasts, ratesCarried: null, aboutRates: null }}
      >
        x
      </BillShare>,
    )
    expect(within(panel()).queryByRole('button', { name: /what this means$/ })).toBeNull()
  })
})
