// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { DetailLayout } from './DetailLayout'
import { OnThisPage } from './OnThisPage.client'
import type { OnThisPageSection } from './onThisPage'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const SECTIONS: OnThisPageSection[] = [
  { id: 'short-version', text: 'The short version', level: 2 },
  { id: 'who-gains', text: 'Who gains', level: 3 },
  { id: 'money', text: 'Money', level: 2 },
]

describe('OnThisPage', () => {
  it('lists every section as a link to its heading, in a navigation named On this page', async () => {
    const { container } = render(
      <main>
        <OnThisPage sections={SECTIONS} />
      </main>,
    )

    expect(screen.getByRole('navigation', { name: 'On this page' })).toBeTruthy()
    // The phone menu and the rail both list them; CSS shows one
    const links = screen.getAllByRole('link', { name: 'Who gains' })
    expect(links[0]?.getAttribute('href')).toBe('#who-gains')
    await expectAccessible(container)
  })

  it('shows nothing for fewer than three sections', () => {
    const { container } = render(<OnThisPage sections={SECTIONS.slice(0, 2)} />)
    expect(container.innerHTML).toBe('')
  })

  it('closes the phone menu when a section is chosen', () => {
    const { container } = render(<OnThisPage sections={SECTIONS} />)
    const details = container.querySelector('details') as HTMLDetailsElement
    details.setAttribute('open', '')

    fireEvent.click(details.querySelector('a') as HTMLAnchorElement)

    expect(details.hasAttribute('open')).toBe(false)
  })
})

describe('DetailLayout with a toc', () => {
  it('puts the aside below the article and keeps the menu out of it', () => {
    const { container } = render(
      <DetailLayout toc={<OnThisPage sections={SECTIONS} />} aside={<p>Upcoming events</p>}>
        <p>The post</p>
      </DetailLayout>,
    )
    const aside = screen.getByRole('complementary')
    expect(aside.className).not.toContain('sticky')
    expect(aside.querySelector('nav')).toBeNull()
    expect(container.textContent).toContain('The post')
  })
})
