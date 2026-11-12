// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { BillDetails } from './BillDetails'

afterEach(cleanup)

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
  it('has three rows, each a closed native details, in the order where, how, sources', () => {
    const { container } = render(
      <BillDetails
        where={<p>Breakdown</p>}
        notes={NOTES}
        about={<p>Short text</p>}
        sources={[SOURCE]}
      />,
    )
    const rows = Array.from(container.querySelectorAll('details'))
    expect(rows.map((row) => row.querySelector('summary')?.textContent)).toEqual([
      'Where the tax goes',
      'How we estimate',
      'Sources',
    ])
    expect(rows.every((row) => !row.hasAttribute('open'))).toBe(true)
  })

  it('puts the notes first and the tab’s short text after them in the row on how it works', () => {
    render(<BillDetails notes={NOTES} about={<p>Short text</p>} sources={[]} />)
    const note = screen.getByText(/every bill differs/)
    const about = screen.getByText('Short text')
    expect(note.compareDocumentPosition(about) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('leaves out the rows with nothing in them, but never the one on how it works', () => {
    const { container } = render(<BillDetails notes={NOTES} sources={[]} />)
    expect(container.querySelectorAll('details')).toHaveLength(1)
  })

  it('keeps the room of a note that is not showing, hidden from everyone', () => {
    const { rerender } = render(
      <BillDetails notes={NOTES.map((note, i) => ({ ...note, shown: i === 0 }))} sources={[]} />,
    )
    const hidden = screen.getByText('2027 rates are not confirmed.').closest('li')
    expect(hidden?.className).toContain('invisible')
    expect(hidden?.getAttribute('aria-hidden')).toBe('true')
    rerender(<BillDetails notes={NOTES} sources={[]} />)
    const shown = screen.getByText('2027 rates are not confirmed.').closest('li')
    expect(shown?.className).not.toContain('invisible')
    expect(shown?.getAttribute('aria-hidden')).toBeNull()
  })

  it('lists each source as a link', () => {
    render(<BillDetails notes={NOTES} sources={[SOURCE]} />)
    expect(screen.getByRole('link', { name: /City tax detail/ }).getAttribute('href')).toBe(
      'https://example.org/tax',
    )
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <BillDetails
        where={<p>Breakdown</p>}
        notes={NOTES}
        about={<p>Short</p>}
        sources={[SOURCE]}
      />,
    )
    await expectAccessible(container)
  })
})
