import React from 'react'

import type { ChartTable } from '@/platform/lib/chart/table'

/**
 * The numbers behind a chart as a real table (#639): a caption, column headers and a header cell
 * on every row, so a screen reader can move through it by row and column. The first column heads
 * each row. `Chart` puts it under "Show the numbers", closed by default.
 */
export function ChartDataTable({ table }: { table: ChartTable }) {
  return (
    <div
      role="region"
      aria-label={table.caption}
      tabIndex={0}
      className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-ring"
    >
      <table className="w-full border-collapse text-left text-sm text-foreground">
        <caption className="pb-2 text-left text-sm font-semibold">{table.caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {table.head.map((cell) => (
              <th key={cell} scope="col" className="px-2 py-1.5 font-semibold">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={index} className="border-b border-border last:border-b-0">
              {row.map((cell, column) =>
                column === 0 ? (
                  <th key={column} scope="row" className="px-2 py-1.5 font-medium">
                    {cell}
                  </th>
                ) : (
                  <td key={column} className="px-2 py-1.5 whitespace-nowrap">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
