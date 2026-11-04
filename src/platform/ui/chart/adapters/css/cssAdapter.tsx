import React from 'react'

import type { ChartSpec } from '@/platform/lib/chart/spec'
import { Text } from '@/platform/ui/Text'

import type { ChartAdapter } from '../../chartAdapter'

import { SquareGrid, TileGrid } from './UnitGrid'

/**
 * The css adapter (#639, re-scoped on the issue): square grids and tiles as plain HTML, so they
 * need no measuring, stay sharp at any width and send no chart code to the browser. The whole
 * drawing is one `img` named by the chart's title and description; the groups' names are visible
 * text inside it. Colours are palette classes, hatching is `bg-hatch`, nothing is inline.
 */
export const cssAdapter: ChartAdapter = {
  name: 'css',
  output: 'html',
  kinds: new Set<ChartSpec['kind']>(['units']),
  usesColour: true,
  enlargeable: true,
  render(spec, { titleId, descId, palette }) {
    if (spec.kind !== 'units') throw new Error(`The css adapter does not draw ${spec.kind} charts`)
    const { mode, groups, unit } = spec
    return (
      <div
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        className={groups.length > 1 ? 'grid gap-8 @md:grid-cols-2' : undefined}
      >
        {groups.map((group, groupIndex) => (
          <div key={group.key} className="min-w-0">
            <Text variant="small" as="p" className="mb-2 font-semibold text-foreground">
              {group.label}
            </Text>
            {mode === 'perHundred' ? (
              <SquareGrid data={group.data} palette={palette} />
            ) : (
              <TileGrid data={group.data} unit={unit} slotIndex={groupIndex} palette={palette} />
            )}
          </div>
        ))}
      </div>
    )
  },
}
