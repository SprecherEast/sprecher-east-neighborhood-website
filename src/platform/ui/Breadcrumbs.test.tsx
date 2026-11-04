// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/platform/lib/getURL', () => ({ getServerSideURL: () => 'https://example.com' }))

import { Breadcrumbs } from './Breadcrumbs'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Events', href: '/events' },
  { label: 'Summer picnic' },
]

const trail = () => within(screen.getByRole('navigation', { name: 'Breadcrumb' }))

describe('Breadcrumbs', () => {
  it('keeps the structured data exactly as it was', () => {
    const { container } = render(<Breadcrumbs items={ITEMS} />)

    const script = container.querySelector('script[type="application/ld+json"]')
    expect(JSON.parse(script?.textContent ?? '')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.com/' },
        { '@type': 'ListItem', position: 2, name: 'Events', item: 'https://example.com/events' },
        { '@type': 'ListItem', position: 3, name: 'Summer picnic' },
      ],
    })
  })

  it('links every crumb but the last, which is the current page', () => {
    render(<Breadcrumbs items={ITEMS} />)

    expect(
      trail()
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/', '/events'])
    const current = trail().getByText('Summer picnic')
    expect(current.getAttribute('aria-current')).toBe('page')
    expect(current.closest('a')).toBeNull()
  })

  it('shows a home icon for the first crumb and keeps its name for screen readers', () => {
    render(<Breadcrumbs items={ITEMS} />)

    const home = trail().getByRole('link', { name: 'Home' })
    expect(home.querySelector('svg')).not.toBeNull()
    expect(home.querySelector('.sr-only')?.textContent).toBe('Home')
  })

  it('separates crumbs with hidden chevrons, not slash characters', () => {
    const { container } = render(<Breadcrumbs items={ITEMS} />)

    expect(container.querySelectorAll('li > svg[aria-hidden="true"]')).toHaveLength(2)
    expect(trail().queryByText('/')).toBeNull()
  })

  it('keeps a long last crumb on one line with an ellipsis, its full text still in the page', () => {
    const title = 'A'.repeat(60)
    render(<Breadcrumbs items={[...ITEMS.slice(0, 2), { label: title }]} />)

    const current = trail().getByText(title)
    expect(current.className).toContain('truncate')
    expect(current.closest('li')?.className).toContain('min-w-0')
    expect(trail().getByRole('list').className).not.toContain('flex-wrap')
    // Inside a flex parent the trail may not grow past it, or the ellipsis would never apply
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).className).toContain('max-w-full')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Breadcrumbs items={ITEMS} />)

    await expectAccessible(container)
  })
})
