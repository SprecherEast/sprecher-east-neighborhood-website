import type { RefObject } from 'react'

import type { ChartSpec } from '@/platform/lib/chart/spec'
import { ScaledBreakdown } from '@/platform/ui/chart/ScaledBreakdown'
import { Disclosure } from '@/platform/ui/Disclosure'

/**
 * Where the City's tax goes, as a closed row of the whole bill under the City's own row (#1163):
 * the split alone, with thin bars, since the answer card above already gives the City's tax and its
 * increase and the row's title is the heading (#1144). `row` is `useBreakdownAutoOpen`'s: it opens the
 * row once after the first estimate, and each opening fills the bars again (#1165).
 */
export function BreakdownRow({
  title,
  spec,
  factor,
  row,
}: {
  title: string
  spec: Extract<ChartSpec, { kind: 'breakdown' }>
  factor: number
  row: { rowRef: RefObject<HTMLDetailsElement | null>; openings: number; onOpening: () => void }
}) {
  return (
    <Disclosure
      ref={row.rowRef}
      variant="listRow"
      summary={title}
      bodyClassName="space-y-6"
      onOpening={row.onOpening}
    >
      <ScaledBreakdown
        spec={spec}
        factor={factor}
        title="screen-reader"
        fillKey={row.openings}
        compact
      />
    </Disclosure>
  )
}
