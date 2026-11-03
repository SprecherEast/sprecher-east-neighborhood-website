// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
        hasHeroImage={false}
        header={{ title: 'Park cleanup' }}
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
  it('reads as an article: the title, the trail, the text, then the sidebar', async () => {
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

  it('leaves room under a photo header only when there is one', () => {
    const body = () => screen.getByRole('article').querySelector('article > div')

    renderArticle({ hasHeroImage: true })
    expect(body()?.className).toContain('pt-8')

    cleanup()
    renderArticle({ hasHeroImage: false })
    expect(body()?.className ?? '').not.toContain('pt-8')
  })
})
