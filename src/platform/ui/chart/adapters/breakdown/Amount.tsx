import { type BreakdownPiece, formatMillions } from '@/platform/lib/chart/breakdown'

/**
 * An amount, counting while its bars fill: the final amount, hidden, keeps its room, so the row
 * never rewraps and nothing below moves as the digits change (#1165)
 */
export function Amount({ piece }: { piece: BreakdownPiece }) {
  if (piece.counted === undefined) return formatMillions(piece.value)
  return (
    <span className="inline-grid justify-items-end">
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">
        {formatMillions(piece.value)}
      </span>
      <span className="col-start-1 row-start-1">{formatMillions(piece.counted)}</span>
    </span>
  )
}
