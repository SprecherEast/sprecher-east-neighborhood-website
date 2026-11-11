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

/** Text size of the percent written on a wedge, in pixels, and how wide a character runs (a safe average) */
export const PIE_PERCENT_PX = 16
const CHARACTER_WIDTH = 0.6
/** Space kept clear on each side of the percent inside its wedge, in pixels */
const PADDING = 3
/** How far out from the centre, as a part of the radius, the percent sits */
export const PIE_PERCENT_AT = 0.85

/** How far out, as a part of the radius, a wedge's name (the same size as its percent) and percent sit together: near its centre, so the pair reads as centred */
export const PIE_CAPTION_AT = 0.55

/** How wide a wedge is at a distance from the centre, in pixels (the chord, never past the pie) */
function wedgeWidth(angle: number, distance: number) {
  return 2 * distance * Math.sin(Math.min(angle / 2, Math.PI / 2))
}

/**
 * Whether the percent written on a wedge fits inside it at the distance it is drawn: the text plus
 * padding must fit across the wedge there. The same share fits inside a big pie and is left to the
 * legend on a small one.
 */
export function pieLabelFits({
  share,
  radius,
  text,
  at = PIE_PERCENT_AT,
  px = PIE_PERCENT_PX,
}: {
  /** The wedge's share of the whole, 0 to 100 */
  share: number
  radius: number
  /** What is written on the wedge, such as "46%" */
  text: string
  /** How far out from the centre it is drawn, as a part of the radius */
  at?: number
  /** Its text size, in pixels */
  px?: number
}): boolean {
  if (share <= 0 || text.length === 0) return false
  const angle = (share / 100) * FULL_TURN
  const width = text.length * px * CHARACTER_WIDTH
  return width + PADDING * 2 <= wedgeWidth(angle, radius * at)
}
