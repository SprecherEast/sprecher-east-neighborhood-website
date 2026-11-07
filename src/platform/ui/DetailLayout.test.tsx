// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { DetailLayout } from './DetailLayout'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

describe('DetailLayout', () => {
  it('puts the sidebar in an aside beside the content (#434)', async () => {
    const { container } = render(
      <main>
        <DetailLayout aside={<p>Upcoming events</p>}>
          <p>The post</p>
        </DetailLayout>
      </main>,
    )

    const aside = screen.getByRole('complementary')
    expect(aside.textContent).toBe('Upcoming events')
    expect(container.querySelector('main > div')?.textContent).toContain('The post')
    await expectAccessible(container)
  })

  describe('with a page menu (#677)', () => {
    const renderWithMenu = () =>
      render(
        <main>
          <DetailLayout
            toc={<nav aria-label="On this page">Menu</nav>}
            aside={<p>Related content</p>}
          >
            <p>The post</p>
          </DetailLayout>
        </main>,
      )

    it('keeps the page menu and the related content in one rail, apart from the article', async () => {
      const { container } = renderWithMenu()

      const menu = screen.getByRole('navigation', { name: 'On this page' })
      const aside = screen.getByRole('complementary')
      const article = screen.getByText('The post').parentElement
      const rail = menu.closest('[data-detail-rail]')

      expect(rail).toBeTruthy()
      expect(rail?.contains(aside)).toBe(true)
      expect(rail?.contains(article)).toBe(false)
      await expectAccessible(container)
    })

    it('divides the page menu from the related content', () => {
      renderWithMenu()
      expect(screen.getByRole('complementary').className).toContain('border-t')
    })
  })

  it('draws no divider when there is no page menu to divide from', () => {
    render(
      <main>
        <DetailLayout aside={<p>Related content</p>}>
          <p>The post</p>
        </DetailLayout>
      </main>,
    )

    expect(screen.getByRole('complementary').className).not.toContain('border-t')
  })

  it('shows no empty rail when there is neither a page menu nor related content', () => {
    const { container } = render(
      <main>
        <DetailLayout aside={null}>
          <p>The post</p>
        </DetailLayout>
      </main>,
    )

    expect(container.querySelector('[data-detail-rail]')).toBeNull()
    expect(screen.queryByRole('complementary')).toBeNull()
  })
})
