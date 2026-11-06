// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TOUCH_MIN_HEIGHT } from '@/platform/ui/layoutSizes'

import { LogoLink } from './Logo'

afterEach(cleanup)

describe('LogoLink (#741)', () => {
  it('links the name to the home page, as tall as a tap needs', () => {
    render(<LogoLink />)

    const link = screen.getByRole('link', { name: 'Sprecher East' })
    expect(link.getAttribute('href')).toBe('/')
    expect(link.className).toContain(TOUCH_MIN_HEIGHT)
    expect(link.className).toContain('items-center')
  })

  it('passes a click on, so the mobile menu can close', () => {
    const onClick = vi.fn()
    render(<LogoLink onClick={onClick} />)

    fireEvent.click(screen.getByRole('link'))

    expect(onClick).toHaveBeenCalledOnce()
  })
})
