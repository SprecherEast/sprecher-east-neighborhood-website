// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { AmountBar, type AmountBarPart } from './AmountBar'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const PARTS: AmountBarPart[] = [
  { key: 'same', label: 'Same as 2026', value: 1350, amount: '$1,350' },
  { key: 'more', label: 'Proposed increase', value: 36, amount: '+$36', hatch: true },
]

describe('AmountBar', () => {
  it('names the year and the whole amount, then each part with its amount', () => {
    render(<AmountBar title="2027 proposed" total="$1,386" parts={PARTS} />)
    expect(screen.getByText('2027 proposed')).toBeTruthy()
    expect(screen.getByText('$1,386')).toBeTruthy()
    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toEqual(['Same as 2026$1,350', 'Proposed increase+$36'])
  })

  it('draws each part as wide as its share of the whole, the increase hatched', () => {
    const { container } = render(<AmountBar title="t" total="$1,386" parts={PARTS} />)
    const marks = Array.from(container.querySelectorAll<SVGRectElement>('rect[data-amount-part]'))
    expect(marks.map((m) => m.getAttribute('data-amount-part'))).toEqual(['same', 'more'])
    expect(marks.map((m) => m.getAttribute('x'))).toEqual(['0%', '97.403%'])
    expect(marks.map((m) => m.getAttribute('width'))).toEqual(['97.403%', '2.597%'])
    expect(container.querySelectorAll('rect[data-amount-hatch]')).toHaveLength(1)
  })

  it('is one picture for screen readers that says what it shows', () => {
    render(<AmountBar title="2027 proposed" total="$1,386" parts={PARTS} />)
    expect(
      screen.getByRole('img', {
        name: '2027 proposed: $1,386, made up of Same as 2026 $1,350 and Proposed increase +$36',
      }),
    ).toBeTruthy()
  })

  it('draws a single part when nothing is added, with no hatch', () => {
    const { container } = render(
      <AmountBar title="2026 adopted" total="$1,350" parts={PARTS.slice(0, 1)} />,
    )
    expect(container.querySelectorAll('rect[data-amount-part]')).toHaveLength(1)
    expect(container.querySelector('rect[data-amount-hatch]')).toBeNull()
    // One part has nothing to be told apart from, so there is no key
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('draws an empty track when every part is zero', () => {
    const { container } = render(
      <AmountBar title="t" total="$0" parts={[{ key: 'a', label: 'A', value: 0, amount: '$0' }]} />,
    )
    expect(container.querySelector('rect[data-amount-part]')?.getAttribute('width')).toBe('0%')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<AmountBar title="2027 proposed" total="$1,386" parts={PARTS} />)
    await expectAccessible(container)
  })
})
