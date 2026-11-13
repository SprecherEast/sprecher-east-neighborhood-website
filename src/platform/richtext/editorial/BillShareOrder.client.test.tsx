// @vitest-environment jsdom
import { createRequire } from 'node:module'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { BILL_GAP, BillShare } from './BillShare.client'
import { city, estimate, PROPS } from './billShareFixtures'

afterEach(cleanup)

describe('BillShare, the order of the tab and its three rows (#1111, #1121)', () => {
  it('shows the estimate’s notes only in the row on how it works, closed until opened (#1111)', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    const row = screen.getByText('How we estimate this').closest('details') as HTMLDetailsElement
    expect(row.open).toBe(false)
    expect(row.textContent).toMatch(/a rough estimate/i)
    expect(row.textContent).toContain('Uses 2027 rates.')
    expect(screen.getAllByText(/a rough estimate/i)).toHaveLength(1)
  })

  it('puts the same space above the estimator as below it, from one shared value (#1142)', () => {
    render(<BillShare {...PROPS} {...city} certainty="estimate" source={PROPS.years[0]?.source} />)
    const estimator = screen.getByRole('region', { name: 'Rough Estimator' })
    const stack = estimator.parentElement as HTMLElement
    // The intro, the estimator and the answer card are siblings in one stack, with no margin of their own
    expect(stack.className).toContain(BILL_GAP)
    expect(stack.contains(screen.getByText(PROPS.intro))).toBe(true)
    expect(screen.getByRole('region', { name: 'Your City tax' }).parentElement).toBe(stack)
    for (const node of [
      estimator.previousElementSibling,
      estimator,
      estimator.nextElementSibling,
    ]) {
      expect(node?.className).not.toMatch(/(^|\s)-?m[tby]-/)
    }
  })

  it("makes that space the rich text paragraph spacing, from the typography plugin's own value (#1142)", () => {
    const styles = createRequire(import.meta.url)('@tailwindcss/typography/src/styles.js') as {
      DEFAULT: { css: { p: { marginTop: string } }[] }
    }
    const paragraph = styles.DEFAULT.css[0]?.p.marginTop
    // 1.25em of the 1rem prose text is 1.25rem, which is Tailwind's spacing step 5
    expect(paragraph).toBe('1.25em')
    expect(BILL_GAP).toBe('space-y-5')
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
      screen.getByText('Your City tax share, estimated'),
      screen.getByText('How we estimate this'),
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

  it('opens the first row and closes the other two by default, and each source appears once (#1111, #1121)', () => {
    const { container } = render(
      <BillShare {...PROPS} {...city} source={PROPS.years[0]?.source}>
        x
      </BillShare>,
    )
    const rows = Array.from(container.querySelectorAll('details'))
    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.open)).toEqual([true, false, false])
    // The tab's source and the year's source are the same link: listed once
    fireEvent.click(screen.getByRole('button', { name: '2026' }))
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
    expect(answer.textContent).toContain('Up $91 a year, about $7.58 a month')
    expect(answer.textContent).toContain(
      'Average home: $500,300. The City is 37% of the whole bill.',
    )
    // The 2027 switch has a stored note, so the one badge says it, with the "not final" look
    expect(screen.getAllByText('Proposed')).toHaveLength(1)
    expect(screen.queryByText('Estimate')).toBeNull()
  })

  it('has the badge follow the year chosen, so it never disagrees with the year control (#1118)', () => {
    render(
      <BillShare {...PROPS} {...city} certainty="confirmed">
        x
      </BillShare>,
    )
    const answer = () => screen.getByRole('region', { name: 'Your City tax' })
    expect(answer().textContent).toContain('Proposed')
    fireEvent.click(screen.getByRole('button', { name: '2026' }))
    // 2026 has no note: the badge is the tab's stored certainty
    expect(answer().textContent).toContain('Confirmed')
    expect(answer().textContent).not.toContain('Proposed')
    fireEvent.click(screen.getByRole('button', { name: '2027' }))
    expect(answer().textContent).toContain('Proposed')
  })

  it('labels the answer for the average home, then for the reader’s own home after an estimate (#1118)', async () => {
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    expect(screen.getByText('City tax on an average home')).toBeTruthy()
    await estimate('$1,000,600')
    expect(screen.getByText('City tax on your home')).toBeTruthy()
    expect(screen.queryByText('City tax on an average home')).toBeNull()
  })

  it('puts the whole bill in its own card, titled on top with no amount, the total as its last row (#1118)', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    const card = screen.getByRole('region', { name: 'Your whole property tax bill' })
    expect(card.className).toContain('border')
    const title = screen.getByText('Your whole bill')
    expect(title.textContent).toBe('Your whole bill')
    const total = screen.getByText('Total property tax').closest('p') as HTMLElement
    expect(total.textContent).toMatch(/^Total property tax\$\d/)
    expect(total.className).toContain('font-bold')
    // The last line of the card
    expect(card.querySelector('[data-share-bill]')?.lastElementChild).toBe(total)
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
