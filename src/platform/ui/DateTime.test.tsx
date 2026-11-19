// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { DateTime } from './DateTime'

afterEach(cleanup)

describe('DateTime', () => {
  it('gives a day-only date its calendar day, in the text and the attribute (#432)', () => {
    render(<DateTime value="2024-03-03T00:00:00.000Z" />)

    const time = screen.getByText('Mar 3, 2024')
    expect(time.tagName).toBe('TIME')
    expect(time.getAttribute('datetime')).toBe('2024-03-03')
  })

  it('keeps a real instant as a full ISO string and formats it long', () => {
    render(<DateTime value="2024-07-25T17:00:00.000Z" format="long" />)

    const time = screen.getByText('Thu, Jul 25, 2024')
    expect(time.getAttribute('datetime')).toBe('2024-07-25T17:00:00.000Z')
  })

  it('shows nothing for a value that is not a date', () => {
    const { container } = render(<DateTime value="not a date" />)

    expect(container.innerHTML).toBe('')
  })
})
