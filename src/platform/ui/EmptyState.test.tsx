// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Button } from './Button'
import { EmptyState } from './EmptyState'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

describe('EmptyState', () => {
  it('says what is missing and what to do, in a box by default', () => {
    const { container } = render(
      <EmptyState title="No news posts yet." description="Check back soon." />,
    )

    expect(screen.getByText('No news posts yet.').tagName).toBe('P')
    expect(screen.getByText('Check back soon.')).toBeTruthy()
    expect(container.firstElementChild?.className).toContain('bg-surface')
  })

  it('has no box under a search or a filter', () => {
    const { container } = render(<EmptyState variant="plain" title="No results found." />)

    expect(container.firstElementChild?.className).not.toContain('bg-surface')
  })

  it("makes the title the page's heading when it fills a page", () => {
    render(
      <EmptyState
        variant="page"
        title="404"
        description="This page could not be found."
        action={<Button href="/">Go home</Button>}
      />,
    )

    expect(screen.getByRole('heading', { level: 1, name: '404' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go home' }).getAttribute('href')).toBe('/')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <main>
        <EmptyState title="Resources are being added." description="Check back soon!" />
        <EmptyState variant="plain" title="No results found." />
      </main>,
    )

    await expectAccessible(container)
  })
})
