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
})
