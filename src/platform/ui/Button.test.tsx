// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Home } from 'lucide-react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// next/link renders a plain <a> in tests (no router), so mark it to tell the two apart
vi.mock('next/link', () => ({
  default: ({ href, ...props }: ComponentProps<'a'>) => <a data-next-link href={href} {...props} />,
}))

import { Button } from './Button'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

describe('Button', () => {
  it('is a button that does not submit forms unless asked', () => {
    render(<Button>Save</Button>)

    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('type', 'button')
  })

  it('submits when given type="submit"', async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault())
    render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
        <Button type="submit">Send</Button>
      </form>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('renders a link when given href', () => {
    render(<Button href="/contact">Contact us</Button>)

    expect(screen.getByRole('link', { name: 'Contact us' }).getAttribute('href')).toBe('/contact')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('opens an external link in a new tab and says so', () => {
    render(
      <Button href="https://example.com/calendar" external>
        City calendar
      </Button>,
    )

    const link = screen.getByRole('link', { name: 'City calendar, opens in a new tab' })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('while loading, is busy, ignores clicks and keeps focus', async () => {
    const onClick = vi.fn()
    const onSubmit = vi.fn()
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" loading onClick={onClick}>
          Sending
        </Button>
      </form>,
    )

    const button = screen.getByRole('button', { name: 'Sending' })
    await userEvent.click(button)

    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(document.activeElement).toBe(button)
    expect(onClick).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('as a loading link, does not navigate', async () => {
    const onClick = vi.fn()
    render(
      <Button href="/events?page=2" loading onClick={onClick}>
        Load more events
      </Button>,
    )

    const link = screen.getByRole('link', { name: 'Load more events' })
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('leaves an in-page link to the browser, so focus moves to the target', () => {
    render(<Button href="#main-content">Skip to content</Button>)

    const link = screen.getByRole('link', { name: 'Skip to content' })
    expect(link.getAttribute('href')).toBe('#main-content')
    expect(link.hasAttribute('data-next-link')).toBe(false)
  })

  it('routes other links through next/link', () => {
    render(<Button href="/contact">Contact us</Button>)

    expect(screen.getByRole('link').hasAttribute('data-next-link')).toBe(true)
  })

  it('keeps its own classes after a caller adds one', () => {
    render(<Button className="mt-4">Save</Button>)

    expect(screen.getByRole('button').className).toContain('mt-4')
    expect(screen.getByRole('button').className).toContain('bg-primary-fill')
  })

  it('has no accessibility violations in any variant, as a button or a link', async () => {
    const { container } = render(
      <>
        {(
          [
            'primary',
            'secondary',
            'accent',
            'accent-outline',
            'action',
            'ghost',
            'inverse',
            'inverse-outline',
          ] as const
        ).map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
        <Button size="icon" aria-label="Go home" iconStart={<Home aria-hidden="true" />} />
        <Button href="/" iconStart={<Home aria-hidden="true" />}>
          Go home
        </Button>
        <Button loading>Sending</Button>
      </>,
    )

    await expectAccessible(container)
  })

  it('draws a small icon button whose tap area is still the touch size (#1110)', () => {
    render(<Button size="icon-sm" aria-label="Go" iconStart={<Home aria-hidden="true" />} />)
    const button = screen.getByRole('button', { name: 'Go' })
    // 36 px drawn, grown to 44 px around it by an invisible area, so it is easy to tap
    expect(button.className).toContain('size-9')
    expect(button.className).toContain('after:-inset-1')
  })
})
