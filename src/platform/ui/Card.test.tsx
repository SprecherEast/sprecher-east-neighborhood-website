// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Card, CardBody, CardFooter, CardMedia, CardMeta, CardTitle } from './Card'
import { CardGrid, CardGridItem } from './CardGrid'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

describe('Card', () => {
  it('is an elevated card with a border and a shadow by default (#426)', () => {
    render(<Card>Body</Card>)

    const card = screen.getByText('Body')
    expect(card.className).toContain('bg-card')
    expect(card.className).toContain('border-border')
    expect(card.className).toContain('shadow-sm')
    expect(card.className).toContain('rounded-2xl')
    expect(card.className).toContain('p-6')
  })

  it.each([
    ['outline', 'bg-background'],
    ['muted', 'bg-surface'],
    ['tinted', 'bg-primary/10'],
  ] as const)('draws the %s variant flat, on %s', (variant, background) => {
    render(<Card variant={variant}>Body</Card>)

    const card = screen.getByText('Body')
    expect(card.className).toContain(background)
    expect(card.className).not.toContain('shadow-sm')
  })

  it('renders the element and attributes it is given', () => {
    render(
      <Card as="section" aria-label="Profile" padding="sm">
        Body
      </Card>,
    )

    const card = screen.getByRole('region', { name: 'Profile' })
    expect(card.className).toContain('p-4')
  })

  it('stretches the title link over an interactive card, named by the title only', async () => {
    const { container } = render(
      <Card as="article" padding="none" interactive>
        <CardMedia>
          <span>Image</span>
        </CardMedia>
        <CardBody>
          <CardMeta>Oct 26</CardMeta>
          <CardTitle href="/events/picnic">Picnic</CardTitle>
          <CardFooter>Parks</CardFooter>
        </CardBody>
      </Card>,
    )

    const link = screen.getByRole('link', { name: 'Picnic' })
    expect(link.getAttribute('href')).toBe('/events/picnic')
    expect(link.className).toContain('after:absolute')
    expect(screen.getByRole('heading', { level: 3, name: 'Picnic' })).toBeTruthy()
    expect(container.querySelector('article')?.className).toContain('hover:shadow-md')
    await expectAccessible(container)
  })

  it("keeps the link's own focus outline on a card that is not interactive", () => {
    render(
      <Card>
        <CardTitle href="/faq">FAQ</CardTitle>
      </Card>,
    )

    expect(screen.getByRole('link', { name: 'FAQ' }).className).toContain('focus-visible:outline-2')
    expect(screen.getByText('FAQ').closest('div')?.className).not.toContain('outline-none')
  })

  it('keeps a plain title when there is no link', () => {
    render(<CardTitle as="h2">Library</CardTitle>)

    expect(screen.getByRole('heading', { level: 2, name: 'Library' })).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })
})

describe('CardGrid', () => {
  it('lists the cards, three columns wide on large screens by default', async () => {
    const { container } = render(
      <CardGrid>
        <CardGridItem>
          <Card>One</Card>
        </CardGridItem>
        <CardGridItem>
          <Card>Two</Card>
        </CardGridItem>
      </CardGrid>,
    )

    const list = screen.getByRole('list')
    expect(list.className).toContain('lg:grid-cols-3')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    await expectAccessible(container)
  })

  it('takes the columns, gap and element it is given', () => {
    const { container } = render(
      <CardGrid as="div" columns={4} gap="sm">
        <CardGridItem as="div">
          <Card>One</Card>
        </CardGridItem>
      </CardGrid>,
    )

    const grid = container.firstElementChild
    expect(grid?.tagName).toBe('DIV')
    expect(grid?.className).toContain('lg:grid-cols-4')
    expect(grid?.className).toContain('gap-4')
  })

  it('sets no screen-width columns with `columns="none"`, for a caller that sets its own (#678)', () => {
    const { container } = render(
      <CardGrid columns="none" className="@lg:grid-cols-2">
        <CardGridItem>
          <Card>One</Card>
        </CardGridItem>
      </CardGrid>,
    )

    const grid = container.firstElementChild as HTMLElement
    expect(grid.className).toContain('grid-cols-1')
    expect(grid.className).toContain('@lg:grid-cols-2')
    expect(grid.className).not.toMatch(/(^|\s)(sm|md|lg|xl):grid-cols/)
  })
})
