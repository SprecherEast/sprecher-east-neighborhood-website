// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'
import type { ChartSpec } from '@/platform/lib/chart/spec'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { textAdapter } from './adapters/text/textAdapter'
import { Chart } from './Chart'

afterEach(cleanup)

describe('Chart', () => {
  it('shows the title, the takeaway, the drawing, the key and the caption, in that order', () => {
    const { container } = render(<Chart spec={FIXTURES.paysFor} />)
    const figure = screen.getByRole('figure')
    const kids = [...figure.children].map((el) => el.tagName)
    // title block, hidden description, the drawing (with its Enlarge button), the key, the
    // figcaption (last, as HTML requires)
    expect(kids).toEqual(['DIV', 'P', 'DIV', 'DIV', 'FIGCAPTION'])
    expect(figure.children[2].querySelector('[role="img"]')).toBeTruthy()
    expect(within(figure).getByText(FIXTURES.paysFor.title)).toBeTruthy()
    expect(within(figure).getByText(FIXTURES.paysFor.summary)).toBeTruthy()
    expect(container.querySelectorAll('[data-legend-swatch]')).toHaveLength(6)
  })

  it('names the figure’s drawing by its title and its description', () => {
    render(<Chart spec={FIXTURES.paysFor} />)
    const image = screen.getByRole('img', { name: /What the money pays for, proposed/ })
    expect(image.getAttribute('aria-labelledby')?.split(' ')).toHaveLength(2)
    expect(image.getAttribute('aria-labelledby')).toContain('description')
  })

  it('says what a square means, when, from where and how sure, as real text', () => {
    render(<Chart spec={FIXTURES.paysFor} />)
    const caption = screen.getByRole('figure').querySelector('figcaption') as HTMLElement
    expect(caption.textContent).toContain('Each square is $1 of every $100')
    expect(caption.textContent).toContain("Mayor's proposal, October 2026")
    expect(caption.textContent).toContain('Confirmed')
    expect(caption.textContent).toContain('not the budget the Council adopts')
    const link = within(caption).getByRole('link')
    expect(link.getAttribute('href')).toContain('cleardocs')
  })

  it('keeps the numbers in a closed "Show the numbers" box with a real table', () => {
    const { container } = render(<Chart spec={FIXTURES.paysFor} />)
    const details = container.querySelector('details') as HTMLDetailsElement
    expect(details.open).toBe(false)
    expect(details.querySelector('summary')?.textContent).toBe('Show the numbers')
    expect(within(details).getByRole('table', { hidden: true })).toBeTruthy()
  })

  it('shares one key between two grids of the same parts, with each grid’s squares', () => {
    render(<Chart spec={FIXTURES.paysFor} />)
    const key = screen.getByRole('list', { name: 'Chart key' })
    expect(within(key).getAllByRole('listitem')[0].textContent).toContain(
      'Of every $100: 41 in 2026 adopted, 41 in 2027 proposed',
    )
  })

  it('draws with the text adapter when it is chosen, with no colour key', () => {
    const { container } = render(<Chart spec={FIXTURES.borrowed} adapter={textAdapter} />)
    expect(container.querySelector('[role="img"]')).toBeNull()
    expect(container.querySelectorAll('[data-legend-swatch]')).toHaveLength(0)
    expect(screen.getAllByText('$171,688,393', { exact: false }).length).toBeGreaterThan(0)
  })

  it('has no Enlarge button on the text adapter, or when zoom is off (#681)', () => {
    const { unmount } = render(<Chart spec={FIXTURES.borrowed} adapter={textAdapter} />)
    expect(screen.queryByRole('button', { name: /Enlarge/ })).toBeNull()
    unmount()

    render(<Chart spec={FIXTURES.bars} zoom={false} />)
    expect(screen.queryByRole('button', { name: /Enlarge/ })).toBeNull()
    expect(screen.getByRole('img', { name: /The day-to-day budget, proposed/ })).toBeTruthy()
  })

  it('sets the drawing’s width itself: small in the page, none on the text adapter (#681)', () => {
    const { container, unmount } = render(<Chart spec={FIXTURES.bars} />)
    const sized = container
      .querySelector('[role="img"]')
      ?.closest('.max-w-\\[var\\(--chart-width\\)\\]')
    expect(sized).toBeTruthy()
    expect(container.innerHTML).toContain('[--chart-width:var(--chart-small-width)]')
    unmount()

    const text = render(<Chart spec={FIXTURES.borrowed} adapter={textAdapter} />)
    expect(text.container.innerHTML).not.toContain('--chart-width')
  })

  it('refuses a chart that does not add up, with the reason', () => {
    const bad = structuredClone(FIXTURES.comesIn) as ChartSpec & { groups: { total: number }[] }
    bad.groups[0].total = 1
    expect(() => render(<Chart spec={bad} />)).toThrow(/total/)
  })

  it.each(Object.entries(FIXTURES))('passes axe: %s', async (_name, spec) => {
    const { container } = render(<Chart spec={spec} />)
    await expectAccessible(container)
  })
})
