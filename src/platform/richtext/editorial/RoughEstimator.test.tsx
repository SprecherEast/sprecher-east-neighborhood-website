// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { RoughEstimator, type RoughEstimatorProps } from './RoughEstimator'

afterEach(cleanup)

const PROPS: RoughEstimatorProps = {
  intro: 'Based on the City’s average home.',
  value: '$500,300',
  onValueChange: () => {},
  onValueBlur: () => {},
  options: [
    { key: '2026', label: '2026 rates' },
    { key: '2027', label: '2027 rates' },
  ],
  selected: 1,
  onSelect: () => {},
  notes: [
    { key: 'rough', text: 'A rough estimate: every bill differs.', shown: true },
    { key: 'unconfirmed', text: '2027 rates are not confirmed.', shown: true },
  ],
}

describe('RoughEstimator', () => {
  it('is one card titled Rough Estimator, with the home value box and a button for each rate', () => {
    render(<RoughEstimator {...PROPS} />)
    expect(screen.getByRole('heading', { name: 'Rough Estimator' })).toBeTruthy()
    expect((screen.getByRole('textbox', { name: /home’s value/i }) as HTMLInputElement).value).toBe(
      '$500,300',
    )
    const group = screen.getByRole('group', { name: /tax rates/i })
    expect(group.querySelectorAll('button')).toHaveLength(2)
    expect(screen.getByRole('button', { name: '2027 rates' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByRole('button', { name: '2026 rates' }).getAttribute('aria-pressed')).toBe(
      'false',
    )
  })

  it('reports what the reader types, leaves, and picks', () => {
    const onValueChange = vi.fn()
    const onValueBlur = vi.fn()
    const onSelect = vi.fn()
    render(
      <RoughEstimator
        {...PROPS}
        onValueChange={onValueChange}
        onValueBlur={onValueBlur}
        onSelect={onSelect}
      />,
    )
    const box = screen.getByRole('textbox')
    fireEvent.change(box, { target: { value: '300000' } })
    expect(onValueChange).toHaveBeenCalledWith('300000')
    fireEvent.blur(box)
    expect(onValueBlur).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '2026 rates' }))
    expect(onSelect).toHaveBeenCalledWith(0)
  })

  it('shows the error under the box and marks the box invalid', () => {
    render(<RoughEstimator {...PROPS} error="Enter your home’s value as a number." />)
    expect(screen.getByText(/enter your home’s value/i)).toBeTruthy()
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true')
  })

  it('keeps the room of a note that is not showing, hidden from everyone, so nothing moves when it shows', () => {
    const { rerender } = render(
      <RoughEstimator
        {...PROPS}
        notes={PROPS.notes.map((note, i) => ({ ...note, shown: i === 0 }))}
      />,
    )
    const hidden = screen.getByText('2027 rates are not confirmed.').closest('li')
    expect(hidden?.className).toContain('invisible')
    expect(hidden?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByText(/every bill differs/).closest('li')?.className).not.toContain(
      'invisible',
    )
    rerender(<RoughEstimator {...PROPS} />)
    const shown = screen.getByText('2027 rates are not confirmed.').closest('li')
    expect(shown?.className).not.toContain('invisible')
    expect(shown?.getAttribute('aria-hidden')).toBeNull()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<RoughEstimator {...PROPS} />)
    await expectAccessible(container)
  })
})
