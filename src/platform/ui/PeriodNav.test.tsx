// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PeriodNav, type PeriodNavProps } from './PeriodNav'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const props = (over: Partial<PeriodNavProps> = {}): PeriodNavProps => ({
  title: 'October 2026',
  previousLabel: 'Earlier month',
  nextLabel: 'Later month',
  onPrevious: () => {},
  onNext: () => {},
  ...over,
})

describe('PeriodNav', () => {
  it('shows the title between two named buttons', () => {
    render(<PeriodNav {...props()} />)
    expect(screen.getByText('October 2026')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Earlier month' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Later month' })).toBeTruthy()
  })

  it('calls the matching handler for each button', () => {
    const onPrevious = vi.fn()
    const onNext = vi.fn()
    render(<PeriodNav {...props({ onPrevious, onNext })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Earlier month' }))
    fireEvent.click(screen.getByRole('button', { name: 'Later month' }))
    expect(onPrevious).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('marks a direction that cannot go on, keeps it focusable and ignores a press', () => {
    const onPrevious = vi.fn()
    render(<PeriodNav {...props({ previousDisabled: true, onPrevious })} />)
    const previous = screen.getByRole('button', { name: 'Earlier month' }) as HTMLButtonElement
    expect(previous.getAttribute('aria-disabled')).toBe('true')
    expect(previous.disabled).toBe(false)
    previous.focus()
    fireEvent.click(previous)
    expect(onPrevious).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(previous)
    expect(
      screen.getByRole('button', { name: 'Later month' }).getAttribute('aria-disabled'),
    ).toBeNull()
  })

  it('announces a change of title politely', () => {
    render(<PeriodNav {...props()} />)
    expect(screen.getByText('October 2026').closest('[aria-live]')?.getAttribute('aria-live')).toBe(
      'polite',
    )
  })

  it('has no axe violations', async () => {
    const { container } = render(<PeriodNav {...props({ nextDisabled: true })} />)
    await expectAccessible(container)
  })
})
