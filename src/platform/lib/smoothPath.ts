/**
 * An SVG path through the points as a smooth curve (monotone cubic, Fritsch and Carlson), so it
 * passes through every point and never swings past a neighbour: a curve through a flat stretch
 * stays flat and one never dips below the baseline between two zeros. `x` must increase.
 */
export function smoothLinePath(points: [number, number][]): string {
  const n = points.length
  if (n === 0) return ''
  const fmt = (value: number) => String(Math.round(value * 100) / 100)
  const move = `M${fmt(points[0][0])},${fmt(points[0][1])}`
  if (n === 1) return move

  const width = points.slice(1).map(([x], i) => x - points[i][0])
  const slope = points.slice(1).map(([, y], i) => (y - points[i][1]) / width[i])

  // Tangent at each point: the average of the two slopes beside it, zero where the direction turns
  const tangent = points.map((_, i) => {
    if (i === 0) return slope[0]
    if (i === n - 1) return slope[n - 2]
    return slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2
  })
  // Keep each tangent small enough not to overshoot its segment
  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      tangent[i] = 0
      tangent[i + 1] = 0
      continue
    }
    const a = tangent[i] / slope[i]
    const b = tangent[i + 1] / slope[i]
    const size = Math.hypot(a, b)
    if (size > 3) {
      tangent[i] = (3 * a * slope[i]) / size
      tangent[i + 1] = (3 * b * slope[i]) / size
    }
  }

  const segments = points.slice(1).map(([x, y], i) => {
    const [x0, y0] = points[i]
    const h = width[i] / 3
    return `C${fmt(x0 + h)},${fmt(y0 + tangent[i] * h)} ${fmt(x - h)},${fmt(y - tangent[i + 1] * h)} ${fmt(x)},${fmt(y)}`
  })
  return `${move} ${segments.join(' ')}`
}
