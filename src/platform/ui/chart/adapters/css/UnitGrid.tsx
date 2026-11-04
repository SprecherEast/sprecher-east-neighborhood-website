import React from 'react'

import { cn } from '@/platform/lib/cn'
import { formatValue } from '@/platform/lib/chart/format'
import { SQUARES_PER_HUNDRED, type ChartUnit } from '@/platform/lib/chart/spec'
import { toUnitCells } from '@/platform/lib/chart/unitCells'
import { Text } from '@/platform/ui/Text'

import { slotAt, type ChartPalette } from '../../chartPalette'

type Datum = { key: string; label: string; value: number; pattern?: 'hatch' }

/** The classes every mark shares: a flat colour square with the page's stripes where it is hatched */
const markClasses = (palette: ChartPalette, slotIndex: number, hatched: boolean | undefined) =>
  cn(slotAt(palette, slotIndex).bg, hatched && 'bg-hatch')

/**
 * 100 squares in a 10 by 10 grid, filled part by part in the parts' colours (largest remainder, so
 * exactly 100). Marks carry no text: the key and the table say what each colour is.
 */
export function SquareGrid({ data, palette }: { data: Datum[]; palette: ChartPalette }) {
  return (
    <div className="grid w-full chart-reveal grid-cols-10 gap-0.5 @md:gap-1">
      {toUnitCells(data, SQUARES_PER_HUNDRED).map((key, cell) => {
        const index = data.findIndex((datum) => datum.key === key)
        return (
          <span
            key={cell}
            data-chart-mark={key}
            className={cn(
              'aspect-square rounded-sm print-exact',
              markClasses(palette, index, data[index].pattern === 'hatch'),
            )}
          />
        )
      })}
    </div>
  )
}

/** One tile per part, the part's name and amount as text under it (never on the colour) */
export function TileGrid({
  data,
  unit,
  slotIndex,
  palette,
}: {
  data: Datum[]
  unit: ChartUnit
  slotIndex: number
  palette: ChartPalette
}) {
  return (
    <div className="grid chart-reveal grid-cols-3 gap-x-2 gap-y-3 @[19rem]:grid-cols-4 @md:grid-cols-6">
      {data.map((datum) => (
        <div key={datum.key} className="min-w-0">
          <span
            data-chart-mark={datum.key}
            className={cn(
              'block h-10 rounded-sm print-exact',
              markClasses(palette, slotIndex, datum.pattern === 'hatch'),
            )}
          />
          <Text variant="small" as="span" className="mt-1 block text-xs text-foreground">
            {datum.label}
          </Text>
          <Text variant="small" as="span" className="block text-xs">
            {formatValue(datum.value, unit)}
          </Text>
        </div>
      ))}
    </div>
  )
}
