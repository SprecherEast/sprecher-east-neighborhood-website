// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ImageRef } from '@/platform/lib'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { ResourceSummary } from '../domain/types'
import { ResourceCard } from './ResourceCard'

afterEach(cleanup)

const photo = {
  id: 3,
  alt: 'Placeholder portrait',
  url: '/api/media/file/portrait.webp',
  width: 500,
  height: 500,
  mimeType: 'image/webp',
  updatedAt: '2026-11-01T12:00:00.000Z',
  createdAt: '2026-11-01T12:00:00.000Z',
} as ImageRef

const resource: ResourceSummary = {
  id: 1,
  title: 'Alder — District 16',
  description: 'Our alder.',
  url: 'https://www.cityofmadison.com/council/district16',
  phone: '(608) 555-0100',
  category: 'elected-officials',
}

describe('ResourceCard', () => {
  it('keeps the card as it was before photos (#393)', () => {
    const { container } = render(<ResourceCard resource={resource} />)
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<article class="relative min-w-0 rounded-2xl border border-border bg-card shadow-sm p-6 flex flex-col"><h3 class="font-semibold text-balance text-foreground mb-1.5 text-base">Alder — District 16</h3><p class="text-sm leading-relaxed text-muted-foreground mb-3">Our alder.</p><div class="mt-auto flex flex-wrap gap-3 pt-0"><a target="_blank" rel="noopener noreferrer" class="rounded-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&amp;_svg]:size-4 [&amp;_svg]:shrink-0 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-strong underline-offset-4 hover:underline" href="https://www.cityofmadison.com/council/district16"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link" aria-hidden="true"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>Visit Website<span class="sr-only">, opens in a new tab</span></a><a class="rounded-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&amp;_svg]:size-4 [&amp;_svg]:shrink-0 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-strong underline-offset-4 hover:underline" href="tel:(608) 555-0100"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-phone" aria-hidden="true"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"></path></svg>(608) 555-0100</a></div></article>"`,
    )
  })

  it('keeps that card when the photo is only an id, or has no credit', () => {
    const before = render(<ResourceCard resource={resource} />).container.innerHTML
    cleanup()
    for (const variant of [
      { photo: 3, photoCredit: 'City of Madison' },
      { photo, photoCredit: null },
      { links: [] },
    ]) {
      const { container } = render(<ResourceCard resource={{ ...resource, ...variant }} />)
      expect(container.innerHTML).toBe(before)
      cleanup()
    }
  })

  it('shows an official’s portrait named after them, with its credit linked to the source', async () => {
    const { container } = render(
      <ResourceCard
        resource={{
          ...resource,
          photo,
          photoCredit: 'City of Madison, Alder Sean O’Brien',
          photoSourceUrl: 'https://www.cityofmadison.com/council/district16',
        }}
      />,
    )

    expect(screen.getByRole('img', { name: 'Alder — District 16' })).toBeDefined()
    expect(container.textContent).toContain('Photo: City of Madison, Alder Sean O’Brien')
    expect(
      screen
        .getByRole('link', { name: /City of Madison, Alder Sean O’Brien/ })
        .getAttribute('href'),
    ).toBe('https://www.cityofmadison.com/council/district16')
    await expectAccessible(container)
  })

  it('shows the credit as plain text without a source link', () => {
    const { container } = render(
      <ResourceCard resource={{ ...resource, photo, photoCredit: 'City of Madison' }} />,
    )
    expect(container.textContent).toContain('Photo: City of Madison')
    expect(screen.queryByRole('link', { name: /City of Madison/ })).toBeNull()
  })

  it('shows no portrait on a card outside Elected Officials', () => {
    render(
      <ResourceCard
        resource={{ ...resource, category: 'community', photo, photoCredit: 'Someone' }}
      />,
    )
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('adds the extra links after "Visit Website", each opening in a new tab', async () => {
    const { container } = render(
      <ResourceCard
        resource={{
          ...resource,
          links: [
            {
              id: 'a',
              label: 'Alder blog',
              url: 'https://www.cityofmadison.com/council/district16/blog',
            },
            { id: 'b', label: 'Bad', url: 'javascript:alert(1)' },
          ],
        }}
      />,
    )

    const names = screen.getAllByRole('link').map((link) => link.textContent)
    expect(names).toEqual([
      'Visit Website, opens in a new tab',
      'Alder blog, opens in a new tab',
      '(608) 555-0100',
    ])
    expect(screen.getByRole('link', { name: /Alder blog/ }).getAttribute('target')).toBe('_blank')
    await expectAccessible(container)
  })
})

describe('ResourceCard, with a portrait, in a row of cards (#741)', () => {
  it('starts the portrait and the name on one line, so names in a row begin together', () => {
    const { container } = render(
      <ResourceCard resource={{ ...resource, photo, photoCredit: 'City of Madison' }} />,
    )
    const row = container.querySelector('article > div') as HTMLElement

    expect(row.className).toContain('items-start')
    expect(row.className).not.toContain('items-center')
  })
})
