// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Badge } from './Badge'
import { PageHeader } from './PageHeader'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const facts = [
  { label: 'Date', value: 'Tue, Mar 3, 2026' },
  { label: 'Format', value: 'In person' },
]

describe('PageHeader', () => {
  it("draws the page's one h1 with its eyebrow and description, with no accessibility violations", async () => {
    const { container } = render(
      <main>
        <PageHeader
          eyebrow="Directory"
          title="Neighborhood Resources"
          description="Helpful contacts for residents."
        />
      </main>,
    )

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Neighborhood Resources')
    expect(screen.getByText('Directory').className).toContain('uppercase')
    expect(screen.getByText('Helpful contacts for residents.').className).toContain('max-w-2xl')
    await expectAccessible(container)
  })

  it('leaves out what it is not given', () => {
    const { container } = render(<PageHeader title="Search" />)

    expect(container.querySelectorAll('p')).toHaveLength(0)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('offers a way back and holds a control under the title', () => {
    render(
      <PageHeader title="Past Events" backLink={{ href: '/events', label: 'Back to all events' }}>
        <input aria-label="Search" />
      </PageHeader>,
    )

    expect(screen.getByRole('link', { name: 'Back to all events' }).getAttribute('href')).toBe(
      '/events',
    )
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeTruthy()
  })

  it('draws a compact header for a form page, with no container of its own (#439)', () => {
    const { container } = render(
      <PageHeader variant="compact" title="Log In" description="Log in to your account." />,
    )

    const header = container.querySelector('header')
    expect(header?.className).not.toContain('container')
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('text-3xl')
    expect(header?.className).toContain('mb-8')
  })

  it('keeps less room under a compact header with no description', () => {
    const { container } = render(<PageHeader variant="compact" title="Account Confirmed" />)

    expect(container.querySelector('header')?.className).toContain('mb-6')
  })

  it('takes no eyebrow, way back or control in the compact variant', () => {
    // @ts-expect-error A compact header is title and description only
    render(<PageHeader variant="compact" title="Log In" eyebrow="Account" />)
  })

  it('heads a post or an event on a plain band with no picture, the facts under it (#1013)', async () => {
    const { container } = render(
      <main>
        <PageHeader
          variant="band"
          eyebrow={<Badge>Parks</Badge>}
          title="Park cleanup"
          facts={facts}
        />
      </main>,
    )

    const title = screen.getByRole('heading', { level: 1 })
    expect(title.className).toContain('text-foreground')
    expect(title.className).not.toContain('text-on-image')
    expect(title.className).toContain('font-bold')
    // A themed surface from tokens, and no picture, scrim or photo credit
    const band = title.closest('[class*="bg-surface"]')
    expect(band).toBeTruthy()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[class*="scrim"]')).toBeNull()
    // The facts sit under the band, on the page background
    const list = screen.getByText('Date').closest('dl')
    expect(list?.className).toContain('text-muted-foreground')
    expect(band?.contains(list)).toBe(false)
    expect(band?.contains(screen.getByText('Parks'))).toBe(true)
    await expectAccessible(container)
  })

  it('draws a band with no facts or eyebrow', async () => {
    const { container } = render(
      <main>
        <PageHeader variant="band" title="Park cleanup" />
      </main>,
    )

    expect(container.querySelector('dl')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Park cleanup')
    await expectAccessible(container)
  })

  it('shows facts as a plain inline row on a header without a photo', async () => {
    const { container } = render(
      <main>
        <PageHeader eyebrow={<Badge>Parks</Badge>} title="Park cleanup" facts={facts} />
      </main>,
    )

    const list = screen.getByText('Date').closest('dl')
    expect(list?.className).toContain('text-muted-foreground')
    expect(screen.getByText('In person').tagName).toBe('DD')
    // A badge eyebrow keeps its own look: no uppercase overline around it
    expect(screen.getByText('Parks').parentElement?.className).not.toContain('uppercase')
    expect(container.querySelector('img')).toBeNull()
    await expectAccessible(container)
  })

  it('takes no picture, description or control on the band', () => {
    // @ts-expect-error The band shows title, eyebrow and facts only
    render(<PageHeader variant="band" title="Park cleanup" description="No" />)
  })
})
