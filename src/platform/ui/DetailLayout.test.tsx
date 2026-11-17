// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { DetailLayout } from './DetailLayout'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

describe('DetailLayout', () => {
  it('puts the related content in an aside beside the content (#434)', async () => {
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

    it('moves the related content below the article on small screens', () => {
      renderWithMenu()
      // The rail comes first in the markup: `order` is what puts the article before the aside
      expect(screen.getByRole('complementary').className).toContain('max-lg:order-3')
      expect(screen.getByText('The post').parentElement?.className).toContain('max-lg:order-2')
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

  // Over a backdrop (#1268) each block of the rail sits on a text plate, except the glass, which
  // keeps the photo behind it; the plates take the rail's small room, so they stay inside it
  it('puts every block of the related content on a text plate except a glass panel', () => {
    render(
      <DetailLayout aside={<p>Upcoming events</p>}>
        <p>The post</p>
      </DetailLayout>,
    )

    const aside = screen.getByRole('complementary')
    expect(aside.className).toContain('[&>:not([data-glass-panel])]:lg:text-plate')
  })

  it('keeps the plates inside the rail’s small room, which scrolls and would clip them', () => {
    const { container } = render(
      <DetailLayout aside={<p>Upcoming events</p>}>
        <p>The post</p>
      </DetailLayout>,
    )

    expect(container.querySelector('[data-detail-rail]')?.className).toContain(
      '[--plate-bleed:0.25rem]',
    )
  })

  it('lets the divider vanish over a backdrop, where the plates already set the blocks apart', () => {
    render(
      <DetailLayout toc={<nav>Menu</nav>} aside={<p>Upcoming events</p>}>
        <p>The post</p>
      </DetailLayout>,
    )

    expect(screen.getByRole('complementary').className).toContain('on-photo:lg:border-transparent')
  })

  it('sits the article column on a text plate', () => {
    render(
      <DetailLayout aside={null}>
        <p>The post</p>
      </DetailLayout>,
    )

    expect(screen.getByText('The post').parentElement?.className).toContain('lg:text-plate')
  })
})
