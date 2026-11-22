// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { YEAR_COUNT_MS } from '@/platform/ui/useCountedNumber.client'

import { BillShare } from './BillShare.client'
import { city, PROPS, RATES_PANEL } from './billShareFixtures'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const panel = () => screen.getByRole('region', { name: RATES_PANEL })
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

  it('follows the year chosen, and labels every line with the year its rate is from', async () => {
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    await choose('2026')
    expect(within(lineOf('City of Madison')).getByText('2026 rate')).toBeTruthy()
    expect(within(lineOf('City of Madison')).getByText('$7.01 per $1,000')).toBeTruthy()
    expect(within(panel()).getAllByText('2026 rate')).toHaveLength(4)
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

  it('counts the rates between the two years when the year changes, landing on the new rates (#1370)', async () => {
    let frames: ((time: number) => void)[] = []
    let now = 0
    vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => {
      frames.push(callback)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const step = (ms: number) =>
      act(() => {
        now += ms
        const pending = frames
        frames = []
        pending.forEach((frame) => frame(now))
      })
    const cityRate = () => within(lineOf('City of Madison')).getByText(/per \$1,000/).textContent
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    expect(cityRate()).toBe('$6.93 per $1,000')
    await choose('2026')
    step(0)
    step(YEAR_COUNT_MS / 2)
    // Part of the way: neither year's own rate, and the labels are already the chosen year's
    expect(cityRate()).not.toBe('$6.93 per $1,000')
    expect(cityRate()).not.toBe('$7.01 per $1,000')
    expect(within(lineOf('City of Madison')).getByText('2026 rate')).toBeTruthy()
    step(YEAR_COUNT_MS)
    expect(cityRate()).toBe('$7.01 per $1,000')
  })

  it('shows the new rates at once for a reader who asked for less motion (#1370)', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduced-motion') }))
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    await choose('2026')
    expect(within(lineOf('City of Madison')).getByText('$7.01 per $1,000')).toBeTruthy()
  })
})
