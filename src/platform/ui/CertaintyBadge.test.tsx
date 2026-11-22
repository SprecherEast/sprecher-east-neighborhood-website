// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CERTAINTY_LABELS, CERTAINTIES } from '@/platform/lib/certainty'

import { CertaintyBadge } from './CertaintyBadge'

afterEach(cleanup)

describe('CertaintyBadge', () => {
  it.each(CERTAINTIES)('says %s in words, with a decorative icon', (certainty) => {
    const { container } = render(<CertaintyBadge certainty={certainty} />)
    expect(screen.getByText(CERTAINTY_LABELS[certainty])).toBeTruthy()
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('can write its own words in place of the certainty’s, keeping the look', () => {
    const { container } = render(<CertaintyBadge certainty="estimate" label="Proposed" />)
    expect(screen.getByText('Proposed').className).toContain('text-warning-strong')
    expect(screen.queryByText(CERTAINTY_LABELS.estimate)).toBeNull()
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('is a plain label until it is given something to do', () => {
    render(<CertaintyBadge certainty="estimate" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('becomes a button when it can say why, named by its words and what it does, and presses once', () => {
    const onPress = vi.fn()
    const { container } = render(<CertaintyBadge certainty="estimate" onPress={onPress} />)
    const button = screen.getByRole('button', { name: 'Estimate, what this means' })
    expect(button.getAttribute('type')).toBe('button')
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    fireEvent.click(button)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('keeps a button’s own words and look, and shows it can be pressed with a shadow that does not move for reduced motion', () => {
    render(<CertaintyBadge certainty="estimate" label="Proposed" onPress={() => {}} />)
    const button = screen.getByRole('button', { name: 'Proposed, what this means' })
    expect(button.className).toContain('text-warning-strong')
    expect(button.className).toContain('shadow-sm')
    expect(button.className).toContain('cursor-pointer')
    expect(button.className).toContain('motion-safe:hover:-translate-y-px')
    // The shadow stays small, also on hover, and the tap area reaches 44 px (the guideline)
    expect(button.className).not.toContain('shadow-md')
    expect(button.className).toContain('after:-inset-y-3')
  })
})
