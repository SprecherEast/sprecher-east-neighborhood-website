// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SegmentedControl } from './SegmentedControl'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const OPTIONS = [
  { key: 'a', label: '2026' },
  { key: 'b', label: '2027' },
]

describe('SegmentedControl', () => {
  it('is one named group of buttons, the picked one pressed', () => {
    render(
      <SegmentedControl
        label="Tax rates to use"
        options={OPTIONS}
        selected={1}
        onSelect={() => {}}
      />,
    )
    const group = screen.getByRole('group', { name: 'Tax rates to use' })
    expect(group.querySelectorAll('button')).toHaveLength(2)
    expect(screen.getByRole('button', { name: '2027' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '2026' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('is one joined box, 48 px tall, with the picked option filled with the accent', () => {
    render(<SegmentedControl label="Years" options={OPTIONS} selected={0} onSelect={() => {}} />)
    const group = screen.getByRole('group')
    expect(group.className).toContain('h-12')
    expect(group.className).toContain('border')
    expect(group.className).toContain('overflow-hidden')
    expect(screen.getByRole('button', { name: '2026' }).className).toContain('bg-accent')
    expect(screen.getByRole('button', { name: '2027' }).className).not.toContain('bg-accent')
  })

  it('reports the index of the option picked', () => {
    const onSelect = vi.fn()
    render(<SegmentedControl label="Years" options={OPTIONS} selected={1} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: '2026' }))
    expect(onSelect).toHaveBeenCalledWith(0)
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <SegmentedControl label="Years" options={OPTIONS} selected={0} onSelect={() => {}} />,
    )
    await expectAccessible(container)
  })
})
