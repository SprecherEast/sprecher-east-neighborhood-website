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
  canEstimate: true,
  onEstimate: () => {},
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
    const onSelect = vi.fn()
    render(<RoughEstimator {...PROPS} onValueChange={onValueChange} onSelect={onSelect} />)
    const box = screen.getByRole('textbox')
    fireEvent.change(box, { target: { value: '300000' } })
    expect(onValueChange).toHaveBeenCalledWith('$300,000')
    fireEvent.click(screen.getByRole('button', { name: '2026 rates' }))
    expect(onSelect).toHaveBeenCalledWith(0)
  })

  it('ends with a full-width Estimate button, below the box and the rate buttons', () => {
    render(<RoughEstimator {...PROPS} />)
    const estimate = screen.getByRole('button', { name: 'Estimate' })
    const others = [
      screen.getByRole('textbox'),
      screen.getByRole('button', { name: '2026 rates' }),
      screen.getByRole('button', { name: '2027 rates' }),
    ]
    for (const other of others) {
      expect(
        other.compareDocumentPosition(estimate) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    }
    expect(estimate.className).toContain('w-full')
  })

  it('turns the Estimate button off until there is a new value to estimate', () => {
    const { rerender } = render(<RoughEstimator {...PROPS} canEstimate={false} />)
    expect((screen.getByRole('button', { name: 'Estimate' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    rerender(<RoughEstimator {...PROPS} />)
    expect((screen.getByRole('button', { name: 'Estimate' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
  })

  it('estimates when the button is pressed and when Enter is pressed in the box', () => {
    const onEstimate = vi.fn()
    render(<RoughEstimator {...PROPS} onEstimate={onEstimate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Estimate' }))
    expect(onEstimate).toHaveBeenCalledTimes(1)
    fireEvent.submit(screen.getByRole('textbox').closest('form') as HTMLFormElement)
    expect(onEstimate).toHaveBeenCalledTimes(2)
  })

  it('does not estimate on Enter while there is nothing new to estimate', () => {
    const onEstimate = vi.fn()
    render(<RoughEstimator {...PROPS} canEstimate={false} onEstimate={onEstimate} />)
    fireEvent.submit(screen.getByRole('textbox').closest('form') as HTMLFormElement)
    expect(onEstimate).not.toHaveBeenCalled()
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

  it('writes a year’s note under its button in parentheses, and keeps the room when none has one', () => {
    const { container } = render(
      <RoughEstimator
        {...PROPS}
        options={[
          { key: '2026', label: '2026 rates' },
          { key: '2027', label: '2027 rates', note: 'proposed' },
        ]}
      />,
    )
    const note = screen.getByText('(proposed)')
    expect(note.closest('div')?.querySelector('button')?.textContent).toBe('2027 rates')
    // The button's own name stays the year's rates; the note is not part of it
    expect(screen.getByRole('button', { name: '2027 rates' })).toBeTruthy()
    const room = Array.from(container.querySelectorAll('[data-switch-note]'))
    expect(room).toHaveLength(2)
    expect(room[0]?.textContent).toBe('')
    expect(room[0]?.className).toBe(room[1]?.className)
    cleanup()
    const none = render(<RoughEstimator {...PROPS} />).container
    expect(none.querySelectorAll('[data-switch-note]')).toHaveLength(0)
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<RoughEstimator {...PROPS} />)
    await expectAccessible(container)
  })
})
