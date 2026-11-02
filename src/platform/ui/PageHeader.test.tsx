// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ImageRef } from '@/platform/lib/content'

import { Badge } from './Badge'
import { PageHeader } from './PageHeader'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const photo = {
  id: 1,
  alt: 'Volunteers planting trees in the park',
  url: '/api/media/file/park.webp',
  width: 1600,
  height: 900,
  mimeType: 'image/webp',
  credit: 'Jane Doe',
  updatedAt: '2026-10-01T12:00:00.000Z',
  createdAt: '2026-10-01T12:00:00.000Z',
} as ImageRef

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

  it('puts the title and facts on the photo, which loads first, with its credit (#461)', async () => {
    const { container } = render(
      <main>
        <PageHeader
          variant="image"
          image={photo}
          eyebrow={<Badge variant="on-image">Parks</Badge>}
          title="Park cleanup"
          facts={facts}
        />
      </main>,
    )

    const title = screen.getByRole('heading', { level: 1 })
    expect(title.className).toContain('text-on-image')
    expect(title.className).toContain('font-bold')
    const image = screen.getByRole('img', { name: photo.alt ?? '' })
    // `priority`: next/image preloads it and never lazy-loads it
    expect(image.getAttribute('loading')).not.toBe('lazy')
    expect(container.querySelector('[class*="from-scrim"]')).not.toBeNull()
    // The facts sit under the photo, on the page background, not on the photo (#571)
    const list = screen.getByText('Date').closest('dl')
    expect(list?.className).toContain('text-muted-foreground')
    const band = container.querySelector('[class*="min-h-[clamp"]')?.parentElement
    expect(band).toBeTruthy()
    expect(band?.contains(list)).toBe(false)
    expect(band?.contains(screen.getByRole('heading', { level: 1 }))).toBe(true)
    expect(screen.getByText('Parks').className).toContain('bg-scrim/60')
    expect(screen.getByText(/Jane Doe/)).toBeTruthy()
    await expectAccessible(container)
  })

  it('draws a photo header with no facts or eyebrow', async () => {
    const { container } = render(
      <main>
        <PageHeader variant="image" image={photo} title="Park cleanup" />
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

  it('takes no description or control on a photo header', () => {
    // @ts-expect-error The photo header shows title, eyebrow and facts only
    render(<PageHeader variant="image" image={photo} title="Park cleanup" description="No" />)
  })
})
