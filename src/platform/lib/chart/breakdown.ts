import { formatValue } from './format'
import type { ChartSpec } from './spec'
import { toUnitCounts } from './unitCells'

type Breakdown = Extract<ChartSpec, { kind: 'breakdown' }>

/** Steps of the colour ramp, from the biggest to the smallest */
export const RAMP_STEPS = 7

/** A piece with its place in the whole: its share in percent and its colour step */
export type BreakdownPiece = {
  key: string
  label: string
  value: number
  share: number
  step: number
}

/** A piece in the list of smaller pieces: it names the area it sits in */
export type SmallerPiece = BreakdownPiece & { area: string }

export type BreakdownArea = BreakdownPiece & {
  /** Squares of the grid this area fills */
  squares: number
  /** Pieces shown right under the area, biggest first, in the area's own step */
  shown: BreakdownPiece[]
}

export type BreakdownModel = {
  /** Bar length as a multiple of the share: `BAR_SCALE`, or less when the biggest area would overflow its track */
  barScale: number
  total: number
  squareCount: number
  /** Biggest first: the order of the grid, the key and the bars */
  areas: BreakdownArea[]
  /** Every piece not shown under its area, biggest first, coloured by its own rank */
  smaller: SmallerPiece[]
}

const byValueDesc = <T extends { value: number }>(items: readonly T[]) =>
  items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.value - a.item.value || a.index - b.index)
    .map(({ item }) => item)

/** The step of the piece at `rank` (0 is the biggest) among `count` pieces, spread over the ramp */
const stepOf = (rank: number, count: number) =>
  Math.min(RAMP_STEPS, Math.floor((rank * RAMP_STEPS) / count) + 1)

/**
 * Everything a breakdown draws, worked out once from its spec so the grid, the key, the bars and
 * the table cannot disagree. Areas rank biggest first and take the ramp's steps in that order
 * (the darkest for the biggest); the grid has one square per `squareValue`, rounded, shared out
 * by largest remainder so the areas always fill it exactly.
 */
export function toBreakdown(spec: Breakdown): BreakdownModel {
  const total = spec.areas.reduce((sum, area) => sum + area.value, 0)
  const squareCount = Math.round(total / spec.squareValue)
  const ranked = byValueDesc(spec.areas)
  const counts = toUnitCounts(ranked, squareCount)
  const share = (value: number) => (value / total) * 100

  const areas = ranked.map((area, rank): BreakdownArea => {
    const step = Math.min(RAMP_STEPS, rank + 1)
    const shown = byValueDesc((area.pieces ?? []).filter((piece) => piece.shown))
    return {
      key: area.key,
      label: area.label,
      value: area.value,
      share: share(area.value),
      step,
      squares: counts[rank],
      shown: shown.map((piece) => ({
        key: piece.key,
        label: piece.label,
        value: piece.value,
        share: share(piece.value),
        step,
      })),
    }
  })

  const folded = byValueDesc(
    ranked.flatMap((area) =>
      (area.pieces ?? [])
        .filter((piece) => !piece.shown)
        .map((piece) => ({ ...piece, area: area.label })),
    ),
  )
  const smaller = folded.map(
    (piece, rank): SmallerPiece => ({
      key: piece.key,
      label: piece.label,
      value: piece.value,
      share: share(piece.value),
      step: stepOf(rank, folded.length),
      area: piece.area,
    }),
  )
  const biggest = Math.max(...areas.map((area) => area.share))
  const barScale = Math.min(BAR_SCALE, 100 / biggest)
  return { barScale, total, squareCount, areas, smaller }
}

/** Bar length as a multiple of the share: 40% is a bar 88% of the track long, the same in every breakdown */
export const BAR_SCALE = 2.2

/** Dollars in millions, short: $195M from 100M up, $37.9M below, whole dollars under a million */
export function formatMillions(value: number): string {
  if (value < 1_000_000) return formatValue(value, 'usd')
  const millions = value / 1_000_000
  return `$${millions >= 100 ? millions.toFixed(0) : millions.toFixed(1)}M`
}

/** A share in percent with one decimal: 40.8% */
export const formatShare = (share: number) => `${share.toFixed(1)}%`

/** What a square is worth in words: "$5 million", or whole dollars under a million */
export function formatSquareValue(value: number): string {
  if (value < 1_000_000) return formatValue(value, 'usd')
  return `$${Number((value / 1_000_000).toFixed(2))} million`
}
