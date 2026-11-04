import { formatValue } from '@/platform/lib/chart/format'
import { SQUARES_PER_HUNDRED, type ChartSpec } from '@/platform/lib/chart/spec'
import { toUnitCounts } from '@/platform/lib/chart/unitCells'
import type { LegendSwatchItem } from '@/platform/ui/Legend'

import { slotAt, type ChartPalette } from './chartPalette'

/** One colour key under a chart: its name (for assistive technology) and its swatches */
export type ChartLegendSpec = { label: string; items: LegendSwatchItem[] }

type Units = Extract<ChartSpec, { kind: 'units' }>

const ofEvery100 = `of every $${SQUARES_PER_HUNDRED}`

/** Grids: the parts' colours. Groups sharing the same parts share one key, with each group's squares. */
function unitsLegends(spec: Units, palette: ChartPalette): ChartLegendSpec[] {
  const { groups, mode, unit } = spec
  if (mode === 'each') {
    return groups.length < 2
      ? []
      : [
          {
            label: 'Chart key',
            items: groups.map((g, i) => ({
              label: g.label,
              text: null,
              slot: slotAt(palette, i).slot,
            })),
          },
        ]
  }
  const counts = groups.map((g) => toUnitCounts(g.data, SQUARES_PER_HUNDRED))
  // One key serves every grid only when each part has the same key, label and pattern in all
  const partsOf = (g: (typeof groups)[number]) =>
    JSON.stringify(g.data.map((d) => [d.key, d.label, d.pattern ?? null]))
  const sharedKeys = groups.every((g) => partsOf(g) === partsOf(groups[0]))
  const shown = sharedKeys ? [groups[0]] : groups
  return shown.map((group) => ({
    label: sharedKeys ? 'Chart key' : `Chart key: ${group.label}`,
    items: group.data.map((datum, i) => ({
      label: datum.label,
      text:
        sharedKeys && groups.length > 1
          ? `Of every $${SQUARES_PER_HUNDRED}: ${groups.map((g, gi) => `${counts[gi][i]} in ${g.label}`).join(', ')}`
          : `${counts[groups.indexOf(group)][i]} ${ofEvery100}, ${formatValue(datum.value, unit, { compact: true })}`,
      slot: slotAt(palette, i).slot,
      ...(datum.pattern && { pattern: datum.pattern }),
    })),
  }))
}

/** The colour keys a spec needs: one per set of colours it uses, none when marks need no key */
export function toChartLegends(spec: ChartSpec, palette: ChartPalette): ChartLegendSpec[] {
  switch (spec.kind) {
    case 'units':
      return unitsLegends(spec, palette)
    case 'stacked':
      return [
        {
          label: 'Chart key',
          items: spec.series.map((s, i) => ({
            label: s.label,
            text: null,
            slot: slotAt(palette, i).slot,
            ...(s.pattern && { pattern: s.pattern }),
          })),
        },
      ]
    case 'bar':
      return []
  }
}
