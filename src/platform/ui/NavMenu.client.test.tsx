// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NavMenu } from './NavMenu.client'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const items = [
  { href: '/resources/utilities', label: 'Neighborhood utilities' },
  { href: '/resources/government', label: 'Government', current: true },
]

const details = (container: HTMLElement) => container.querySelector('details') as HTMLDetailsElement

describe('NavMenu', () => {
  it('starts closed, with the label as its button and the links inside', () => {
    const { container } = render(<NavMenu label="Resources" items={items} />)

    expect(details(container).open).toBe(false)
    expect(screen.getByText('Resources').closest('summary')).toBeTruthy()
    expect(Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'))).toEqual([
      '/resources/utilities',
      '/resources/government',
    ])
  })

  it('opens and closes on a click of its label, never on hover', async () => {
    const user = userEvent.setup()
    const { container } = render(<NavMenu label="Resources" items={items} />)
    const label = screen.getByText('Resources')

    await user.hover(label)
    expect(details(container).open).toBe(false)

    await user.click(label)
    expect(details(container).open).toBe(true)

    await user.click(label)
    expect(details(container).open).toBe(false)
  })

  it('closes on Escape and gives focus back to its label', async () => {
    const user = userEvent.setup()
    const { container } = render(<NavMenu label="Resources" items={items} />)
    await user.click(screen.getByText('Resources'))

    await user.keyboard('{Escape}')

    expect(details(container).open).toBe(false)
    expect(document.activeElement).toBe(container.querySelector('summary'))
  })

  it('closes on a press outside it, and stays open on one inside', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <>
        <NavMenu label="Resources" items={items} />
        <p>Elsewhere</p>
      </>,
    )
    await user.click(screen.getByText('Resources'))

    fireEvent.pointerDown(screen.getByText('Neighborhood utilities'))
    expect(details(container).open).toBe(true)

    fireEvent.pointerDown(screen.getByText('Elsewhere'))
    expect(details(container).open).toBe(false)
  })

  it('closes when focus moves out of it by keyboard', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <>
        <NavMenu label="Resources" items={items} />
        <button type="button">Next</button>
      </>,
    )
    await user.click(screen.getByText('Resources'))

    screen.getByText('Next').focus()

    expect(details(container).open).toBe(false)
  })

  it('closes and tells the caller when a link is followed', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const { container } = render(
      <NavMenu label="Resources" items={items} onNavigate={onNavigate} />,
    )
    await user.click(screen.getByText('Resources'))

    await user.click(screen.getByText('Government'))

    expect(onNavigate).toHaveBeenCalledOnce()
    expect(details(container).open).toBe(false)
  })

  it('marks the current page link, and the label when the page is inside the menu', () => {
    const { container } = render(<NavMenu label="Resources" items={items} />)

    expect(screen.getByText('Government').closest('a')?.getAttribute('aria-current')).toBe('page')
    expect(container.querySelector('summary')?.getAttribute('data-current')).toBe('true')
  })

  it('has no accessibility violations, closed or open', async () => {
    const user = userEvent.setup()
    const { container } = render(<NavMenu label="Resources" items={items} />)
    await expectAccessible(container)

    await user.click(screen.getByText('Resources'))
    await expectAccessible(container)
  })
})
