// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, ...props }: ComponentProps<'a'>) => <a href={href} {...props} />,
}))

import type { ResolvedLink } from '@/platform/lib'

import { LinkButton } from './CMSLink'

afterEach(cleanup)

const link = (appearance: ResolvedLink['appearance']): ResolvedLink => ({
  href: '/contact',
  label: 'Contact Us',
  external: false,
  appearance,
})

describe('LinkButton', () => {
  it('draws the default look as the primary button', () => {
    render(<LinkButton link={link('default')} />)

    expect(screen.getByRole('link', { name: 'Contact Us' }).className).toContain('bg-primary-fill')
  })

  it('draws the outline look as the secondary button', () => {
    render(<LinkButton link={link('outline')} />)

    expect(screen.getByRole('link', { name: 'Contact Us' }).className).toContain('border-primary')
  })

  it('draws the accent look as the orange accent button, from the theme token', () => {
    render(<LinkButton link={link('accent')} />)

    const classes = screen.getByRole('link', { name: 'Contact Us' }).className
    expect(classes).toContain('bg-accent')
    expect(classes).toContain('text-accent-foreground')
    expect(classes).not.toMatch(/#[0-9a-f]{3,6}/i)
  })
})
