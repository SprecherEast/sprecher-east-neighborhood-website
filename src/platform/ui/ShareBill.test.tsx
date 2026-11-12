// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ShareBill, type ShareSlice } from './ShareBill'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const SLICES: ShareSlice[] = [
  {
    key: 'a',
    name: 'Sample: first',
    amount: '$3,750',
    percent: 38,
    share: 37.5,
    tone: 'highlight',
  },
  { key: 'b', name: 'Sample: second', amount: '$4,650', percent: 46, share: 46.5, tone: 'light' },
  { key: 'c', name: 'Sample: third', amount: '$1,250', percent: 13, share: 12.5, tone: 'medium' },
  { key: 'd', name: 'Sample: fourth', amount: '$350', percent: 3, share: 3.5, tone: 'strong' },
]
const TOTAL = { label: 'Total', amount: '$10,000' }

describe('ShareBill', () => {
  it('draws the total, then the bar, then the receipt', () => {
    const { container } = render(<ShareBill slices={SLICES} label="Sample bill" total={TOTAL} />)
    const total = screen.getByText('Total')
    const bar = screen.getByRole('img', { name: 'Sample bill' })
    const list = container.querySelector('ul') as HTMLElement
    const follows = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(follows(total, bar)).toBe(true)
    expect(follows(bar, list)).toBe(true)
  })

  it('names every slice in the receipt with its percent and dollars, in the bar’s order', () => {
    const { container } = render(<ShareBill slices={SLICES} label="Sample bill" total={TOTAL} />)
    const rows = Array.from(container.querySelectorAll('li')).map((li) => li.textContent)
    expect(rows).toEqual([
      'Sample: first38%$3,750',
      'Sample: second46%$4,650',
      'Sample: third13%$1,250',
      'Sample: fourth3%$350',
    ])
    const bar = Array.from(container.querySelectorAll('rect[data-share-slice]')).map((rect) =>
      rect.getAttribute('data-share-slice'),
    )
    expect(bar).toEqual(['a', 'b', 'c', 'd'])
  })

  it('flashes the total only once a pulse has been asked for', () => {
    const { rerender } = render(<ShareBill slices={SLICES} label="Sample bill" total={TOTAL} />)
    const flashes = () => screen.getByText('Total').closest('p')?.className.includes('total-pulse')
    expect(flashes()).toBe(false)
    rerender(<ShareBill slices={SLICES} label="Sample bill" total={TOTAL} pulseKey={1} />)
    expect(flashes()).toBe(true)
  })

  it('draws no total line without one, and has no accessibility violations', async () => {
    const { container } = render(<ShareBill slices={SLICES} label="Sample bill" />)
    expect(container.querySelector('p')).toBeNull()
    await expectAccessible(container)
  })
})
