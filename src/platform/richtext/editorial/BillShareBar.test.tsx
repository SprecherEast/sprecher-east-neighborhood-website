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
  matc: 'Madison College (MATC)',
} as Record<string, string>

describe('the whole bill: the bar and the receipt (#1030, #1111)', () => {
  /** Each body's whole percent, by name, as the receipt's rows write it */
  const receiptPercents = (container: HTMLElement): Record<string, number> =>
    Object.fromEntries(
      Array.from(
        container.querySelectorAll('[data-share-bill] li[data-share-row]'),
        (li): [string, number] => {
          // name, dollars, percent (#1163)
          const [name = '', , percent = ''] = Array.from(
            li.children,
            (child) => child.textContent ?? '',
          )
          return [name, Number.parseInt(percent, 10)]
        },
      ),
    )

  it('draws each slice as wide as its share (a slice too narrow for its label, wider), the same percents the receipt writes, for each year and a home estimated', async () => {
    const { container } = render(<BillShare {...PROPS}>x</BillShare>)
    const same = () => {
      const receipt = receiptPercents(container)
      expect(Object.keys(receipt)).toHaveLength(4)
      const rects = Array.from(container.querySelectorAll<SVGRectElement>('rect[data-share-slice]'))
      expect(rects).toHaveLength(4)
      // each slice is about as wide as its share: never much narrower than the whole percent written, less
      // a point, and, when a small slice was widened to fit its label, no more than the few points
      // taken from the others (#1121); together they fill the bar
      let drawn = 0
      for (const rect of rects) {
        const name = KEYS[rect.getAttribute('data-share-slice') ?? ''] ?? ''
        const width = Number.parseFloat(rect.getAttribute('width') ?? '0')
        drawn += width
        const percent = receipt[name] ?? -9
        // The smallest slice is widened most (to its label's room, here a guess); the big ones give a little
        expect(width).toBeGreaterThan(percent - 10)
        expect(width).toBeLessThan(percent + 12)
      }
      expect(drawn).toBeCloseTo(100, 1)
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
    fireEvent.click(screen.getByRole('button', { name: '2026' }))
    expect(cityPercent()).not.toBe(proposed)
    fireEvent.click(screen.getByRole('button', { name: '2027' }))
    expect(cityPercent()).toBe(proposed)
  })
})
