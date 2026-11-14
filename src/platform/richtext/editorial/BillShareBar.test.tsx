// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { BillShare } from './BillShare.client'
import { box, estimate, PROPS } from './billShareFixtures'

afterEach(cleanup)

const KEYS = {
  schools: 'Metropolitan Schools',
  city: 'City of Madison',
  county: 'Dane County',
  matc: 'Madison College, MATC',
} as Record<string, string>

describe('the whole bill: the rows and their bars (#1030, #1111, #1196)', () => {
  /** Each body's whole percent, by name, as the receipt's rows write it */
  const receiptPercents = (container: HTMLElement): Record<string, number> =>
    Object.fromEntries(
      Array.from(
        container.querySelectorAll('[data-share-bill] li[data-share-row]'),
        (li): [string, number] => {
          // name, percent, dollars (#1184)
          const [name = '', percent = ''] = Array.from(
            li.children,
            (child) => child.textContent ?? '',
          )
          return [name, Number.parseInt(percent, 10)]
        },
      ),
    )

  it('draws each slice’s bar in proportion to its share, on one scale, the same percents the receipt writes, for each year and a home estimated (#1196)', async () => {
    const { container } = render(<BillShare {...PROPS}>x</BillShare>)
    const same = () => {
      const receipt = receiptPercents(container)
      expect(Object.keys(receipt)).toHaveLength(4)
      const rects = Array.from(container.querySelectorAll<SVGRectElement>('rect[data-share-bar]'))
      expect(rects).toHaveLength(4)
      // the largest slice fills its track and each other bar is as long as its share is of the largest's
      const largest = Math.max(...Object.values(receipt))
      const widths = rects.map((rect) => Number.parseFloat(rect.getAttribute('width') ?? '0'))
      expect(Math.max(...widths)).toBeCloseTo(100, 1)
      for (const rect of rects) {
        const name = KEYS[rect.getAttribute('data-share-bar') ?? ''] ?? ''
        const width = Number.parseFloat(rect.getAttribute('width') ?? '0')
        // the percent is rounded to a whole number, the bar is not: allow the rounding
        expect(Math.abs(width - ((receipt[name] ?? -99) / largest) * 100)).toBeLessThan(5)
      }
      // and the list's label for screen readers says the same percents
      const label =
        screen
          .getByRole('list', { name: /^Your whole property tax bill:/ })
          .getAttribute('aria-label') ?? ''
      for (const [name, percent] of Object.entries(receipt)) {
        expect(label).toContain(`${name} $`)
        expect(label).toContain(`${percent}%`)
      }
    }
    same()
    fireEvent.click(screen.getByRole('button', { name: '2026' }))
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
      'Metropolitan Schools',
      'Dane County',
      'Madison College, MATC',
    ])
  })

  it('keeps the rows of the last bill while the typed value is not a number', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    fireEvent.change(box(), { target: { value: 'abc' } })
    screen.getByRole('list', { name: /^Your whole property tax bill:/ })
  })

  it('changes the City’s percent with the tax year chosen (#1068)', () => {
    const { container } = render(<BillShare {...PROPS}>x</BillShare>)
    const cityPercent = () => receiptPercents(container)['City of Madison']
    const proposed = cityPercent()
    fireEvent.click(screen.getByRole('button', { name: '2026' }))
    expect(cityPercent()).not.toBe(proposed)
    fireEvent.click(screen.getByRole('button', { name: '2027' }))
    expect(cityPercent()).toBe(proposed)
  })
})
