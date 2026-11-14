import type { RefObject } from 'react'

import type { ChartSpec } from '@/platform/lib/chart/spec'
import { ScaledBreakdown } from '@/platform/ui/chart/ScaledBreakdown'
import { Disclosure } from '@/platform/ui/Disclosure'

/**
 * Where the City's tax goes, as a closed row of the whole bill under the City's own row (#1163):
 * the split alone, with thin bars, since the answer card above already gives the City's tax and its
 * increase and the row's title is the heading (#1144). Its date and sources are not drawn here: the whole bill's Sources row lists them (#1180). `row` is `useBreakdownAutoOpen`'s: it opens the
 * row after each estimate that changes the bill while it is closed (#1176), and each opening fills the bars again (#1165).
 */
export function BreakdownRow({
  title,
  spec,
  factor,
  row,
  revealAnchor,
}: {
  title: string
  spec: Extract<ChartSpec, { kind: 'breakdown' }>
  factor: number
  /** The element kept in view, under the sticky header, when the row opens (#1178) */
  revealAnchor?: string
  row: { rowRef: RefObject<HTMLDetailsElement | null>; openings: number; onOpening: () => void }
}) {
  return (
    <Disclosure
      ref={row.rowRef}
      variant="listRow"
      summary={title}
      bodyClassName="space-y-6"
      onOpening={row.onOpening}
      revealAnchor={revealAnchor}
    >
      <ScaledBreakdown
        spec={spec}
        factor={factor}
        title="screen-reader"
        fillKey={row.openings}
        compact
        hideSource
      />
    </Disclosure>
  )
}
