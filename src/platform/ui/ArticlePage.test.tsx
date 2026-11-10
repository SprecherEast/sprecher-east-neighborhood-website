// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ImageRef } from '@/platform/lib/content'

import { ArticlePage } from './ArticlePage'
import { expectAccessible } from './testing/expectAccessible'

// The listener talks to Payload's admin and the Next router, which a page test has no use for
vi.mock('./LivePreviewListener.client', () => ({
  LivePreviewListener: () => <div data-testid="live-preview" />,
}))

afterEach(cleanup)

const renderArticle = (props: Partial<Parameters<typeof ArticlePage>[0]> = {}) =>
  render(
    <main>
      <ArticlePage
        jsonLd={{ '@type': 'NewsArticle' }}
        redirects={<span data-testid="redirects" />}
        draft={false}
        header={{ variant: 'band', title: 'Park cleanup' }}
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'News', href: '/posts' },
          { label: 'Park cleanup' },
        ]}
        aside={<p>Upcoming events</p>}
        {...props}
      >
        <p>The article</p>
      </ArticlePage>
    </main>,
  )

describe('ArticlePage', () => {
  it('reads as an article: the title, the trail, the text, then the related content', async () => {
    const { container } = renderArticle()

    const article = screen.getByRole('article')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Park cleanup')
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeTruthy()
    expect(article.textContent).toContain('The article')
    expect(screen.getByRole('complementary').textContent).toBe('Upcoming events')
    expect(container.querySelector('script[type="application/ld+json"]')).toBeTruthy()
    await expectAccessible(container)
  })

  it('puts the redirects the page passes in, and keeps the page’s own spacing classes', () => {
    renderArticle({ className: 'pb-16 pt-32' })

    expect(screen.getByTestId('redirects')).toBeTruthy()
    expect(screen.getByRole('article').className).toBe('pb-16 pt-32')
  })

  it('listens for Live Preview only when viewing a draft', () => {
    renderArticle()
    expect(screen.queryByTestId('live-preview')).toBeNull()

    cleanup()
    renderArticle({ draft: true })
    expect(screen.getByTestId('live-preview')).toBeTruthy()
  })

  describe('the byline', () => {
    const byline = [
      { label: 'Author', value: 'Ana' },
      { label: 'Date Published', value: 'Tue, Nov 3, 2026' },
    ]

    it('is the first row of the article column, above the text, not in the header', () => {
      renderArticle({ byline })

      const row = screen.getByText('Author').closest('dl')
      expect(row).not.toBeNull()
      expect(row?.closest('header')).toBeNull()
      // Same column as the text, and directly before it
      expect(row?.nextElementSibling?.textContent).toBe('The article')
      expect(row?.parentElement).toBe(screen.getByText('The article').parentElement)
    })

    it('starts at the left on a small screen and ends at the right edge from lg', () => {
      renderArticle({ byline })

      const row = screen.getByText('Author').closest('dl')
      expect(row?.className).toContain('lg:justify-end')
      expect(row?.className.split(' ')).not.toContain('justify-end')
    })

    it('takes the width the page gives the text, so it ends on the text’s edge (#774)', () => {
      renderArticle({ byline, textClassName: 'max-w-[40rem]' })

      expect(screen.getByText('Author').closest('dl')?.className).toContain('max-w-[40rem]')
    })

    it('draws nothing when there are no facts', () => {
      renderArticle({ byline: [] })

      expect(screen.queryByRole('term')).toBeNull()
      expect(screen.getByText('The article').parentElement?.children).toHaveLength(1)
    })
  })

  describe('the featured image (#1013)', () => {
    const picture = {
      id: 1,
      alt: 'A poster with its details in a panel',
      url: '/api/media/file/poster.webp',
      width: 1670,
      height: 941,
      mimeType: 'image/webp',
      updatedAt: '2026-10-01T12:00:00.000Z',
      createdAt: '2026-10-01T12:00:00.000Z',
    } as ImageRef

    it('is the first thing in the article column, whole, and not in the header', async () => {
      const { container } = renderArticle({
        image: picture,
        byline: [{ label: 'Author', value: 'Ana' }],
      })

      const img = screen.getByRole('img', { name: picture.alt ?? '' })
      expect(img.closest('header')).toBeNull()
      const column = screen.getByText('The article').parentElement
      expect(column?.firstElementChild?.contains(img)).toBe(true)
      expect(img.className).not.toContain('object-')
      await expectAccessible(container)
    })

    it('draws nothing, and leaves no gap, on a page without a picture', () => {
      const { container } = renderArticle({ image: null })

      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('figure')).toBeNull()
      expect(screen.getByText('The article').parentElement?.children).toHaveLength(1)
    })
  })

  it('always leaves room under the title band', () => {
    renderArticle()

    expect(screen.getByRole('article').querySelector('article > div')?.className).toContain('pt-8')
  })
})
