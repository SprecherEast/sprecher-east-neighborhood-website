// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { BillShare } from './BillShare.client'
import { box, city, estimate, PROPS } from './billShareFixtures'

afterEach(cleanup)

describe('the share bar over the City’s panel (#1030)', () => {
  /** Each body's whole percent, by name, read from the pie's label and from the bar's label */
  const percents = (label: string): Record<string, number> =>
    Object.fromEntries(
      Array.from(
        label.matchAll(
          /(Madison schools|City of Madison|Dane County|Madison College \(MATC\)) (?:\$[\d,]+, )?(\d+)%/g,
        ),
        (m): [string, number] => [m[1] ?? '', Number(m[2])],
      ),
    )
  const KEYS = {
    schools: 'Madison schools',
    city: 'City of Madison',
    county: 'Dane County',
    matc: 'Madison College (MATC)',
  } as Record<string, string>

  it('shows the same shares as the pie, for each year and for a home estimated', async () => {
    const { container } = render(<BillShare {...PROPS}>x</BillShare>)
    const same = () => {
      const pie = percents(
        screen.getByRole('img', { name: /^Your rough property tax:/ }).getAttribute('aria-label') ??
          '',
      )
      const bar = percents(
        screen
          .getByRole('img', { name: /^Your whole property tax bill:/ })
          .getAttribute('aria-label') ?? '',
      )
      expect(Object.keys(pie)).toHaveLength(4)
      expect(bar).toEqual(pie)
      // each slice is as wide as its exact share: within a point of the whole percent the pie states
      const widths = Array.from(
        container.querySelectorAll<SVGRectElement>('rect[data-share-slice]'),
      )
      expect(widths).toHaveLength(4)
      for (const rect of widths) {
        const name = KEYS[rect.getAttribute('data-share-slice') ?? ''] ?? ''
        const width = Number.parseFloat(rect.getAttribute('width') ?? '0')
        expect(Math.abs(width - (pie[name] ?? -9))).toBeLessThan(1)
      }
    }
    same()
    fireEvent.click(screen.getByRole('button', { name: /2026 rates/ }))
    same()
    await estimate('$900,000')
    same()
  })

  it('labels the City’s slice with its name and percent and joins it to the City’s panel', () => {
    const { container } = render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    const label = container.querySelector('svg[aria-label^="Your whole"] text tspan')
    expect(label?.textContent).toBe('City tax')
    expect(label?.nextElementSibling?.textContent).toMatch(/^\d+%$/)
    expect(container.querySelector('[data-share-outline]')).not.toBeNull()
    const bar = screen.getByRole('img', { name: /^Your whole property tax bill:/ })
    const panel = screen.getByText('Short line')
    expect(bar.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the bar of the last bill while the typed value is not a number', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    fireEvent.change(box(), { target: { value: 'abc' } })
    screen.getByRole('img', { name: /^Your whole property tax bill:/ })
  })
})
