// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ProgressBar } from './ProgressBar'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

describe('ProgressBar', () => {
  it('is a named progress bar with its value and its most', () => {
    render(<ProgressBar value={3} max={8} label="Launch: 3 of 8 done" />)
    const bar = screen.getByRole('progressbar', { name: 'Launch: 3 of 8 done' })
    expect(bar.getAttribute('value')).toBe('3')
    expect(bar.getAttribute('max')).toBe('8')
  })

  it('never shows more than full, or less than empty', () => {
    const { rerender } = render(<ProgressBar value={12} max={8} label="Over" />)
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('8')
    rerender(<ProgressBar value={-2} max={8} label="Under" />)
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('0')
  })

  it('shows an empty bar when there is nothing to count', () => {
    render(<ProgressBar value={0} max={0} label="Nothing yet" />)
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('value')).toBe('0')
    expect(Number(bar.getAttribute('max'))).toBeGreaterThan(0)
  })

  it('draws the track and the fill from theme tokens', () => {
    render(<ProgressBar value={1} max={2} label="Half" />)
    const classes = screen.getByRole('progressbar').className
    expect(classes).toContain('bg-muted')
    expect(classes).toContain('bg-primary-fill')
  })

  it('is accessible', async () => {
    const { container } = render(<ProgressBar value={1} max={2} label="Half" />)
    await expectAccessible(container)
  })
})
