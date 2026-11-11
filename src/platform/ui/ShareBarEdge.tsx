/**
 * One side of the highlighted slice, as one line: down from the slice's top, then the quarter circle
 * out onto the panel's top edge. It is one path, so the edge and its curve can never part. Drawn in
 * a nested SVG at the edge's own x, so the path's coordinates stay small and the edge can sit on a
 * whole pixel.
 */
export function ShareBarEdge({
  x,
  side,
  top,
  panelTop,
  flare,
}: {
  x: number | string
  side: 'left' | 'right'
  top: number
  panelTop: number
  /** The quarter circle's radius, in pixels */
  flare: number
}) {
  // A one pixel line centred half a pixel inside the edge, so it fills exactly one pixel column
  const inset = side === 'left' ? 0.5 : -0.5
  const curveTop = panelTop + 0.5 - flare
  const toward = side === 'left' ? -flare : flare
  const d = `M ${inset} ${top} V ${curveTop} A ${flare} ${flare} 0 0 ${side === 'left' ? 1 : 0} ${inset + toward} ${panelTop + 0.5}`
  return (
    <svg x={x} overflow="visible">
      <path d={d} fill="none" strokeWidth={1} className="stroke-primary" />
    </svg>
  )
}
