// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { DetailLayout } from './DetailLayout'
import { OnThisPage } from './OnThisPage.client'
import { currentSectionId, type OnThisPageSection } from './onThisPage'
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

describe('currentSectionId', () => {
  const tops = (...values: number[]) => values.map((top, i) => ({ id: `s${i}`, top }))

  it('is the last heading at or above the reading line', () => {
    expect(currentSectionId(tops(-400, -50, 120, 600), 160)).toBe('s2')
  })

  it('goes back to the earlier section when scrolling up', () => {
    expect(currentSectionId(tops(-900, -300, 400, 900), 160)).toBe('s1')
  })

  it('is null before the first heading reaches the line', () => {
    expect(currentSectionId(tops(300, 700), 160)).toBeNull()
  })

  it('counts a heading that a jump just placed at the line', () => {
    expect(currentSectionId(tops(-700, 96), 160)).toBe('s1')
  })
})
