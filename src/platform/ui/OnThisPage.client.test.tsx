// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DetailLayout } from './DetailLayout'
import { OnThisPage } from './OnThisPage.client'
import { currentSectionId, readingLine, type OnThisPageSection } from './onThisPage'
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

describe('readingLine', () => {
  it('sits a little below where a jump to a heading lands (its scroll margin)', () => {
    expect(readingLine('96px')).toBe(112)
  })

  it('has no offset to add when the browser gives no scroll margin', () => {
    expect(readingLine('')).toBe(16)
    expect(readingLine('auto')).toBe(16)
  })
})

describe('OnThisPage highlight', () => {
  it('highlights the section whose heading sits at the line a jump lands on', () => {
    const heading = (id: string, top: number) => {
      const el = document.createElement('h2')
      el.id = id
      el.getBoundingClientRect = () => ({ top }) as DOMRect
      document.body.append(el)
      return el
    }
    const headings = [
      heading('short-version', -300),
      heading('who-gains', 100),
      heading('money', 900),
    ]
    const real = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) =>
      el.tagName === 'H2' ? ({ scrollMarginTop: '96px' } as CSSStyleDeclaration) : real(el),
    )

    render(<OnThisPage sections={SECTIONS} />)

    const current = document.querySelectorAll('nav a[aria-current="location"]')
    expect([...current].map((link) => link.textContent)).toContain('Who gains')
    headings.forEach((el) => el.remove())
    vi.restoreAllMocks()
  })

  it('follows a heading that a live preview replaced with another element of the same id', () => {
    const heading = (tag: string, id: string, top: number) => {
      const el = document.createElement(tag)
      el.id = id
      el.getBoundingClientRect = () => ({ top }) as DOMRect
      document.body.append(el)
      return el
    }
    heading('h2', 'short-version', -300)
    const old = heading('h2', 'who-gains', 300)
    heading('h2', 'money', 900)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    render(<OnThisPage sections={SECTIONS} />)
    expect(document.querySelector('nav a[aria-current="location"]')?.textContent).toBe(
      'The short version',
    )

    old.remove()
    heading('h3', 'who-gains', 0)
    fireEvent.scroll(window)

    expect(document.querySelector('nav a[aria-current="location"]')?.textContent).toBe('Who gains')
    document.querySelectorAll('h2, h3').forEach((el) => el.remove())
    vi.restoreAllMocks()
  })
})
