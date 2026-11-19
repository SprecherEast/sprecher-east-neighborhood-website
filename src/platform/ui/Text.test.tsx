// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SMALL_TEXT, Text } from './Text'

afterEach(cleanup)

describe('Text', () => {
  it('makes headings h2 by default and the rest paragraphs (#441)', () => {
    render(
      <>
        <Text variant="section">Upcoming Events</Text>
        <Text variant="lead">All times are Central Time.</Text>
      </>,
    )

    expect(screen.getByRole('heading', { level: 2, name: 'Upcoming Events' })).toBeTruthy()
    expect(screen.getByText('All times are Central Time.').tagName).toBe('P')
  })

  it('takes the element it is given', () => {
    render(
      <Text variant="label" as="h3">
        Related Posts
      </Text>,
    )

    const label = screen.getByRole('heading', { level: 3, name: 'Related Posts' })
    expect(label.className).toContain('uppercase')
  })

  it('clamps a summary to a number of lines', () => {
    render(
      <Text variant="small" clamp={2}>
        A long summary
      </Text>,
    )

    expect(screen.getByText('A long summary').className).toContain('line-clamp-2')
  })

  it('exports its small style, so a caption can share it (#635)', () => {
    render(<Text variant="small">Small</Text>)

    for (const name of SMALL_TEXT.split(' ')) {
      expect(screen.getByText('Small').className).toContain(name)
    }
  })

  it('has a figure style for the one big number a card is about (#1111)', () => {
    render(<Text variant="figure">$3,467</Text>)

    const figure = screen.getByText('$3,467')
    expect(figure.tagName).toBe('P')
    expect(figure.className).toContain('text-4xl')
    expect(figure.className).toContain('tabular-nums')
  })
})
