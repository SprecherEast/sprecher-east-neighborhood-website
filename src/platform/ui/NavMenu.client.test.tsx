// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NavMenu } from './NavMenu.client'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const items = [
  { href: '/resources/utilities', label: 'Neighborhood utilities' },
  { href: '/resources/government', label: 'Government', current: true },
]

const hrefs = () => screen.getAllByRole('link').map((a) => a.getAttribute('href'))

describe('NavMenu on a wide screen', () => {
  it('starts closed, with the label as its button', () => {
    render(<NavMenu label="Resources" items={items} />)

    expect(screen.getByRole('button', { name: 'Resources' }).getAttribute('aria-expanded')).toBe(
      'false',
    )
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('opens on a click, never on hover, and shows its links', async () => {
    const user = userEvent.setup()
    render(<NavMenu label="Resources" items={items} />)
    const button = screen.getByRole('button', { name: 'Resources' })

    await user.hover(button)
    expect(screen.queryByRole('link')).toBeNull()

    await user.click(button)
    expect(hrefs()).toEqual(['/resources/utilities', '/resources/government'])
    expect(screen.getByRole('link', { name: 'Government' }).getAttribute('aria-current')).toBe(
      'page',
    )
  })

  it('animates only while open, so Radix can unmount it at once on Escape (#1277)', async () => {
    const user = userEvent.setup()
    render(<NavMenu label="Resources" items={items} />)

    await user.click(screen.getByRole('button', { name: 'Resources' }))
    const panel = screen.getByRole('dialog', { name: 'Resources' })

    // A slide that is always on would make Radix wait for an animation end that never comes when
    // the panel closes right after it opens
    expect(panel.className).toContain('data-[state=open]:nav-menu-slide')
    expect(panel.className.split(/\s+/)).not.toContain('nav-menu-slide')
  })

  it('closes on Escape and on a press outside it', async () => {
    const user = userEvent.setup()
    render(
      <>
        <NavMenu label="Resources" items={items} />
        <p>Elsewhere</p>
      </>,
    )
    const button = screen.getByRole('button', { name: 'Resources' })

    await user.click(button)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('link')).toBeNull()

    await user.click(button)
    await user.click(screen.getByText('Elsewhere'))
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('closes when a link is followed, and tells the caller', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<NavMenu label="Resources" items={items} onNavigate={onNavigate} />)

    await user.click(screen.getByRole('button', { name: 'Resources' }))
    await user.click(screen.getByRole('link', { name: 'Neighborhood utilities' }))

    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('has no accessibility violations, closed or open', async () => {
    const user = userEvent.setup()
    const { container } = render(<NavMenu label="Resources" items={items} />)
    await expectAccessible(container)

    await user.click(screen.getByRole('button', { name: 'Resources' }))
    await expectAccessible(document.body)
  })
})

describe('NavMenu stacked, in the mobile menu', () => {
  it('is an expandable row whose links are plain links', async () => {
    const user = userEvent.setup()
    const { container } = render(<NavMenu label="Resources" items={items} layout="stacked" />)
    const box = container.querySelector('details') as HTMLDetailsElement

    expect(box.open).toBe(false)
    await user.click(screen.getByText('Resources'))
    expect(box.open).toBe(true)
    expect(hrefs()).toEqual(['/resources/utilities', '/resources/government'])
  })

  it('tells the caller when a link is followed, and does nothing else to the box', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const { container } = render(
      <NavMenu label="Resources" items={items} layout="stacked" onNavigate={onNavigate} />,
    )
    await user.click(screen.getByText('Resources'))
    await user.click(screen.getByRole('link', { name: 'Government' }))

    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect((container.querySelector('details') as HTMLDetailsElement).open).toBe(true)
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<NavMenu label="Resources" items={items} layout="stacked" />)
    await expectAccessible(container)
  })
})
