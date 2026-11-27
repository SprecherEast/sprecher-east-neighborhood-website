// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { ChangeFigure, type ChangeFigureProps } from './ChangeFigure'

afterEach(cleanup)

const props = (change: Partial<ChangeFigureProps['change']> = {}): ChangeFigureProps => ({
  label: '2027 adopted',
  value: '$477.7M',
  change: {
    direction: 'up',
    amount: '+$25.0M',
    percent: '+5.5%',
    since: '2026 adopted',
    ...change,
  },
})

describe('ChangeFigure', () => {
  it('shows the label, the figure, the signed change and what it is measured from', () => {
    const { container } = render(<ChangeFigure {...props()} />)
    expect(container.textContent).toContain('2027 adopted')
    expect(container.textContent).toContain('$477.7M')
    expect(container.textContent).toContain('+$25.0M (+5.5%)')
    expect(container.textContent).toContain('from 2026 adopted')
  })

  it('says the direction in words for a screen reader, and draws the arrow as decoration', () => {
    const { container } = render(<ChangeFigure {...props()} />)
    expect(screen.getByText(/^Up:/).className).toContain('sr-only')
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it.each([
    ['down', 'Down'],
    ['same', 'No change'],
  ] as const)(
    'says %s too, so the sign is never only a colour or an arrow',
    (direction, spoken) => {
      render(
        <ChangeFigure {...props({ direction, amount: direction === 'down' ? '−$3.4M' : '$0' })} />,
      )
      expect(screen.getByText(new RegExp(`^${spoken}:`))).toBeTruthy()
    },
  )

  it('leaves the percent out when there is none', () => {
    const { container } = render(<ChangeFigure {...props({ percent: null })} />)
    expect(container.textContent).toContain('+$25.0M')
    expect(container.textContent).not.toContain('(')
  })

  it('uses no colour of its own beyond the text tokens, and no inline style', () => {
    const { container } = render(<ChangeFigure {...props()} />)
    expect(container.innerHTML).not.toMatch(/style=|#[0-9a-f]{3,6}\b|text-(red|green)-/i)
  })

  it('passes axe', async () => {
    const { container } = render(<ChangeFigure {...props()} />)
    await expectAccessible(container)
  })
})
