// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Section } from './Section'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

describe('Section', () => {
  it('is a section in the page container, labelled by its heading (#439)', async () => {
    const { container } = render(
      <main>
        <Section aria-labelledby="news" tone="surface">
          <h2 id="news">News</h2>
        </Section>
      </main>,
    )

    const section = screen.getByRole('region', { name: 'News' })
    expect(section.className).toContain('bg-surface')
    expect(section.className).toContain('py-16')
    expect(section.firstElementChild?.className).toContain('container')
    await expectAccessible(container)
  })

  it('narrows its content for a form and centres a short page', () => {
    const { container } = render(
      <Section as="div" width="narrow" spacing="center">
        <p>Log in</p>
      </Section>,
    )

    const band = container.firstElementChild
    expect(band?.tagName).toBe('DIV')
    expect(band?.className).toContain('items-center')
    expect(screen.getByText('Log in').parentElement?.className).toContain('max-w-md')
  })

  // The call-to-action band (#457): the brand green in both modes, read as a dark scope
  it('scopes the brand band to the dark theme, and takes an anchor', async () => {
    const { container } = render(
      <Section id="block-cta" tone="brand" spacing="md">
        <p>Join us</p>
      </Section>,
    )

    const band = container.firstElementChild
    expect(band?.id).toBe('block-cta')
    expect(band?.getAttribute('data-theme')).toBe('dark')
    expect(band?.className).toContain('from-primary-fill')
    await expectAccessible(container)
  })

  it('leaves other bands in the page’s theme', () => {
    const { container } = render(
      <Section tone="surface" spacing="sm">
        <p>Cards</p>
      </Section>,
    )

    expect(container.firstElementChild?.hasAttribute('data-theme')).toBe(false)
    expect(container.firstElementChild?.className).toContain('py-8')
  })
})
