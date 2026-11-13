// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { NoteText } from './NoteText'

afterEach(cleanup)

const LINK = {
  label: 'send us a note',
  href: '/contact',
  external: false,
  appearance: 'default' as const,
}

describe('NoteText', () => {
  it('draws the link where {link} is written, with the words around it', () => {
    const { container } = render(<NoteText text="If it is far off, please {link}." link={LINK} />)
    expect(container.textContent).toBe('If it is far off, please send us a note.')
    expect(screen.getByRole('link', { name: 'send us a note' }).getAttribute('href')).toBe(
      '/contact',
    )
  })

  it('leaves the blank out when there is no link, so readers never see it', () => {
    const { container } = render(<NoteText text="Please {link}." link={null} />)
    expect(container.textContent).toBe('Please .')
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('draws the link once when the blank is written twice', () => {
    const { container } = render(<NoteText text="A {link} and {link}." link={LINK} />)
    expect(container.textContent).toBe('A send us a note and .')
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('draws no link for a note without the blank', () => {
    render(<NoteText text="Plain note." link={LINK} />)
    expect(screen.queryByRole('link')).toBeNull()
  })
})
