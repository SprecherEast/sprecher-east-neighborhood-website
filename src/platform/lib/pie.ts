/** One wedge's angles in radians, from the top of the pie, clockwise */
export type PieArc = { start: number; end: number; mid: number }

const FULL_TURN = Math.PI * 2

/**
 * The wedges of a pie: each share's part of a full turn, starting at the top and going clockwise.
 * Shares are relative, so they need not add up to 100; a share of nothing gets an empty wedge.
 */
export function pieArcs(shares: readonly number[]): PieArc[] {
  const total = shares.reduce((sum, share) => sum + Math.max(share, 0), 0)
  let at = 0
  return shares.map((share) => {
    const size = total > 0 ? (Math.max(share, 0) / total) * FULL_TURN : 0
    const arc = { start: at, end: at + size, mid: at + size / 2 }
    at += size
    return arc
  })
}

/** A point on a circle, `angle` radians clockwise from the top */
export function pieAt(cx: number, cy: number, radius: number, angle: number) {
  return { x: cx + radius * Math.sin(angle), y: cy - radius * Math.cos(angle) }
}

/** Numbers in a path, without the long tail of a float */
const n = (value: number) => Number(value.toFixed(2))

/**
 * An SVG path for one wedge: from the centre out to the rim, round the rim and back. A wedge that
 * fills the whole circle is two half arcs, since an arc cannot end where it started.
 */
export function piePath(cx: number, cy: number, radius: number, start: number, end: number) {
  const from = pieAt(cx, cy, radius, start)
  if (end - start >= FULL_TURN - 1e-6) {
    const opposite = pieAt(cx, cy, radius, start + Math.PI)
    return `M ${n(from.x)} ${n(from.y)} A ${radius} ${radius} 0 1 1 ${n(opposite.x)} ${n(opposite.y)} A ${radius} ${radius} 0 1 1 ${n(from.x)} ${n(from.y)} Z`
  }
  const to = pieAt(cx, cy, radius, end)
  const large = end - start > Math.PI ? 1 : 0
  return `M ${n(cx)} ${n(cy)} L ${n(from.x)} ${n(from.y)} A ${radius} ${radius} 0 ${large} 1 ${n(to.x)} ${n(to.y)} Z`
}

/** Text size of a label inside the pie, in pixels, and how wide a character runs (a safe average) */
export const PIE_FONT_PX = 12
const CHARACTER_WIDTH = 0.6
/** Space kept clear on each side of a label inside its wedge, in pixels */
const PADDING = 6
/** The percent alone needs more room than that, so it stays out of a pie too small to read it */
const PERCENT_PADDING = 10
/** How far out from the centre, as a part of the radius, the full label and the percent sit */
export const PIE_FULL_AT = 0.6
export const PIE_PERCENT_AT = 0.85

export type PieLabelFit = 'full' | 'percent' | 'out'

/** The width of one line of label text, in pixels */
const textWidth = (line: string) => line.length * PIE_FONT_PX * CHARACTER_WIDTH

/** How wide a wedge is at a distance from the centre, in pixels (the chord, never past the pie) */
function wedgeWidth(angle: number, distance: number) {
  return 2 * distance * Math.sin(Math.min(angle / 2, Math.PI / 2))
}

/**
 * Where a wedge's label goes, decided from its size: `full` writes every line inside it, `percent`
 * writes only its last line (the percent) inside it, and `out` leaves it to a legend. Each case needs
 * the widest line plus padding to fit across the wedge at the distance it is drawn, so the same
 * share fits inside a big pie and is pulled out of a small one.
 */
export function pieLabelFit({
  share,
  radius,
  lines,
}: {
  /** The wedge's share of the whole, 0 to 100 */
  share: number
  radius: number
  /** What the label says, one line each; the last is the percent */
  lines: readonly string[]
}): PieLabelFit {
  if (share <= 0 || lines.length === 0) return 'out'
  const angle = (share / 100) * FULL_TURN
  const widest = Math.max(...lines.map(textWidth))
  const tall = lines.length * PIE_FONT_PX * 1.3
  if (widest + PADDING * 2 <= wedgeWidth(angle, radius * PIE_FULL_AT) && tall <= radius * 0.7) {
    return 'full'
  }
  const percent = textWidth(lines.at(-1) ?? '')
  return percent + PERCENT_PADDING * 2 <= wedgeWidth(angle, radius * PIE_PERCENT_AT)
    ? 'percent'
    : 'out'
}
