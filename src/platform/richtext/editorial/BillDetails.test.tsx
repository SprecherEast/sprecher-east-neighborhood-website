// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { BillDetails } from './BillDetails'

afterEach(cleanup)

// Titles that differ from the starting ones, so they can only have come from the block
const TITLES = {
  breakdown: 'Where it goes',
  differ: 'Why it may differ',
  sources: 'Where we looked',
}

const NOTES = [
  { key: 'rough', text: 'A rough estimate: every bill differs.', shown: true },
  { key: 'unconfirmed', text: '2027 rates are not confirmed.', shown: true },
]
const SOURCE = {
  label: 'City tax detail',
  href: 'https://example.org/tax',
  external: true,
  appearance: 'default' as const,
}

describe('BillDetails', () => {
  it('has two rows, each a native details, in the order how, sources, both closed (#1163)', () => {
    const { container } = render(
      <BillDetails titles={TITLES} notes={NOTES} about={<p>Short text</p>} sources={[SOURCE]} />,
    )
    const rows = Array.from(container.querySelectorAll('details'))
    expect(rows.map((row) => row.querySelector('summary')?.textContent)).toEqual([
      TITLES.differ,
      TITLES.sources,
    ])
    expect(rows.map((row) => row.hasAttribute('open'))).toEqual([false, false])
    // The City's breakdown now sits in the whole bill, under the City's row (#1163)
    expect(screen.queryByText('Your City tax breakdown')).toBeNull()
  })

  it('holds the rows in one card, split by divider lines, not separate boxes (#1118)', () => {
    const { container } = render(<BillDetails titles={TITLES} notes={NOTES} sources={[SOURCE]} />)
    const rows = Array.from(container.querySelectorAll('details'))
    const card = rows[0]?.parentElement as HTMLElement
    expect(card.className).toContain('border')
    expect(card.className).toContain('divide-y')
    expect(rows.every((row) => row.parentElement === card)).toBe(true)
    // A row is no box of its own
    expect(rows.some((row) => /(^|\s)border(\s|$)/.test(row.className))).toBe(false)
  })

  it('puts the notes first and the tab’s short text after them in the row on why the bill may differ', () => {
    render(<BillDetails titles={TITLES} notes={NOTES} about={<p>Short text</p>} sources={[]} />)
    const note = screen.getByText(/every bill differs/)
    const about = screen.getByText('Short text')
    expect(note.compareDocumentPosition(about) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('leaves out the rows with nothing in them, but never the one on how it works', () => {
    const { container } = render(<BillDetails titles={TITLES} notes={NOTES} sources={[]} />)
    expect(container.querySelectorAll('details')).toHaveLength(1)
  })

  it('keeps the room of a note that is not showing, hidden from everyone', () => {
    const { rerender } = render(
      <BillDetails
        titles={TITLES}
        notes={NOTES.map((note, i) => ({ ...note, shown: i === 0 }))}
        sources={[]}
      />,
    )
    const hidden = screen.getByText('2027 rates are not confirmed.').closest('li')
    expect(hidden?.className).toContain('invisible')
    expect(hidden?.getAttribute('aria-hidden')).toBe('true')
    rerender(<BillDetails titles={TITLES} notes={NOTES} sources={[]} />)
    const shown = screen.getByText('2027 rates are not confirmed.').closest('li')
    expect(shown?.className).not.toContain('invisible')
    expect(shown?.getAttribute('aria-hidden')).toBeNull()
  })

  it('lists each source as a link', () => {
    render(<BillDetails titles={TITLES} notes={NOTES} sources={[SOURCE]} />)
    expect(screen.getByRole('link', { name: /City tax detail/ }).getAttribute('href')).toBe(
      'https://example.org/tax',
    )
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <BillDetails titles={TITLES} notes={NOTES} about={<p>Short</p>} sources={[SOURCE]} />,
    )
    await expectAccessible(container)
  })
})
