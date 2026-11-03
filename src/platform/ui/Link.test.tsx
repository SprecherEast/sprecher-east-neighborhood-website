// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { Search } from 'lucide-react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// next/link renders a plain <a> in tests (no router), so mark it to tell the two apart
vi.mock('next/link', () => ({
  default: ({ href, ...props }: ComponentProps<'a'>) => <a data-next-link href={href} {...props} />,
}))

import { Link } from './Link'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

describe('Link', () => {
  it('is a link to its href', () => {
    render(<Link href="/about">About</Link>)

    expect(screen.getByRole('link', { name: 'About' }).getAttribute('href')).toBe('/about')
  })

  it('marks the current page for assistive tech', () => {
    render(
      <Link href="/events" variant="nav" current>
        Events
      </Link>,
    )

    expect(screen.getByRole('link', { name: 'Events' }).getAttribute('aria-current')).toBe('page')
  })

  it('leaves aria-current off other pages', () => {
    render(
      <Link href="/news" variant="nav">
        News
      </Link>,
    )

    expect(screen.getByRole('link', { name: 'News' }).hasAttribute('aria-current')).toBe(false)
  })

  it('opens an external link in a new tab and says so', () => {
    render(
      <Link href="https://example.com" variant="action" external>
        Visit website
      </Link>,
    )

    const link = screen.getByRole('link', { name: 'Visit website, opens in a new tab' })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('keeps the text of an icon-only link for screen readers', () => {
    render(
      <Link href="/search" variant="nav" size="sm" iconOnly icon={<Search aria-hidden="true" />}>
        Search
      </Link>,
    )

    expect(screen.getByRole('link', { name: 'Search' })).toBeTruthy()
  })

  it('leaves an in-page link to the browser', () => {
    render(<Link href="#comments">Comments</Link>)

    expect(screen.getByRole('link', { name: 'Comments' }).hasAttribute('data-next-link')).toBe(
      false,
    )
  })

  it('has no accessibility violations in any variant', async () => {
    const { container } = render(
      <nav aria-label="Examples">
        <p>
          Read the <Link href="/notes">meeting notes</Link>.
        </p>
        <Link href="/events" variant="nav" size="sm" current>
          Events
        </Link>
        <Link href="/events" variant="nav" size="md">
          Events
        </Link>
        <Link href="/privacy" variant="muted">
          Privacy
        </Link>
        <Link href="tel:+16085550100" variant="action">
          (608) 555-0100
        </Link>
      </nav>,
    )

    await expectAccessible(container)
  })

  it('marks the section being read with aria-current="location" (#574)', () => {
    const { container } = render(
      <Link href="#money" variant="section" current="location">
        Money
      </Link>,
    )
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('#money')
    expect(link?.getAttribute('aria-current')).toBe('location')
  })
})
