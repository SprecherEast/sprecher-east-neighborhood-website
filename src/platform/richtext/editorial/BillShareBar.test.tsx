// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { BillShare } from './BillShare.client'
import { box, estimate, PROPS } from './billShareFixtures'

afterEach(cleanup)

const KEYS = {
  schools: 'Madison schools',
  city: 'City of Madison',
  county: 'Dane County',
  matc: 'Madison College (MATC)',
} as Record<string, string>

describe('the whole bill: the bar and the receipt (#1030, #1111)', () => {
  /** Each body's whole percent, by name, as the receipt's rows write it */
  const receiptPercents = (container: HTMLElement): Record<string, number> =>
    Object.fromEntries(
      Array.from(container.querySelectorAll('[data-share-bill] li'), (li): [string, number] => {
        const [name = '', percent = ''] = Array.from(
          li.children,
          (child) => child.textContent ?? '',
        )
        return [name, Number.parseInt(percent, 10)]
      }),
    )

  it('draws each slice as wide as its share, the same shares the receipt writes, for each year and a home estimated', async () => {
    const { container } = render(<BillShare {...PROPS}>x</BillShare>)
    const same = () => {
      const receipt = receiptPercents(container)
      expect(Object.keys(receipt)).toHaveLength(4)
      const rects = Array.from(container.querySelectorAll<SVGRectElement>('rect[data-share-slice]'))
      expect(rects).toHaveLength(4)
      // each slice is as wide as its exact share: within a point of the whole percent written
      for (const rect of rects) {
        const name = KEYS[rect.getAttribute('data-share-slice') ?? ''] ?? ''
        const width = Number.parseFloat(rect.getAttribute('width') ?? '0')
        expect(Math.abs(width - (receipt[name] ?? -9))).toBeLessThan(1)
      }
      // and the bar's label for screen readers says the same percents
      const label =
        screen
          .getByRole('img', { name: /^Your whole property tax bill:/ })
          .getAttribute('aria-label') ?? ''
      for (const [name, percent] of Object.entries(receipt)) {
        expect(label).toContain(`${name} $`)
        expect(label).toContain(`${percent}%`)
      }
    }
    same()
    fireEvent.click(screen.getByRole('button', { name: /2026 rates/ }))
    same()
    await estimate('$900,000')
    same()
  })

  it('names every slice in the receipt, so no slice is told by its color alone', () => {
    const { container } = render(<BillShare {...PROPS}>x</BillShare>)
    const names = Array.from(container.querySelectorAll('[data-share-bill] li')).map(
      (li) => li.children[0]?.textContent,
    )
    expect(names).toEqual([
      'City of Madison',
      'Madison schools',
      'Dane County',
      'Madison College (MATC)',
    ])
  })

  it('keeps the bar of the last bill while the typed value is not a number', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    fireEvent.change(box(), { target: { value: 'abc' } })
    screen.getByRole('img', { name: /^Your whole property tax bill:/ })
  })

  it('changes the City’s percent with the tax year chosen (#1068)', () => {
    const { container } = render(<BillShare {...PROPS}>x</BillShare>)
    const cityPercent = () => receiptPercents(container)['City of Madison']
    const proposed = cityPercent()
    fireEvent.click(screen.getByRole('button', { name: /2026 rates/ }))
    expect(cityPercent()).not.toBe(proposed)
    fireEvent.click(screen.getByRole('button', { name: /2027 rates/ }))
    expect(cityPercent()).toBe(proposed)
  })
})
