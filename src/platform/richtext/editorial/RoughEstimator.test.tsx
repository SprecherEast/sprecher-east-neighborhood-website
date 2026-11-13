// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { RoughEstimator, type RoughEstimatorProps } from './RoughEstimator'

afterEach(cleanup)

const PROPS: RoughEstimatorProps = {
  value: '$500,300',
  onValueChange: () => {},
  canEstimate: true,
  onEstimate: () => {},
  options: [
    { key: '2026', label: '2026' },
    { key: '2027', label: '2027' },
  ],
  selected: 1,
  onSelect: () => {},
}

describe('RoughEstimator', () => {
  it('is one compact card with the home value box and a button for each rate, and no title', () => {
    render(<RoughEstimator {...PROPS} />)
    expect(screen.queryByRole('heading', { name: 'Rough Estimator' })).toBeNull()
    // The card keeps its name for screen readers
    expect(screen.getByRole('region', { name: 'Rough Estimator' })).toBeTruthy()
    expect(
      (screen.getByRole('textbox', { name: 'Enter your assessed value' }) as HTMLInputElement)
        .value,
    ).toBe('$500,300')
    const group = screen.getByRole('group', { name: 'Tax rates' })
    expect(group.querySelectorAll('button')).toHaveLength(2)
    expect(screen.getByRole('button', { name: '2027' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '2026' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('draws neither an intro line nor notes: the tab shows them (#1111)', () => {
    const { container } = render(<RoughEstimator {...PROPS} />)
    expect(container.querySelector('ul')).toBeNull()
    expect(container.querySelectorAll('p')).toHaveLength(0)
  })

  it('reports what the reader types, leaves, and picks', () => {
    const onValueChange = vi.fn()
    const onSelect = vi.fn()
    render(<RoughEstimator {...PROPS} onValueChange={onValueChange} onSelect={onSelect} />)
    const box = screen.getByRole('textbox')
    fireEvent.change(box, { target: { value: '300000' } })
    expect(onValueChange).toHaveBeenCalledWith('$300,000')
    fireEvent.click(screen.getByRole('button', { name: '2026' }))
    expect(onSelect).toHaveBeenCalledWith(0)
  })

  it('puts a check-mark icon button inside the value box, ahead of the rate buttons (#1110)', () => {
    render(<RoughEstimator {...PROPS} />)
    const estimate = screen.getByRole('button', { name: 'Estimate' })
    const box = screen.getByRole('textbox')
    // One box holds the text and the button; the button has no visible words, only the icon
    const bar = box.closest('[data-field-bar]') as HTMLElement
    expect(bar.getAttribute('data-action-inside')).toBe('true')
    expect(bar.contains(estimate)).toBe(true)
    expect(estimate.textContent).toBe('')
    expect(estimate.querySelector('svg')).toBeTruthy()
    expect(estimate.className).not.toContain('w-full')
    for (const name of ['2026', '2027']) {
      const rate = screen.getByRole('button', { name })
      expect(estimate.compareDocumentPosition(rate) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('is flat and muted while there is nothing new to estimate, raised and accented once there is', () => {
    const { rerender } = render(<RoughEstimator {...PROPS} canEstimate={false} />)
    const button = () => screen.getByRole('button', { name: 'Estimate' }) as HTMLButtonElement
    // The `action` look draws both states from the disabled attribute: muted and flat when
    // disabled, accent and raised when enabled, the lift only with motion allowed
    expect(button().disabled).toBe(true)
    for (const look of [
      'bg-accent',
      'disabled:bg-muted',
      'enabled:shadow-md',
      'motion-safe:enabled:-translate-y-px',
    ]) {
      expect(button().className).toContain(look)
    }
    expect(button().className).not.toMatch(/(^|\s)(enabled:)?-translate-y-px/)
    rerender(<RoughEstimator {...PROPS} />)
    expect(button().disabled).toBe(false)
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

  it('draws the tax years as one joined control of the year numbers only, with no note under it (#1118)', () => {
    const { container } = render(<RoughEstimator {...PROPS} />)
    const group = screen.getByRole('group', { name: 'Tax rates' })
    expect(Array.from(group.querySelectorAll('button')).map((b) => b.textContent)).toEqual([
      '2026',
      '2027',
    ])
    // One box holds both options, so they read as one control
    expect(group.className).toContain('border')
    expect(container.querySelector('[data-switch-note]')).toBeNull()
  })

  it('keeps the control on the row of the value box, never larger than the box, under a "Tax rates" label that names it (#1118)', () => {
    render(<RoughEstimator {...PROPS} />)
    const row = screen.getByRole('textbox').closest('[data-estimator-row]') as HTMLElement
    const group = screen.getByRole('group', { name: 'Tax rates' })
    expect(row.contains(group)).toBe(true)
    expect(group.className).toContain('h-9')
    expect(group.className).not.toContain('h-12')
    // The visible label names the group, and sits beside the value box's own label
    const label = screen.getByText('Tax rates')
    expect(group.getAttribute('aria-labelledby')).toBe(label.id)
    // It is written like the box's label (same size and weight), centred over the control (#1121)
    for (const look of ['text-sm', 'font-medium', '@[20rem]:text-base', 'text-center']) {
      expect(label.className).toContain(look)
    }
    expect(label.className).not.toContain('text-right')
    expect(group.className).toContain('@[16rem]:justify-self-center')
    const box = screen.getByText('Enter your assessed value')
    expect(box.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<RoughEstimator {...PROPS} />)
    await expectAccessible(container)
  })
})
