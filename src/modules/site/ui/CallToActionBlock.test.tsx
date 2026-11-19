// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { CallToActionBlock } from './CallToActionBlock'
import { doc, heading, link, paragraph, text } from './testing/richText'

afterEach(cleanup)

const body = doc(heading('h2', 'Get involved'), paragraph(text('Read the '), link('/faq', 'FAQ')))

const links = [
  { href: '/get-involved', label: 'Join us', external: false, appearance: 'default' as const },
  { href: 'https://example.com', label: 'Donate', external: true, appearance: 'default' as const },
]

describe('CallToActionBlock', () => {
  it('draws its text and a white button, then an outlined one, on the brand band', async () => {
    const { container } = render(
      <main>
        <CallToActionBlock body={body} links={links} />
      </main>,
    )

    expect(screen.getByRole('heading', { name: 'Get involved' })).toBeTruthy()
    const join = screen.getByRole('link', { name: 'Join us' })
    expect(join.getAttribute('href')).toBe('/get-involved')
    expect(join.className).toContain('bg-primary-foreground')
    const donate = screen.getByRole('link', { name: 'Donate, opens in a new tab' })
    expect(donate.className).toContain('border-primary-foreground')
    expect(container.querySelector('[data-theme="dark"]')?.className).toContain('from-primary-fill')
    await expectAccessible(container)
  })

  // The band is the brand green in both modes, so the theme's link colour (made for page
  // backgrounds) would fail contrast on it (#401)
  it('makes links in its text the band text colour', () => {
    render(<CallToActionBlock body={body} links={[]} />)

    const prose = screen.getByRole('link', { name: 'FAQ' }).closest('.prose')
    expect(prose?.className).toContain('[&_a]:text-primary-foreground')
    // And the focus outline, as the theme's green outline is under 3:1 on the band
    expect(prose?.className).toContain('[&_a:focus-visible]:outline-primary-foreground')
  })

  it('draws no button row without links', () => {
    render(<CallToActionBlock links={[]} />)

    expect(screen.queryByRole('link')).toBeNull()
  })
})
