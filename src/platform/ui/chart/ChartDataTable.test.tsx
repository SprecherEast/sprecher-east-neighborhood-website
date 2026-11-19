// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ChartDataTable } from './ChartDataTable'

afterEach(cleanup)

describe('ChartDataTable', () => {
  it('has a caption, column headers and a header cell for each row', () => {
    render(
      <ChartDataTable
        table={{
          caption: 'Costs',
          head: ['Item', 'Amount'],
          rows: [
            ['2026', '$1'],
            ['2027', '$2'],
          ],
          rowHeaders: 1,
        }}
      />,
    )
    expect(screen.getByRole('table', { name: 'Costs' })).toBeTruthy()
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Item',
      'Amount',
    ])
    const row = screen.getByRole('row', { name: /2027/ })
    expect(within(row).getByRole('rowheader').textContent).toBe('2027')
    expect(within(row).getByRole('cell').textContent).toBe('$2')
  })

  it('names the group and the part on a numeric cell when two columns head the row', () => {
    render(
      <ChartDataTable
        table={{
          caption: 'Pays for',
          head: ['Group', 'Part', 'Squares', 'Amount'],
          rows: [['2027', 'Public works', '12', '$56']],
          rowHeaders: 2,
        }}
      />,
    )
    const row = screen.getByRole('row', { name: /Public works/ })
    expect(
      within(row)
        .getAllByRole('rowheader')
        .map((c) => c.textContent),
    ).toEqual(['2027', 'Public works'])
    expect(
      within(row)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['12', '$56'])
  })
})
