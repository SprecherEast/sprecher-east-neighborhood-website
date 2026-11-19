// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { HeatMap } from './HeatMap'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const days = ['2026-11-11', '2026-11-12', '2026-11-13']
const marks = (c: HTMLElement) => [...c.querySelectorAll('[data-heat-selected]')]

const renderMap = (selected: string[], enabled?: string[]) =>
  render(
    <HeatMap
      variant="week"
      days={days}
      values={[5, 5, 5]}
      label="x"
      selection={{ selected, enabled, onToggle: vi.fn() }}
    />,
  )

describe('a chosen day on a heat map', () => {
  it('shows a check mark and a ring set off from its shade, so it reads on the darkest square', () => {
    const { container } = renderMap(['2026-11-12'])
    expect(marks(container)).toHaveLength(1)
    const pressed = container.querySelector('[aria-pressed="true"]') as HTMLElement
    expect(pressed.contains(marks(container)[0])).toBe(true)
    expect(pressed.className).toContain('ring-2')
    expect(pressed.className).toContain('ring-offset-1')
  })

  it('shows nothing extra on a day that is not chosen, and adds it when the day is chosen', () => {
    const { container, rerender } = renderMap([])
    expect(marks(container)).toHaveLength(0)
    expect(container.querySelector('[aria-pressed="true"]')).toBeNull()
    rerender(
      <HeatMap
        variant="week"
        days={days}
        values={[5, 5, 5]}
        label="x"
        selection={{ selected: ['2026-11-11'], onToggle: vi.fn() }}
      />,
    )
    expect(marks(container)).toHaveLength(1)
  })

  it('looks the same when the level above fixes it, even though it cannot be pressed', () => {
    const { container } = renderMap(['2026-11-12'], ['2026-11-13'])
    const fixed = container.querySelector('[aria-pressed="true"]') as HTMLButtonElement
    expect(fixed.disabled).toBe(true)
    expect(fixed.contains(marks(container)[0])).toBe(true)
  })

  it('does not mark an unavailable day', () => {
    const { container } = renderMap([], ['2026-11-13'])
    expect(marks(container)).toHaveLength(0)
  })

  it('leaves the ring of a map that only reads (today) without a check', () => {
    const { container } = render(
      <HeatMap variant="week" days={days} values={[1, 2, 3]} label="x" />,
    )
    expect(marks(container)).toHaveLength(0)
    expect(container.querySelector('[data-heat-cell].ring-2')).not.toBeNull()
  })

  it('keeps the mark out of the spoken name and has no axe violations', async () => {
    const { container } = renderMap(['2026-11-12'])
    const pressed = container.querySelector('[aria-pressed="true"]') as HTMLElement
    expect(pressed.getAttribute('aria-label')).toMatch(/^Thu, Nov 12: 5$/)
    expect(marks(container)[0].getAttribute('aria-hidden')).toBe('true')
    fireEvent.click(pressed)
    await expectAccessible(container)
  })
})
