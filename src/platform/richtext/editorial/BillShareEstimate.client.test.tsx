// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BillShare } from './BillShare.client'
import { city, PROPS, stubView } from './billShareFixtures'
import { toastsOf } from './billToasts'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const answer = () => screen.getByRole('region', { name: 'Your City tax' })
const bill = () => screen.getByRole('region', { name: 'Your whole property tax bill' })
const rates = (title: string) => screen.getByRole('region', { name: title })
const press = (card: HTMLElement, name: string) =>
  act(async () => fireEvent.click(within(card).getByRole('button', { name })))
const accept = (card: HTMLElement) => press(card, 'Got it')
const choose = (label: string) =>
  act(async () => fireEvent.click(screen.getByRole('button', { name: label })))

const page = (props: Partial<Parameters<typeof BillShare>[0]> = {}) =>
  render(
    <BillShare {...PROPS} {...city} certainty="estimate" {...props}>
      x
    </BillShare>,
  )

describe('BillShare, the Estimate button on each panel (#1417)', () => {
  it('titles the rates panel for the year shown: the City’s rate while others are carried, the year’s rates when all are its own', async () => {
    stubView()
    page()
    expect(rates('2027 city rate')).toBeTruthy()
    await choose('2026')
    expect(rates('2026 rates')).toBeTruthy()
  })

  it('draws the three panel titles in one header style (#1417)', () => {
    stubView()
    page()
    const titles = [
      within(answer()).getByText('City tax on an average home'),
      rates('2027 city rate').querySelector('h3'),
      within(bill()).getByText('Your whole bill'),
    ]
    const looks = titles.map((title) => title?.className)
    expect(looks[0]).toContain('text-lg')
    expect(new Set(looks).size).toBe(1)
  })

  it('has the button on the rates panel’s title line, the answer card and the whole bill', () => {
    stubView()
    page()
    for (const card of [answer(), rates('2027 city rate'), bill()])
      expect(within(card).getByRole('button', { name: /what this means$/ })).toBeTruthy()
  })

  it('opens the rates warning, saying the others are not out yet and that 2026’s are used, then closes it', async () => {
    stubView()
    page()
    const panel = rates('2027 city rate')
    await press(panel, 'Proposed, what this means')
    expect(
      within(panel).getByText(
        'These are the City’s 2027 rates. The others aren’t out yet, so we’re using 2026’s.',
      ),
    ).toBeTruthy()
    await accept(panel)
    expect(within(panel).queryByRole('button', { name: 'Got it' })).toBeNull()
  })

  it('says its own short thing in a year where every rate is the year’s own', async () => {
    stubView()
    page()
    await choose('2026')
    const panel = rates('2026 rates')
    await press(panel, 'Estimate, what this means')
    expect(within(panel).getByText(/These are the 2026 rates we used/)).toBeTruthy()
  })

  it('opens the answer card’s and the whole bill’s warnings inside their own cards, one at a time', async () => {
    stubView()
    page()
    await press(answer(), 'Proposed, what this means')
    expect(within(answer()).getByText(/This is the City’s share of your bill/)).toBeTruthy()
    await press(bill(), 'Proposed, what this means')
    expect(within(bill()).getByText(/It’s an estimate/)).toBeTruthy()
    // Only one is open: the answer card's gave way
    expect(within(answer()).queryByRole('button', { name: 'Got it' })).toBeNull()
  })

  it('opens as often as the reader presses, with no limit', async () => {
    stubView()
    page()
    const panel = rates('2027 city rate')
    for (let times = 0; times < 4; times += 1) {
      await press(panel, 'Proposed, what this means')
      expect(within(panel).getByRole('button', { name: 'Got it' })).toBeTruthy()
      await accept(panel)
    }
  })

  it('goes away when the year changes, since it was about the year it was opened in', async () => {
    stubView()
    page()
    await press(answer(), 'Proposed, what this means')
    await choose('2026')
    expect(screen.queryByRole('button', { name: 'Got it' })).toBeNull()
  })

  it('is a plain label, not a button, where the editor emptied that warning’s message', () => {
    stubView()
    page({ toasts: { ...toastsOf(undefined), aboutAnswer: null } })
    expect(within(answer()).queryByRole('button')).toBeNull()
    expect(within(answer()).getByText('Proposed')).toBeTruthy()
    expect(within(bill()).getByRole('button', { name: /what this means$/ })).toBeTruthy()
  })

  it('gives focus back to the button that opened a warning when the reader accepts it', async () => {
    stubView()
    page()
    const button = within(answer()).getByRole('button', { name: 'Proposed, what this means' })
    button.focus()
    await act(async () => fireEvent.click(button))
    await accept(answer())
    expect(document.activeElement).toBe(button)
  })
})
